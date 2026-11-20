// 内容层装配单例：加载 content.config.ts → 装配 store/meta → 同步 → 生成类型。
// vite 插件与 gen-routes CLI 共用；同进程只装配一次，resetSynced 供 config 文件变更时重建。
//
// 全链路跑在 Node 原生 type stripping（≥22.18）上：workspace 包以 TS 源码分发
// （erasableSyntaxOnly + .ts 后缀 import），无需任何构建步骤。
//
// 插件装配（docs/plugin-design.md）：markopress.config.ts 与 content.config.ts 一起加载，
// 注册面（entryTypes）在 sync 前合并；全量 contentSynced 经进程级单飞链后台执行
// （build 等待、dev 不阻塞 ready——等待策略由调用方决定，见 rspack-shared/markopress-plugin）。
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ContentSyncer,
  type ContentConfig,
  generateTypes,
  getGenerateDigest,
  MutableStore,
  metaFile,
  PersistentMetaStore,
  setContentStore,
} from "./content/index.ts";
import {
  createMarkdownRenderer,
  markdownEntryType,
  type MarkdownRenderer,
  type RenderedMarkdown,
} from "./markdown/index.ts";
import { ENGINE_PACKAGE_ROOT, ROOT } from "./paths.ts";
import { generateVirtualTypes } from "./virtual-types.ts";
import {
  assertNoLiteralSecrets,
  enqueueContentSynced,
  type MarkoPressConfig,
  type MarkoPressPlugin,
  type PluginCtx,
  type ThemeOptions,
  routeFor,
  routeIdFor,
  validateNamespace,
  type HeadEntry,
  type ImagesConfig,
  normalizeImagesConfig,
  type ImagesSettings,
  writePluginData,
} from "./plugins.ts";

export { ROOT };
export const CONTENT_DIR = join(ROOT, "content");
export const STORE_DIR = join(ROOT, ".markopress", "store");
export const TYPES_FILE = join(ROOT, ".markopress", "content.d.ts");
/** 用户组件目录（.markopress/components，VitePress .vitepress/theme/ 同位；段机制的白名单源） */
export const COMPONENTS_DIR = join(ROOT, ".markopress", "components");
/**
 * 站点配置（唯一用户配置文件）：默认 .markopress/config.ts（collections + 管线合一），
 * 可用 MP_CONTENT_CONFIG 覆盖（性能测试传 .markopress/perf.config.ts）。
 */
export const CONFIG_FILE = join(
  ROOT,
  process.env.MP_CONTENT_CONFIG ?? join(".markopress", "config.ts"),
);
/** markopack 浏览器入口（缺省空模块，按约定生成——见 writeConventions） */
export const ENTRY_FILE = join(ROOT, ".markopress", "entry.ts");
/** 虚拟模块前缀：virtual:mp/content/<collection>/<id> */
export const VIRTUAL_PREFIX = "virtual:mp/content/";

export interface ResolvedTheme {
  name: string;
  options: ThemeOptions;
  /** 主题包目录 + tags 目录（生成器显式 import 用——多主题共存时 taglib 全局发现
   *  会撞名，显式 import 是唯一确定性绑定） */
  dir: string;
  tagsDir: string;
  /** options.css 解析结果（public/ 内的绝对路径；setup 组装进 head 的 <link> 条目） */
  css: Array<string>;
}

export interface SyncedContent {
  store: MutableStore;
  meta: PersistentMetaStore;
  syncer: ContentSyncer;
  config: ContentConfig;
  renderer: MarkdownRenderer;
  plugins: Array<MarkoPressPlugin>;
  pluginCtx: PluginCtx;
  /** 主题（装配期解析 + 槽位校验，fail fast；themes.md §9 #1 的字符串槽位契约） */
  theme: ResolvedTheme;
  /** 站点级 head 条目（config.head 透传；站点关切，与主题无关） */
  head: Array<HeadEntry>;
  /** dev 服务器关切（config.dev 透传；仅 rspack-dev 消费——dev.proxy 反代远端 API） */
  dev: MarkoPressConfig["dev"];
  /** 图片管线 v2 设置（config.images 归一化后透传；images.ts / content-modules 消费） */
  images: ImagesSettings;
  /** SSG 显式页面清单（config.ssg 透传；仅 rspack-build 消费——参数路由枚举） */
  ssg: MarkoPressConfig["ssg"];
  /** 全量 contentSynced 的完成信号。build 必须等待（产物要齐）；dev 可不阻塞 */
  pluginsReady: Promise<void>;
}

let ready: Promise<SyncedContent> | undefined;

export function ensureSynced(): Promise<SyncedContent> {
  ready ??= setup();
  return ready;
}

/** config 文件变更后调用：下次 ensureSynced 重新装配（新 digest ⇒ store 全量重建） */
export function resetSynced(): void {
  ready = undefined;
}

async function loadConfig(): Promise<MarkoPressConfig> {
  // ?t= 防 ESM 模块缓存——resetSynced 后必须拿到新配置
  const configUrl = `${fileURLToPath(new URL(CONFIG_FILE, import.meta.url))}?t=${Date.now()}`;
  try {
    const mod = await import(configUrl);
    return mod.default as MarkoPressConfig;
  } catch (error) {
    // 首次使用最常见坑（smoke 实测）：app package.json 无 "type": "module" ⇒
    // .ts 按 CJS 解析（type stripping 只剥类型不改判格式），ESM 语法 SyntaxError。
    // 给可动作的提示而不是裸语法错误。
    if (error instanceof SyntaxError && /Cannot use (import|export) statement/.test(error.message)) {
      throw new Error(
        `[markopress] ${relative(ROOT, CONFIG_FILE)} uses ESM syntax but the app package.json has no "type": "module" — add it, or rename the config to .mts`,
      );
    }
    throw error;
  }
}

/**
 * 按约定生成的文件（write-if-changed，用户永远不手写）：
 *   marko.json —— components 目录存在 ⇒ tags-dir 指过去（Marko 编译器的 taglib
 *     发现约定，只能叫这个名字、只能在包根）；目录不存在则移除残留
 *   entry.ts   —— markopack 浏览器入口：缺省空模块 + options.css 注入。
 *     css 经 entry 的 module import 进 bundler（纯 TS 模块 = 标准 bundler 路径；
 *     保持真实模块依赖——改 css 即失效重建。.marko 模板里未引用的 side-effect
 *     import 会被 Marko 编译器丢弃，不能用生成布局作注入载体）。
 */
export function writeConventions(): void {
  const markoJson = join(ROOT, "marko.json");
  if (existsSync(COMPONENTS_DIR)) {
    const content = `{\n  "tags-dir": "./.markopress/components"\n}\n`;
    if (!existsSync(markoJson) || readFileSync(markoJson, "utf-8") !== content) {
      writeFileSync(markoJson, content);
    }
  } else if (existsSync(markoJson)) {
    rmSync(markoJson);
  }
  const entryContent = "// markopress 浏览器入口（缺省空模块；水合入口由 MarkoRspackPlugin 按需注入）\nexport {};\n";
  if (!existsSync(ENTRY_FILE) || readFileSync(ENTRY_FILE, "utf-8") !== entryContent) {
    mkdirSync(dirname(ENTRY_FILE), { recursive: true });
    writeFileSync(ENTRY_FILE, entryContent);
  }
}

/** 省略 theme 时的默认主题（零配置路径的目标形态；themes.md §9 #1） */
export const DEFAULT_THEME = "docs";
/** 内置主题名（engine 包 themes/ 下同名目录，随 markopress 分发） */
const BUILTIN_THEMES = new Set(["docs", "blog"]);

/**
 * 解析 + 校验主题（fail fast）：
 *  ① 内置（"docs"/"blog"）→ engine 包内 themes/<name>；② "./x" 或绝对路径 →
 *     相对站点根的本地主题目录；③ 其余 → npm 包，从 app 上下文解析（外部主题包
 *     不得用 exports 限制 package.json 子路径，契约见 engine/AGENTS-themes.md）；
 *  ② marko.json 的 tags-dir（缺省 "tags"）下必须存在槽位实现 mp-layout/mp-page
 *     （生成器写死槽位名，缺实现是硬错误而非静默降级）；
 *  ③ options.css 逐个解析 + 存在性校验（生成布局 module import 注入）。
 */
function resolveTheme(pressConfig: MarkoPressConfig): ResolvedTheme {
  const { name = DEFAULT_THEME, options = {} } = pressConfig.theme ?? {};
  let dir: string;
  if (BUILTIN_THEMES.has(name)) {
    dir = join(ENGINE_PACKAGE_ROOT, "themes", name);
  } else if (name.startsWith(".") || isAbsolute(name)) {
    dir = resolve(ROOT, name);
    if (!existsSync(join(dir, "package.json"))) {
      throw new Error(
        `[markopress] local theme "${name}" has no package.json (resolved ${relative(ROOT, dir)}) — see engine/AGENTS-themes.md for the theme contract`,
      );
    }
  } else {
    const require = createRequire(join(ROOT, "package.json"));
    try {
      dir = dirname(require.resolve(`${name}/package.json`));
    } catch {
      throw new Error(
        `[markopress] theme "${name}" not found — built-ins are "docs"/"blog"; external theme = install it (pnpm add ${name}) or use a local path "./…"`,
      );
    }
  }
  let tagsDir = "tags";
  const markoJson = join(dir, "marko.json");
  if (existsSync(markoJson)) {
    const parsed = JSON.parse(readFileSync(markoJson, "utf-8")) as { "tags-dir"?: string };
    if (parsed["tags-dir"]) tagsDir = parsed["tags-dir"];
  }
  for (const slot of ["mp-layout", "mp-page"]) {
    const file = join(dir, tagsDir, `${slot}.marko`);
    if (!existsSync(file)) {
      throw new Error(
        `[markopress] theme "${name}" is missing slot <${slot}> (expected ${relative(ROOT, file) || file}) — theme contract: docs/research/themes.md §9`,
      );
    }
  }
  const cssList = options.css === undefined ? [] : Array.isArray(options.css) ? options.css : [options.css];
  const css = cssList.map((entry) => {
    const file = resolve(ROOT, entry);
    // 约定：css 文件必须住在站点 public/ 下（静态服务面：dev sirv 链 + build
    // adapter 拷贝——head link 直指原文件，无 bundler 参与、无快照 staleness。
    // bundler 注入两条路已实测否决：.marko 模板内 side-effect import 被编译器
    // 丢弃；浏览器 entry 的 css chunk 不进 SSR html 的 <link> 集）
    const publicDir = join(ROOT, "public");
    if (!(file + sep).startsWith(publicDir + sep)) {
      throw new Error(
        `[markopress] theme options.css "${entry}" must live under the site's public/ directory (served statically; dev sirv + build copy)`,
      );
    }
    if (!existsSync(file)) {
      throw new Error(
        `[markopress] theme options.css "${entry}" not found (resolved ${relative(ROOT, file) || file})`,
      );
    }
    return file;
  });
  return { name, dir, tagsDir, options, css };
}

async function setup(): Promise<SyncedContent> {
  // 单文件配置装载后按键分发：collections → 内容层；其余 → 管线。
  // 内部分发与合并前的两文件形态等价。
  const merged = await loadConfig();
  // 配置指纹 = config 文件内容 digest（失效三件套之三的输入；deltas #9 的 app 侧
  // 补全）。sync 层的兜底投影（集合名 + loader 名）探测不到 zod schema 变化——
  // schema 是运行时值，改名/加字段后旧 store 数据带着旧的剥离开局存活（2026-11-11
  // pdflux 加 slug/class 字段实测踩中）。文件级指纹：任何 config 编辑 ⇒ clearAll
  // 全量重跑（schema/loader/route 全覆盖；代价 = strapi 等远端集合重拉，config
  // 编辑低频，可接受）。
  const configDigest = (await getGenerateDigest())(readFileSync(CONFIG_FILE, "utf-8"));
  const config: ContentConfig = {
    collections: (merged.collections ?? {}) as ContentConfig["collections"],
    digest: configDigest,
  };
  // plugins 归一化：覆盖配置（perf/blog spike）可以不带插件键
  const pressConfig: MarkoPressConfig = { ...merged, collections: undefined, plugins: merged.plugins ?? [] };
  // 字面量密钥 fail fast（strapi-loader-design §7）——在一切网络/装载之前
  assertNoLiteralSecrets(CONFIG_FILE);
  writeConventions();

  const store = await MutableStore.fromDir(STORE_DIR);
  const meta = await PersistentMetaStore.fromFile(metaFile(STORE_DIR));
  const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
  const syncer = new ContentSyncer({
    store,
    meta,
    entryTypes: [markdownEntryType, ...(pressConfig.plugins ?? []).flatMap((p) => p.entryTypes ?? [])],
    version,
  });
  await syncer.sync(config);
  // 运行时读 API（getCollection/getEntry）注入；未来换虚拟模块装载，形状不变
  setContentStore(store);
  await generateTypes({
    config,
    importSpecifier: relative(dirname(TYPES_FILE), CONFIG_FILE)
      .replaceAll("\\", "/")
      .replace(/\.ts$/, ""),
    outPath: TYPES_FILE,
  });
  await generateVirtualTypes(config, join(ROOT, ".markopress", "virtual.d.ts"));

  const renderer = createMarkdownRenderer(pressConfig.markdown);
  const theme = resolveTheme(pressConfig);
  validateNamespace(pressConfig.plugins, theme, COMPONENTS_DIR);
  const pluginCtx: PluginCtx = {
    store,
    config,
    async render(entry) {
      if (entry.contentType !== "text/markdown" || entry.body === undefined) {
        throw new Error(
          `[markopress] no renderer for contentType ${String(entry.contentType)} ("${entry.id}")`,
        );
      }
      return renderer.render({ digest: entry.digest ?? entry.id, body: entry.body });
    },
    // urlOf = 三件内置（rss/sitemap/search）URL 的单一出口：route.prefix 在此拼前
    // （远端 loader 同样受益——prefix 是 config 层路由关切，与 loader 是谁无关）；
    // route: false 的集合返回 null——调用方跳过（无 URL 的聚合条目没有意义）
    urlOf: (collection, id) => {
      const route = config.collections[collection]?.route;
      if (route === false) return null;
      return routeFor(routeIdFor(route?.prefix, id));
    },
    setData: (name, value) => writePluginData(name, value).then(() => {}),
  };
  // 全量 contentSynced：后台链（同插件串行，失败逐插件日志降级——不阻塞 setup）。
  // build 调用方 await pluginsReady（rspack-shared prepare / vite build 的 config 钩子）。
  const pluginsReady = enqueueContentSynced(pressConfig.plugins, pluginCtx, undefined);

  // 图片管线 v2 设置落盘（write-if-changed）：server bundle 里的 <mp-image> 组件走
  // 叶子层（images.ts），不能 import 本模块（ensureSynced 会把内容层拖进 bundle）——
  // 归一化设置经此 JSON 传递，images.ts 渲染期 mtime 缓存读取。config 变更 →
  // resetSynced → setup 重写 → 下一渲染生效。
  const images = normalizeImagesConfig(pressConfig.images);
  const settingsFile = join(ROOT, ".markopress", "images-settings.json");
  const settingsJson = `${JSON.stringify(
    { ...images, domains: [...images.domains] },
    null,
    2,
  )}\n`;
  if (!existsSync(settingsFile) || readFileSync(settingsFile, "utf-8") !== settingsJson) {
    writeFileSync(settingsFile, settingsJson);
  }

  return {
    store,
    meta,
    syncer,
    config,
    renderer,
    plugins: pressConfig.plugins,
    pluginCtx,
    theme,
    head: [
      ...(pressConfig.head ?? []),
      // options.css → head link（静态服务：public/ 直指原文件；排在用户 head 之后）
      ...theme.css.map((file) => ({
        tag: "link",
        attrs: {
          rel: "stylesheet",
          href: `/${relative(join(ROOT, "public"), file).replaceAll("\\", "/")}`,
        },
      })),
    ],
    dev: pressConfig.dev,
    images,
    ssg: pressConfig.ssg,
    pluginsReady,
  };
}

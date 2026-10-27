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
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ContentSyncer,
  type ContentConfig,
  generateTypes,
  MutableStore,
  metaFile,
  PersistentMetaStore,
  setContentStore,
} from "@markopress/content";
import {
  createMarkdownRenderer,
  markdownEntryType,
  type MarkdownRenderer,
  type RenderedMarkdown,
} from "@markopress/markdown";
import { ROOT } from "./paths.ts";
import {
  enqueueContentSynced,
  type MarkoPressConfig,
  type MarkoPressPlugin,
  type PluginCtx,
  type ThemeOptions,
  routeFor,
  validatePluginSlots,
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
  const mod = await import(
    `${fileURLToPath(new URL(CONFIG_FILE, import.meta.url))}?t=${Date.now()}`
  );
  return mod.default as MarkoPressConfig;
}

/**
 * 按约定生成的文件（write-if-changed，用户永远不手写）：
 *   marko.json —— components 目录存在 ⇒ tags-dir 指过去（Marko 编译器的 taglib
 *     发现约定，只能叫这个名字、只能在包根）；目录不存在则移除残留
 *   entry.ts   —— markopack 浏览器入口的缺省空模块
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
  if (!existsSync(ENTRY_FILE)) {
    mkdirSync(dirname(ENTRY_FILE), { recursive: true });
    writeFileSync(ENTRY_FILE, "// markopress 浏览器入口（缺省空模块；水合入口由 MarkoRspackPlugin 按需注入）\nexport {};\n");
  }
}

/** 省略 theme 时的默认主题（零配置路径的目标形态；themes.md §9 #1） */
export const DEFAULT_THEME = "@markopress/theme-docs";

/**
 * 解析 + 校验主题包（fail fast）：
 *  ① 从 app 上下文解析包目录（node_modules/workspace 链接——主题包不得用 exports
 *     限制 package.json 子路径，见 theme-docs/AGENTS.md）；
 *  ② marko.json 的 tags-dir（缺省 "tags"）下必须存在槽位实现 mp-layout/mp-page
 *     （生成器写死槽位名，缺实现是硬错误而非静默降级）。
 */
function resolveTheme(pressConfig: MarkoPressConfig): ResolvedTheme {
  const name = pressConfig.theme ?? DEFAULT_THEME;
  const require = createRequire(join(ROOT, "package.json"));
  let dir: string;
  try {
    dir = dirname(require.resolve(`${name}/package.json`));
  } catch {
    throw new Error(
      `[markopress] theme "${name}" not found — install it (pnpm add ${name}) or fix "theme" in markopress.config.ts`,
    );
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
  return { name, options: pressConfig.themeOptions ?? {} };
}

async function setup(): Promise<SyncedContent> {
  // 单文件配置装载后按键分发：collections → 内容层（digest 只看集合子树）；
  // 其余 → 管线。内部分发与合并前的两文件形态等价。
  const merged = await loadConfig();
  const config: ContentConfig = { collections: (merged.collections ?? {}) as ContentConfig["collections"] };
  // plugins 归一化：覆盖配置（perf/blog spike）可以不带插件键
  const pressConfig: MarkoPressConfig = { ...merged, collections: undefined, plugins: merged.plugins ?? [] };
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

  const renderer = createMarkdownRenderer(pressConfig.markdown);
  const theme = resolveTheme(pressConfig);
  validatePluginSlots(pressConfig.plugins);
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
    urlOf: (_collection, id) => routeFor(id),
    setData: (name, value) => writePluginData(name, value).then(() => {}),
  };
  // 全量 contentSynced：后台链（同插件串行，失败逐插件日志降级——不阻塞 setup）。
  // build 调用方 await pluginsReady（rspack-shared prepare / vite build 的 config 钩子）。
  const pluginsReady = enqueueContentSynced(pressConfig.plugins, pluginCtx, undefined);

  return {
    store,
    meta,
    syncer,
    config,
    renderer,
    plugins: pressConfig.plugins,
    pluginCtx,
    theme,
    pluginsReady,
  };
}

// markopress 插件层 —— 接口契约 + 生成/数据产出的纯助手（docs/plugin-design.md 的实现）。
//
// 归属纪律：本文件是双路共享层（Vite = markopress-plugin.ts，Rspack = rspack-*.ts 都从这里
// 取类型与助手）；打包器特定代码只允许出现在虚拟模块解析与 watcher 层。四条硬纪律
// （确定性 / 死锁 / 双路 / 增量）的落点见 plugin-design.md §6。
//
// 装配点唯一：content.ts setup()（加载 markopress.config.ts → 实例化 → 注册面合并 →
// 全量 contentSynced）。本文件不 import content.ts（避免环），store/config/render 由
// setup() 经参数注入。
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type {
  ContentConfig,
  DataEntry,
  EntryType,
  MutableStore,
} from "./content/index.ts";
import type {
  MarkdownRendererOptions,
  RenderedMarkdown,
} from "./markdown/index.ts";
import { ROOT } from "./paths.ts";

/** 插件数据模块的虚拟前缀：virtual:mp/plugin/<name>（与 content 模块同机制，双后端各自解析） */
export const PLUGIN_VIRTUAL_PREFIX = "virtual:mp/plugin/";
export const PLUGIN_DATA_DIR = join(ROOT, ".markopress", "plugin-data");

export interface HandlerRoute {
  /** 如 "/sitemap.xml"；v0 须为无参数路由（不含 $ 段） */
  path: string;
  /** 插件包内模块说明符；其导出须含 verbs 列出的全部动词 */
  handlerModule: string;
  /** 动词显式声明（spike 定稿：两路发现机制不同，不依赖任何一路的自动发现） */
  verbs: Array<"GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS">;
}

/** 单文件增量的事件集（undefined = 全量；与 writeContentModules 的 scope 同形） */
export interface ContentChange {
  changed: Array<{ collection: string; id: string }>;
  removed: Array<{ collection: string; id: string }>;
}

export interface PluginCtx {
  /** 只读消费（values / get）；写路径归 loader 管线，插件不写 store */
  store: MutableStore;
  config: ContentConfig;
  /** 共享渲染实例（与页面渲染共用 digest 缓存——不得各建管线） */
  render(entry: DataEntry): Promise<RenderedMarkdown>;
  /** entry id → URL，与 gen-routes 的路由派生同源（不得各自实现，会漂移） */
  urlOf(collection: string, id: string): string;
  /** 产出数据模块 → .markopress/plugin-data/<name>.js + virtual:mp/plugin/<name> */
  setData(name: string, value: unknown): Promise<void>;
}

export interface MarkoPressPlugin {
  name: string;

  // —— 注册面（装配期求值一次，纯声明）——
  entryTypes?: Array<EntryType>;
  /**
   * 本包 taglib 实现的保留槽位名（如 ["mp-search"]）。装配期撞名 fail fast——
   * Marko taglib 同名注册是静默 last-wins，不可依赖；且槽位名必须 `mp-*` 开头
   * （保留命名空间）。无 UI 的插件省略。槽位 = 固定 tag 名，实现方任意：
   * 换搜索方案 = 换实现同一槽位的另一个插件包，主题/生成器零改动。
   */
  slots?: Array<string>;

  // —— 读路径（store 就绪后；dev 后台执行，不阻塞 ready）——
  contentSynced?(ctx: PluginCtx, changed?: ContentChange): Promise<void>;

  // —— 产出面（生成期一次；产物 = 路由声明）——
  routes?(ctx: PluginCtx): Array<HandlerRoute>;

  // —— 页面级（内容模块渲染时；按 entry digest 缓存）——
  /** 纯函数（body, entry) → body：改「文」。要时间戳等外部数据走 pageData */
  transformBody?(body: string, entry: DataEntry, ctx: PluginCtx): Promise<string>;
  /** 纯函数 (entry) → 附加 data 字段：加「据」。结果浅合并进模块的 data 导出 */
  pageData?(entry: DataEntry, ctx: PluginCtx): Promise<Record<string, unknown>>;
}

/**
 * 站点级 head 注入条目（VitePress head 同形）：GA/Clarity 等统计、字体、SEO 验证 meta。
 * 主题契约义务：mp-layout 在 <head> 渲染 <mp-head-entries entries=input.head/>。
 * content 原样输出（不进浏览器 bundle）——统计脚本必须字面进 HTML 首帧。
 */
export interface HeadEntry {
  tag: string;
  attrs?: Record<string, string | boolean>;
  /** 内联内容（script/style 文本）。config 是信任面（本就可执行代码），不做消毒 */
  content?: string;
}

export interface MarkoPressConfig {
  /** 站点级 head 条目（与主题无关——换主题不丢统计/字体；经 sidebar.json → 生成器 → 主题） */
  head?: Array<HeadEntry>;
  /**
   * 内容集合（markopress-content 契约：loader + schema）。与管线共居
   * .markopress/config.ts 一个文件（用户面合一）；装配层（content.ts）按键
   * 分发——collections 子树单独算 store digest，与内容层包的契约零耦合。
   */
  collections?: Record<string, unknown>;
  plugins: Array<MarkoPressPlugin>;
  /**
   * markdown 管线配置（R1）：unified 直通 + shiki。核心配置而非插件——
   * 变更本文件（含此字段）即触发两路 watcher 的 resetSynced 全量重建，
   * renderer 实例随 setup() 重建，缓存天然新鲜（无跨配置缓存投毒）。
   */
  markdown?: MarkdownRendererOptions;
  /**
   * 主题包名（D5：主题 = npm 包；marko.json tags-dir 经 root 包依赖探测全局发现，
   * docs/research/themes.md §9）。省略 = 默认主题 markopress-theme-docs。
   * 生成器只认槽位名 <mp-layout>/<mp-page>，实现由主题包提供——换主题零改生成器。
   */
  theme?: string;
  /** 主题选项：site/sidebar 等数据面配置（装配期校验后经 SyncedContent 透传） */
  themeOptions?: ThemeOptions;
}

export interface ThemeOptions {
  /** 站名（顶栏 / <title> 兜底 / sidebar.json 的 site 字段） */
  site?: string;
  /** 顶栏导航链接（theme-blog 等无侧边栏主题用；theme-docs 忽略——侧边栏即导航） */
  nav?: Array<{ href: string; label: string }>;
  /**
   * 页 <title> 模板（%s = 页标题；postbuild HTML 补写，docs/plugin-design §7 预留位
   * 的首个用户；dev 期显示站名——已知边界）。默认 "%s"（纯页标题）。
   */
  titleTemplate?: string;
  /**
   * 侧边栏来源集合。默认全部集合——注意 perf 夹具这类万页集合必须显式排除，
   * 否则整树内嵌每页 HTML（写放大，themes.md §8）。sortBy: "date" = 时间倒序
   * （flat 随之变时间序 ⇒ prev/next = 上一篇/下一篇），默认 "alpha"。
   */
  sidebar?: { collections?: Array<string>; sortBy?: "alpha" | "date" };
  /**
   * 风格预设（纯样式层，四家文档站的视觉近似）：default（GitHub 中性）/
   * vitepress / starlight / nextra / docusaurus。色值取自各家源码（见
   * theme-docs 的 mp-layout 预设块注释）。经 sidebar.json → <html data-style> 驱动。
   */
  style?: ThemeStyle;
}

export type ThemeStyle = "default" | "vitepress" | "starlight" | "nextra" | "docusaurus";

export function defineMarkoPressConfig(config: MarkoPressConfig): MarkoPressConfig {
  return config;
}

// ── 路由派生（gen-routes 与 ctx.urlOf 的唯一来源）──────────────────────────

/** entry id → 路由：index 特殊化为根；a/b → /a/b；尾段 index 折叠（guide/index →
 *  /guide——带前缀集合的 index 即集合着陆页；与 pageFileFor 同规则） */
export function routeFor(id: string): string {
  const routeId = id === "index" ? "" : id.replace(/\/index$/, "");
  return routeId === "" ? "/" : `/${routeId}`;
}

/** 集合路由前缀 → route id（gen-routes 与 ctx.urlOf 共用；prefix 拼在 entry id 前，
 *  下游 routeFor/pageFileFor 消费）。校验 fail fast：段为空 / 含点（扁平路由分隔符）/
 *  违禁字符（[]+$% 等动态段与保留语义）。id "404" 禁带前缀——根目录无前缀 +404
 *  文件名是其 special 身位的全部（404+404.marko 踩过）。 */
export function routeIdFor(prefix: string | undefined, id: string): string {
  if (prefix === undefined) return id; // 空串是配置错误，落进下方段校验 fail fast
  if (id === "404") {
    throw new Error(
      `[markopress] 集合路由前缀内的 404：entry "404" 靠根目录无前缀文件名生效，不能落 /${prefix}/404——把 404 entry 放进无前缀的集合`,
    );
  }
  for (const segment of prefix.split("/")) {
    if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
      throw new Error(
        `[markopress] 集合路由前缀非法："${prefix}"（段 "${segment}"——只允许字母数字/连字符/下划线，段间单斜杠分隔）`,
      );
    }
  }
  return `${prefix}/${id}`;
}

/**
 * HandlerRoute.path → 路由文件名（扁平约定）。路径段内的字面 `.` 编码为 `%2E`
 * （marko-run 的 `.` 是扁平路由分隔符；`normalizeSegment` 的 decodeURIComponent
 * 解码回字面段名）。段间以字面 `.` 连接 = 目录层级。spike 定稿，见 plugin-design.md §8 #1。
 */
export function handlerRouteFileFor(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`[markopress] HandlerRoute.path must start with "/": "${path}"`);
  }
  if (path.includes("$")) {
    throw new Error(`[markopress] HandlerRoute.path must not contain params (v0): "${path}"`);
  }
  const segments = path
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll(".", "%2E"));
  if (segments.some((segment) => !segment)) {
    throw new Error(`[markopress] HandlerRoute.path has empty segment: "${path}"`);
  }
  return `${segments.join(".")}+handler.mjs`;
}

/**
 * 路由包装文件源码。动词发现两路的交集形式（Vite=AST、markopack=源码正则，spike §8 #2）：
 * `export const GET = handler.GET` 两边都认；`export { GET } from` / `export *` 只有一边认。
 */
export function handlerWrapperSource(route: HandlerRoute): string {
  return [
    `import * as handler from ${JSON.stringify(route.handlerModule)};`,
    ...route.verbs.map((verb) => `export const ${verb} = handler.${verb};`),
    ``,
  ].join("\n");
}

// ── 数据模块产出（setData 的落盘端）───────────────────────────────────────

/** 本轮进程内 setData 实际写过的模块名（Vite 路失效用；Rspack 走原生 watcher 无需） */
const writtenPluginData = new Set<string>();

export function takeWrittenPluginData(): Set<string> {
  const taken = new Set(writtenPluginData);
  writtenPluginData.clear();
  return taken;
}

/** write-if-changed 落盘数据模块（default export JSON）。返回是否实际写入。 */
export async function writePluginData(name: string, value: unknown): Promise<boolean> {
  const source = `export default ${JSON.stringify(value, null, 2)}\n`;
  const file = join(PLUGIN_DATA_DIR, `${name}.js`);
  mkdirSync(PLUGIN_DATA_DIR, { recursive: true });
  if (existsSync(file) && readFileSync(file, "utf-8") === source) return false;
  writeFileSync(file, source);
  writtenPluginData.add(name);
  return true;
}

// ── 槽位声明校验（UI 槽位契约，docs/plugin-design.md §5.3）──────────────────

/**
 * 一个槽位只允许一个实现（Marko taglib 同名注册是静默 last-wins，两个搜索插件
 * 同装会得到无声的错误那个）；槽位名必须在保留命名空间 `mp-*` 内。
 * 装配期调用（content.ts setup），fail fast。
 */
/**
 * mp-* 命名空间治理（装配期 fail fast，content.ts setup 调用）：
 *  - 插件槽位名必须 mp-* 且全站唯一（原有）
 *  - 插件槽位不得与 ACTIVE 主题的 tag 同名——生成器 gating 写出的 <mp-xxx/> 走
 *    taglib 发现，主题包同名 tag 会顶包（多主题撞名的同款机制）
 *  - 用户组件目录（.markopress/components）禁止 mp-* 前缀——与插件 tag 在
 *    taglib 发现层撞名，且段提取顺序在前会遮蔽管线的 <mp-image>
 */
export function validateNamespace(
  plugins: Array<MarkoPressPlugin>,
  theme?: { name: string; dir: string; tagsDir: string },
  componentsDir?: string,
): void {
  validatePluginSlots(plugins);
  const slots = plugins.flatMap((p) => p.slots ?? []);

  if (theme) {
    const themeTags = listMarkoTags(theme);
    for (const slot of slots) {
      if (themeTags.has(slot)) {
        throw new Error(
          `[markopress] plugin slot <${slot}> collides with a tag shipped by theme "${theme.name}" — a plugin slot and a theme tag may not share a name`,
        );
      }
    }
  }

  if (componentsDir && existsSync(componentsDir)) {
    const offenders = readdirSync(componentsDir)
      .filter((f) => f.endsWith(".marko") && f.startsWith("mp-"))
      .map((f) => f.replace(/\.marko$/, ""));
    if (offenders.length) {
      throw new Error(
        `[markopress] user components may not use the reserved "mp-*" prefix: ${offenders.join(", ")} (in ${relative(ROOT, componentsDir)}) — rename them; mp-* is reserved for framework/plugin/theme tags`,
      );
    }
  }
}

function listMarkoTags(theme: { dir: string; tagsDir: string }): Set<string> {
  const tags: Array<string> = [];
  const dir = join(theme.dir, theme.tagsDir);
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) if (f.endsWith(".marko")) tags.push(f.replace(/\.marko$/, ""));
  }
  return new Set(tags);
}

export function validatePluginSlots(plugins: Array<MarkoPressPlugin>): void {
  const owners = new Map<string, string>();
  for (const plugin of plugins) {
    for (const slot of plugin.slots ?? []) {
      if (!/^mp-[a-z][a-z0-9-]*$/.test(slot)) {
        throw new Error(
          `[markopress] plugin "${plugin.name}" declares slot "${slot}" — slot names must be in the reserved "mp-*" namespace`,
        );
      }
      const owner = owners.get(slot);
      if (owner) {
        throw new Error(
          `[markopress] slot <${slot}> is claimed by both "${owner}" and "${plugin.name}" — one slot, one implementation (swap = swap the plugin)`,
        );
      }
      owners.set(slot, plugin.name);
    }
  }
}

// ── contentSynced 编排（全局单链：同插件串行、跨插件按声明序）──────────────

/**
 * 串行执行插件的 contentSynced。失败语义：逐插件降级——每个失败都带插件名日志后继续
 * （build 下数据缺失会让下游 handler 模块解析失败硬停，插件名已在日志里）。
 */
export async function runContentSynced(
  plugins: Array<MarkoPressPlugin>,
  ctx: PluginCtx,
  changed: ContentChange | undefined,
): Promise<void> {
  for (const plugin of plugins) {
    if (!plugin.contentSynced) continue;
    try {
      await plugin.contentSynced(ctx, changed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[markopress] plugin "${plugin.name}" contentSynced failed: ${message}`);
    }
  }
}

/** 进程级单飞链：保证同插件的 contentSynced 绝不并发（全量/增量共用一条队列）。 */
let syncChain: Promise<void> = Promise.resolve();

/** 入队一次 contentSynced。返回的 promise 在本轮跑完时 resolve（错误已在内部日志）。 */
export function enqueueContentSynced(
  plugins: Array<MarkoPressPlugin>,
  ctx: PluginCtx,
  changed: ContentChange | undefined,
): Promise<void> {
  const run = syncChain.then(() => runContentSynced(plugins, ctx, changed));
  // 链自身吞错（runContentSynced 已逐插件日志，不会抛；防御性兜底）
  syncChain = run.catch(() => {});
  return run;
}

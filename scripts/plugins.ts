// markopress 插件层 —— 接口契约 + 生成/数据产出的纯助手（docs/plugin-design.md 的实现）。
//
// 归属纪律：本文件是双路共享层（Vite = markopress-plugin.ts，Rspack = rspack-*.ts 都从这里
// 取类型与助手）；打包器特定代码只允许出现在虚拟模块解析与 watcher 层。四条硬纪律
// （确定性 / 死锁 / 双路 / 增量）的落点见 plugin-design.md §6。
//
// 装配点唯一：content.ts setup()（加载 markopress.config.ts → 实例化 → 注册面合并 →
// 全量 contentSynced）。本文件不 import content.ts（避免环），store/config/render 由
// setup() 经参数注入。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ContentConfig,
  DataEntry,
  EntryType,
  MutableStore,
} from "@markopress/content";
import type { RenderedMarkdown } from "@markopress/markdown";
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

export interface MarkoPressConfig {
  plugins: Array<MarkoPressPlugin>;
}

export function defineMarkoPressConfig(config: MarkoPressConfig): MarkoPressConfig {
  return config;
}

// ── 路由派生（gen-routes 与 ctx.urlOf 的唯一来源）──────────────────────────

/** entry id → 路由：index 特殊化为根；a/b → /a/b */
export function routeFor(id: string): string {
  return id === "index" ? "/" : `/${id}`;
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

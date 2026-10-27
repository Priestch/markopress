// markopress 路由生成器 —— 数据源是 content store（不再扫文件）。
//
// 生成物（@marko/run 经 routesDir 原样消费）：
//   .markopress/routes/+layout.marko      静态外壳：<mp-layout> 槽位（import sidebar.json）
//   .markopress/routes/<name>+page.marko  极小包装：<mp-page> 槽位（虚拟模块 + page-nav）
//   .markopress/sidebar.json              侧边栏树 + flat 序（布局/prev-next 数据；变化走模块图）
//   .markopress/page-nav.js               静态邻居助手（生成一次，永不变化）
//   .markopress/urls.json                 SSG 显式 URL 清单（未来带参数路由用）
//
// 主题槽位契约（docs/research/themes.md §9）：生成器只写死 <mp-layout>/<mp-page> tag 名，
// 实现由主题包提供（marko.json tags-dir 经 root 包依赖探测全局发现）——数据面与实现面解耦。
// md 内容编辑 ⇒ 模板不变（write-if-changed 全跳过）⇒ routes 目录零文件事件；
// slug 增/删 ⇒ 单个 +page.marko 事件 + sidebar.json 重写（模块图失效，非 routes 目录文件事件）。
// prev/next 走 sidebar.json 的 flat 序（跨文件数据不能进 per-entry digest 缓存的虚拟模块，
// 否则重排后邻居过期；真实文件 + 模块图失效是零新机制的正确解）。
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DataEntry } from "@markopress/content";
import { ensureSynced } from "./content.ts";
import { ROOT } from "./paths.ts";
import { handlerRouteFileFor, handlerWrapperSource, routeFor } from "./plugins.ts";
import { buildSidebar } from "./sidebar.ts";

export const ROUTES_DIR = join(ROOT, ".markopress", "routes");
export const SIDEBAR_FILE = join(ROOT, ".markopress", "sidebar.json");
const PAGE_NAV_FILE = join(ROOT, ".markopress", "page-nav.js");
const URLS_FILE = join(ROOT, ".markopress", "urls.json");

/** entry id → 扁平路由文件名：index → +page.marko；a/b → a.b+page.marko */
function pageFileFor(id: string): string {
  return id === "index" ? "+page.marko" : `${id.replaceAll("/", ".")}+page.marko`;
}

function pageTemplate(collection: string, id: string, route: string): string {
  return [
    `import { data, segments, headings } from "virtual:mp/content/${collection}/${id}"`,
    `import { neighbors } from "../page-nav.js"`,
    `import sidebar from "../sidebar.json"`,
    ``,
    `<mp-page page={ data, segments, headings } nav=neighbors("${route}") flat=sidebar.flat/>`,
    ``,
  ].join("\n");
}

// 布局刻意静态：sidebar 数据走 ../sidebar.json 模块 import（非 routes 目录文件事件）。
// 「新增 page + 修改 layout 同一 watcher 批次」会触发 marko-run dev server 竞态
// 死锁（docs/spike-notes.md）——布局内容恒定 + write-if-changed ⇒ 永不重写。
// 唯一变量是功能槽位接线（slots 集变化 ⇔ config 变化 ⇔ resetSynced 全量重建路径，
// 与 md 编辑批次无关，死锁纪律不受影响）。
//
// 槽位接线：插件声明 slots: ["mp-search"] ⇒ 生成 <@search><mp-search/></@search> 属性体。
// 必须由生成器 gating——Marko 对未知 tag 是硬错误（无「空元素透传」），且 taglib 依赖探测
// 从模板就近 package.json 出发（lasso-package-root），主题包内看不到 app 依赖里的插件 taglib；
// 生成物在 .markopress/ 下，就近 root = app 根 ⇒ 探测命中（与 <mp-layout> 的发现同机制）。
function layoutTemplate(slots: Array<string>): string {
  const bodies = slots
    .filter((slot) => slot !== "mp-layout" && slot !== "mp-page")
    .map((slot) => [`  <@${slot.replace(/^mp-/, "")}>`, `    <${slot}/>`, `  </@${slot.replace(/^mp-/, "")}>`])
    .flat();
  return [
    `import sidebar from "../sidebar.json"`,
    ``,
    `<mp-layout site=sidebar.site nav=sidebar.nav tree=sidebar.tree style=sidebar.style content=input.content>`,
    ...bodies,
    `</mp-layout>`,
    ``,
  ].join("\n");
}

// 静态助手（生成一次）：flat 序 → prev/next。sidebar.json 变更经模块图自动失效本模块的
// 引用者（+page.marko 们）——重排/增删后邻居全站刷新，无新增失效机制。
const PAGE_NAV_SOURCE = `// 静态生成（scripts/gen-routes.ts）：sidebar.json 的 flat 序 → prev/next 邻居。
// 本文件永不变化；sidebar.json 变更走模块图失效（nav.json 时代的同款路径）。
import sidebar from "./sidebar.json"

export function neighbors(href) {
  const i = sidebar.flat.findIndex((page) => page.href === href)
  return i < 0
    ? { prev: null, next: null }
    : { prev: sidebar.flat[i - 1] ?? null, next: sidebar.flat[i + 1] ?? null }
}
`;

/** Write only when content differs, so no-op regenerations don't churn the watcher. */
function writeIfChanged(file: string, content: string): boolean {
  if (existsSync(file) && readFileSync(file, "utf-8") === content) return false;
  writeFileSync(file, content);
  return true;
}

export interface GenerateResult {
  routes: Array<string>;
  written: Array<string>;
}

export async function generateRoutes(): Promise<GenerateResult> {
  const { store, config, plugins, pluginCtx, theme } = await ensureSynced();
  mkdirSync(ROUTES_DIR, { recursive: true });

  // 多集合 → 同一路由空间（id 撞车是配置错误，重复覆盖会在 store 层先撞 digest）
  const pages: Array<{
    file: string;
    route: string;
    title: string;
    order?: number;
    date?: string;
    description?: string;
    collection: string;
    id: string;
  }> = [];
  for (const [name] of Object.entries(config.collections)) {
    for (const entry of store.values(name) as Array<DataEntry<{ title: string; order?: number }>>) {
      pages.push({
        collection: name,
        id: entry.id,
        file: pageFileFor(entry.id),
        route: routeFor(entry.id),
        title: entry.data.title,
        order: entry.data.order,
        date: entry.data.date instanceof Date ? entry.data.date.toISOString() : entry.data.date,
        description: entry.data.description,
      });
    }
  }
  pages.sort((a, b) => a.route.localeCompare(b.route));

  // 侧边栏：配置声明的集合（默认全部——万页夹具须显式排除，themes.md §8）
  const sidebarCollections = new Set(
    theme.options.sidebar?.collections ?? Object.keys(config.collections),
  );
  const sidebar = buildSidebar(pages.filter((p) => sidebarCollections.has(p.collection)), {
    sortBy: theme.options.sidebar?.sortBy,
  });
  const sidebarJson = {
    site: theme.options.site ?? "markopress",
    style: theme.options.style ?? "default",
    nav: theme.options.nav ?? [],
    tree: sidebar.tree,
    flat: sidebar.flat,
  };

  const expected = new Set(["+layout.marko", ...pages.map((p) => p.file)]);

  const written: Array<string> = [];
  for (const p of pages) {
    if (writeIfChanged(join(ROUTES_DIR, p.file), pageTemplate(p.collection, p.id, p.route))) {
      written.push(p.file);
    }
  }
  if (writeIfChanged(
    join(ROUTES_DIR, "+layout.marko"),
    layoutTemplate([...new Set(plugins.flatMap((p) => p.slots ?? []))]),
  )) written.push("+layout.marko");
  if (writeIfChanged(SIDEBAR_FILE, `${JSON.stringify(sidebarJson, null, 2)}\n`)) written.push("../sidebar.json");
  if (writeIfChanged(PAGE_NAV_FILE, PAGE_NAV_SOURCE)) written.push("../page-nav.js");
  if (writeIfChanged(URLS_FILE, `${JSON.stringify(pages.map((p) => p.route), null, 2)}\n`)) written.push("../urls.json");

  // 插件产出路由（routes 钩子，生成期一次；docs/plugin-design.md §3）。
  // 死锁审计：路由文件只在生成期出现/消失，内容编辑零事件；动词是静态导出。
  for (const plugin of plugins) {
    for (const route of plugin.routes?.(pluginCtx) ?? []) {
      const file = handlerRouteFileFor(route.path);
      expected.add(file);
      if (writeIfChanged(join(ROUTES_DIR, file), handlerWrapperSource(route))) {
        written.push(file);
      }
    }
  }

  // 清理失效的路由文件（md 删除/改名后的差集）
  for (const entry of readdirSync(ROUTES_DIR)) {
    if (!expected.has(entry)) {
      rmSync(join(ROUTES_DIR, entry));
      written.push(`(removed) ${entry}`);
    }
  }

  return { routes: pages.map((p) => p.route), written };
}

// CLI: node scripts/gen-routes.ts（dev/build 自动跑，手动一般不需要）
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const { routes, written } = await generateRoutes();
  console.log(`[markopress] ${routes.length} route(s): ${routes.join(", ")}`);
  if (written.length) console.log(`[markopress] wrote: ${written.join(", ")}`);
  else console.log(`[markopress] everything up to date`);
}

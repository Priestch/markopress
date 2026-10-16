// markopress 路由生成器 —— 数据源是 content store（不再扫文件）。
//
// 生成物（@marko/run 经 routesDir 原样消费）：
//   .markopress/routes/+layout.marko     静态外壳（import nav.json + Counter，永不变化）
//   .markopress/routes/+page.marko       content/index.md → /
//   .markopress/routes/<name>+page.marko a/b.md → a.b+page.marko（扁平路由）
//   .markopress/nav.json                 nav 数据（布局以模块 import；变化走模块图）
//   .markopress/urls.json                static adapter 的显式 URL 清单
//
// 页面正文不再内联：+page.marko 是极小包装，import 虚拟模块 virtual:mp/content/…。
// 因此 md 内容编辑时模板不变 ⇒ write-if-changed 全部跳过 ⇒ 本目录零文件事件；
// 只有 slug 增/删产生单个 +page.marko 事件（marko-run dev watcher 对此是安全的，
// spike 验证过；死锁纪律见 docs/spike-notes.md）。
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DataEntry } from "@markopress/content";
import { ensureSynced } from "./content.ts";
import { ROOT } from "./paths.ts";
import { handlerRouteFileFor, handlerWrapperSource, routeFor } from "./plugins.ts";

export const ROUTES_DIR = join(ROOT, ".markopress", "routes");
export const NAV_FILE = join(ROOT, ".markopress", "nav.json");
const URLS_FILE = join(ROOT, ".markopress", "urls.json");

const SITE_NAME = "markopress spike";

/** entry id → 扁平路由文件名：index → +page.marko；a/b → a.b+page.marko */
function pageFileFor(id: string): string {
  return id === "index" ? "+page.marko" : `${id.replaceAll("/", ".")}+page.marko`;
}

function pageTemplate(collection: string, id: string): string {
  // segments 循环而非 join：为 md 内 Marko 组件段留门（component 段将来只需在
  // <if> 链上加分支，不改本模板）。$!{} 插值必须包在显式标签内（concise 陷阱）。
  return [
    `import { data, segments } from "virtual:mp/content/${collection}/${id}"`,
    ``,
    `<article>`,
    `  <h1>\${data.title}</h1>`,
    `  <for|seg| of=segments>`,
    `    <if=seg.type === "html">`,
    `      $!{seg.html}`,
    `    </if>`,
    `  </for>`,
    `</article>`,
    ``,
  ].join("\n");
}

// 布局刻意静态：nav 数据走 ../nav.json 模块 import（非 routes 目录文件事件）。
// 「新增 page + 修改 layout 同一 watcher 批次」会触发 marko-run dev server 竞态
// 死锁（docs/spike-notes.md）——布局内容恒定 + write-if-changed ⇒ 永不重写。
function layoutTemplate(): string {
  return `import nav from "../nav.json"
import Counter from "../../src/components/counter.marko"

// Marko 6 的 <style> 块 = 提取且全局（scoped 是 <style/styles> 的事）——
// 这里的选择器要命中 $!{seg.html} 注入的动态内容，必须全局。
<style>
  body { margin: 0; font-family: system-ui, sans-serif; line-height: 1.6; color: #1f2328; background: #fff; }
  nav { display: flex; gap: 12px; align-items: baseline; padding: 10px 24px; border-bottom: 1px solid #d0d7de; }
  nav strong { margin-right: 8px; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
  footer { border-top: 1px solid #d0d7de; padding: 12px 24px; font-size: 13px; color: #57606a; }
  pre.shiki { padding: 12px 16px; border-radius: 8px; overflow-x: auto; line-height: 1.5; }
  .shiki code, code[class*="language-"] {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 14px;
  }

  /* ::: 容器（remark-directive → mp-container） */
  .mp-container { border-left: 3px solid #6e7781; background: #f6f8fa; padding: 10px 16px; margin: 12px 0; border-radius: 0 6px 6px 0; }
  .mp-container > :first-child { margin-top: 0; }
  .mp-container > :last-child { margin-bottom: 0; }
  .mp-tip { border-color: #0969da; background: #ddf4ff; }
  .mp-info { border-color: #1a7f37; background: #dafbe1; }
  .mp-warn { border-color: #9a6700; background: #fff8c5; }
  .mp-danger { border-color: #cf222e; background: #ffebe9; }

  /* shiki 双主题切换 + 容器暗色：light 为默认（上方），dark 覆盖必须在后——
     同特异性下后者胜，放前面会被亮色规则盖掉（实测踩坑） */
  @media (prefers-color-scheme: dark) {
    body { color: #e6edf3; background: #0d1117; }
    nav, footer { border-color: #30363d; }
    .shiki, .shiki span {
      color: var(--shiki-dark) !important;
      background-color: var(--shiki-dark-bg) !important;
      font-style: var(--shiki-dark-font-style) !important;
      font-weight: var(--shiki-dark-font-weight) !important;
      text-decoration: var(--shiki-dark-text-decoration) !important;
    }
    .mp-container { background: #161b22; }
    .mp-tip { background: #121d2f; }
    .mp-info { background: #12261e; }
    .mp-warn { background: #241d10; }
    .mp-danger { background: #2d1517; }
  }
</style>

<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${SITE_NAME}</title>
</head>
<body>
  <nav>
    <strong>${SITE_NAME}</strong>
    <for|item| of=nav>
      <a href=item.href>${"${"}item.title}</a>
    </for>
  </nav>
  <main>
    <\${input.content}/>
  </main>
  <footer>
    <Counter/>
  </footer>
</body>
</html>
`;
}

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
  const { store, config, plugins, pluginCtx } = await ensureSynced();
  mkdirSync(ROUTES_DIR, { recursive: true });

  // 多集合 → 同一路由空间（id 撞车是配置错误，重复覆盖会在 store 层先撞 digest）
  const pages: Array<{ file: string; route: string; title: string; collection: string; id: string }> = [];
  for (const [name] of Object.entries(config.collections)) {
    for (const entry of store.values(name) as Array<DataEntry<{ title: string }>>) {
      pages.push({
        collection: name,
        id: entry.id,
        file: pageFileFor(entry.id),
        route: routeFor(entry.id),
        title: entry.data.title,
      });
    }
  }
  pages.sort((a, b) => a.route.localeCompare(b.route));

  const nav = pages.map(({ route, title }) => ({ href: route, title }));
  const expected = new Set(["+layout.marko", ...pages.map((p) => p.file)]);

  const written: Array<string> = [];
  for (const p of pages) {
    if (writeIfChanged(join(ROUTES_DIR, p.file), pageTemplate(p.collection, p.id))) {
      written.push(p.file);
    }
  }
  if (writeIfChanged(join(ROUTES_DIR, "+layout.marko"), layoutTemplate())) written.push("+layout.marko");
  if (writeIfChanged(NAV_FILE, `${JSON.stringify(nav, null, 2)}\n`)) written.push("../nav.json");
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

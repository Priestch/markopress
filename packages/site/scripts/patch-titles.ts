// per-page <title> 补写（postbuild HTML patch）。
//
// marko-run 无 head 通道（融合只传 render body，源码核实过；唯一例外是 error 路由
// input）⇒ 页面标题只能在 SSG 产物上补：爬取完成后按 route→entry 映射替换 <title>
// + 注入 <meta name="description">。框架内置（每站刚需，非可选插件）。
//
// 模板：themeOptions.titleTemplate（"%s" 占位），默认 "%s"；无 data.title 的页不碰
// （保留主题渲染的站名标题）。dev 期不跑（显示站名——已知边界，记 CLAUDE.md）。
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DataEntry } from "@markopress/content";
import { ensureSynced } from "./content.ts";
import { routeFor } from "./plugins.ts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** dist HTML 文件路径 → 路由（/a/b.html → /a/b；/a/index.html → /a；index.html → /） */
function routeOf(relativePath: string): string {
  let p = relativePath.replaceAll("\\", "/").replace(/\.html$/, "");
  if (p === "index") return "/";
  if (p.endsWith("/index")) p = p.slice(0, -"/index".length);
  return `/${p}`;
}

function readdirSyncSafe(dir: string): boolean {
  try {
    readdirSync(dir);
    return true;
  } catch {
    return false;
  }
}

function walkHtml(dir: string, base: string, out: Array<string>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, base, out);
    else if (entry.name.endsWith(".html")) out.push(full.slice(base.length + 1));
  }
}

/** 爬取完成后调用：遍历 dist HTML，按路由补 title/description。返回补写页数。 */
export async function patchTitles(distRoot: string): Promise<number> {
  // Vite 多环境构建下 closeBundle 每环境触发一次，早次调用时产物未落——静默跳过，
  // 最终一次（爬取完成后）生效
  if (!readdirSyncSafe(distRoot)) return 0;
  const { store, config, theme } = await ensureSynced();
  const template = theme.options.titleTemplate ?? "%s";

  // route → { title, description }（全部集合——标题补写不受侧边栏集合过滤影响）
  const byRoute = new Map<string, { title?: string; description?: string }>();
  for (const name of Object.keys(config.collections)) {
    for (const entry of store.values(name) as Array<DataEntry>) {
      const data = entry.data as { title?: string; description?: string };
      byRoute.set(routeFor(entry.id), { title: data.title, description: data.description });
    }
  }

  let patched = 0;
  const files: Array<string> = [];
  walkHtml(distRoot, distRoot, files);
  for (const relative of files) {
    const hit = byRoute.get(routeOf(relative));
    if (!hit?.title) continue; // 无标题的页（如 404）保留主题渲染的站名标题
    const full = join(distRoot, relative);
    let html = readFileSync(full, "utf-8");
    const title = escapeHtml(template.replace("%s", hit.title));
    if (!html.includes("<title>")) continue;
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
    if (hit.description && !html.includes('name="description"')) {
      html = html.replace(
        /<\/title>/,
        `</title>\n  <meta name="description" content="${escapeHtml(hit.description)}">`,
      );
    }
    writeFileSync(full, html);
    patched++;
  }
  return patched;
}

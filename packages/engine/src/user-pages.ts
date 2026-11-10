// 用户自定义页的非派生路由通道（docs/custom-pages-design.md §4.1/§4.6）。
//
// 组件页是代码不是数据——不进 store、不进 content layer；本模块把它以**薄包装**并入
// 生成树：`pages/about.marko` → `.markopress/routes/_pages/about+page.marko`，包装只
// 显式 import 用户真身（与生成器显式 import 主题组件同一模式），用户文件原地不动：
//   ① 页内相对 import 按真实位置解析（拷贝会断深度、symlink 三重兼容坑）；
//   ② 改页面内容 = 模块图失效，routes 目录零文件事件（死锁面最小）；
//   ③ taglib 按模板真实位置就近发现；包装是 .marko→.marko 闭包，hydrate 语义不变。
// 增/删/改名 = 单个包装文件事件 → markopack watchRoutes 进程内增量 re-walk。
//
// 命名约束（v1，fail fast）：`[`（动态段——SSG 爬虫不覆盖）、`+` 前缀（marko-run
// 保留角色名，组 layout 属 4.4-b 禁区）、`_` 前缀（pathless 语义对用户是惊喜）、
// 文件名含 `.`（marko-run 扁平路由的段分隔符——嵌套请用目录）。
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

/** 已被其它来源占用的路由：route → 来源描述（撞车报错指明双方） */
export type TakenRoutes = Map<string, string>;

export interface UserPage {
  /** 相对 pages/ 的路径（.marko 结尾，/ 分隔） */
  rel: string;
  /** 生成侧文件名（扁平约定，落在 _pages/ 下） */
  file: string;
  /** URL（与集合投影同款 routeFor 语义） */
  route: string;
}

/** 用户页相对路径 → 生成文件名：index → +page.marko；404 → +404.marko（marko-run
 *  NotFound 约定，与集合通道 pageFileFor 的 404 特例同款——用户 404 页同样是
 *  「未知路由渲染 + 404 状态」的兜底语义；其余 a/b → a.b+page.marko。
 *  嵌套 index（guide/index.marko）与集合通道 routeIdFor 同款剥 /index 尾——
 *  落 guide+page.marko 服务 /guide；不剥会落 guide.index+page.marko，marko-run
 *  只按字面段服务 /guide/index（2026-11-11 pdflux /guide 实测踩中）。 */
export function userPageFileFor(rel: string): string {
  const id = rel.replace(/\.marko$/, "");
  if (id === "404") return "+404.marko";
  const routeId = id === "index" ? "" : id.replace(/\/index$/, "");
  return routeId === "" ? "+page.marko" : `${routeId.replaceAll("/", ".")}+page.marko`;
}

/** 递归扫描 pages/，只认 .marko；违禁命名 fail fast（错误信息含改法指引） */
export function scanUserPages(pagesDir: string): Array<UserPage> {
  if (!existsSync(pagesDir)) return [];
  const pages: Array<UserPage> = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        validateSegment(entry.name, rel);
        walk(join(dir, entry.name), rel);
        continue;
      }
      if (!entry.name.endsWith(".marko")) continue; // 辅助文件（.ts 等）经 import 生效，不产路由
      validateSegment(entry.name.replace(/\.marko$/, ""), rel);
      const id = rel.replace(/\.marko$/, "");
      const routeId = id === "index" ? "" : id.replace(/\/index$/, "");
      pages.push({ rel, file: userPageFileFor(rel), route: routeId === "" ? "/" : `/${routeId}` });
    }
  };
  walk(pagesDir, "");
  return pages;
}

function validateSegment(stem: string, rel: string): void {
  if (stem.startsWith("[")) {
    throw new Error(`[markopress] pages/${rel}：动态段 v1 不支持（SSG 爬虫不覆盖带参数路由）——用固定路径`);
  }
  if (stem.startsWith("+")) {
    throw new Error(`[markopress] pages/${rel}：\`+\` 前缀是 marko-run 保留角色名（组 layout 见 custom-pages-design §4.4-b，v1 禁）`);
  }
  if (stem.startsWith("_")) {
    throw new Error(`[markopress] pages/${rel}：\`_\` 前缀是 marko-run pathless group 语义，v1 禁用`);
  }
  if (stem.includes(".")) {
    throw new Error(`[markopress] pages/${rel}：文件名含 \`.\`（marko-run 扁平路由的段分隔符）——嵌套请用目录`);
  }
}

/** 薄包装源码：只显式 import 用户真身 + 透传输入（params/query 等经 spread 转发） */
export function userPageWrapperSource(userFile: string, wrapperDir: string): string {
  const ref = relative(wrapperDir, userFile).replaceAll("\\", "/");
  return `import Page from "${ref}"\n\n<Page ...input/>\n`;
}

/** Write only when content differs, so no-op regenerations don't churn the watcher.
 *  （gen-routes.ts 同款私有助手——那边不能导出给本模块：gen-routes import 本模块，反向成环） */
function writeIfChanged(file: string, content: string): boolean {
  if (existsSync(file) && readFileSync(file, "utf-8") === content) return false;
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, content);
  return true;
}

export interface MergeResult {
  written: Array<string>;
  removed: Array<string>;
  /** 用户 404 页存在（包装已落 routes 根）——调用方据此把 +404.marko 并入根级
   *  期望集，用户撤走 404 时根级差集清理才能接管（见 gen-routes） */
  hasNotFoundPage: boolean;
}

/**
 * 全量 merge：扫描 pages/ → 撞车校验（对 taken）→ write-if-changed 包装 → _pages/
 * 按用户目录镜像差集清理（用户删源 ⇒ 包装失配被清；pages/ 空 ⇒ _pages/ 整目录消失）。
 * 幂等：无变化批次零写入（watcher 零事件）。
 */
export function mergeUserPages(pagesDir: string, routesDir: string, taken: TakenRoutes): MergeResult {
  const pages = scanUserPages(pagesDir);
  const wrapperDir = join(routesDir, "_pages");
  const written: Array<string> = [];
  const removed: Array<string> = [];

  // 撞车 fail fast（§4.6）：不做优先级遮蔽——隐式遮蔽的站行为不可推理
  for (const page of pages) {
    const owner = taken.get(page.route);
    if (owner) {
      throw new Error(
        `[markopress] 路由撞车：pages/${page.rel} 出的 "${page.route}" 已被 ${owner} 占用——改用户页名或移除对方，二选一`,
      );
    }
    taken.set(page.route, `pages/${page.rel}`);
  }

  // +404 是根特例（marko-run 约定根目录无前缀才有 NotFound 身位）：包装落 routes 根，
  // 不进 _pages/；根级差集清理由调用方把 file 并入 expectedRoot 后统一做
  const notFoundFile = "+404.marko";
  const hasNotFoundPage = pages.some((p) => p.file === notFoundFile);
  const expected = new Set(pages.filter((p) => p.file !== notFoundFile).map((p) => p.file));
  if (pages.length > 0) {
    mkdirSync(wrapperDir, { recursive: true });
    for (const page of pages) {
      const source = join(pagesDir, page.rel);
      const targetDir = page.file === notFoundFile ? routesDir : wrapperDir;
      if (writeIfChanged(join(targetDir, page.file), userPageWrapperSource(source, targetDir))) {
        written.push(page.file === notFoundFile ? page.file : `_pages/${page.file}`);
      }
    }
  }
  // 镜像差集清理：_pages/ 里一切不在当前用户目录投影里的都是失配物（含 pages/ 空时整目录）
  if (existsSync(wrapperDir)) {
    if (pages.length === 0) {
      rmSync(wrapperDir, { recursive: true });
      removed.push("_pages/");
    } else {
      for (const entry of readdirSync(wrapperDir)) {
        if (!expected.has(entry)) {
          rmSync(join(wrapperDir, entry));
          removed.push(`(removed) _pages/${entry}`);
        }
      }
    }
  }
  return { written, removed, hasNotFoundPage };
}

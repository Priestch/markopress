// 用户自定义页非派生通道测试（docs/custom-pages-design.md §6）。
// mergeUserPages / pruneGeneratedTree 是纯函数（目录进目录出）——不需要站点 fixture；
// 树迁移自愈与「用户文件不被清理」在 pruneGeneratedTree 层验证。
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pruneGeneratedTree } from "../src/gen-routes.ts";
import { mergeUserPages, scanUserPages, userPageFileFor } from "../src/user-pages.ts";

let root: string;
let pagesDir: string;
let routesDir: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "mp-user-pages-"));
  pagesDir = join(root, "pages");
  // 镜像真实树（app 根 pages/ 与 .markopress/routes/ 的相对深度）——包装 import
  // 路径形状（../../../pages/…）随此钉住
  routesDir = join(root, ".markopress", "routes");
  mkdirSync(join(routesDir, "_content"), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const writePage = (rel: string): void => {
  const file = join(pagesDir, rel);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, "<p>page</p>");
};

describe("scanUserPages 文件名映射与命名禁令", () => {
  it("index → /；嵌套目录 → 深路径；非 .marko 不产路由", () => {
    writePage("index.marko");
    writePage("about.marko");
    writePage("pricing/team.marko");
    writePage("helper.ts");
    const pages = scanUserPages(pagesDir);
    expect(pages.map((p) => p.route).sort()).toEqual(["/", "/about", "/pricing/team"]);
    expect(pages.find((p) => p.rel === "pricing/team.marko")?.file).toBe("pricing.team+page.marko");
    expect(userPageFileFor("index.marko")).toBe("+page.marko");
  });

  it.each(["[slug].marko", "+layout.marko", "_group/x.marko", "v1.2.marko"])(
    "违禁命名 fail fast：%s",
    (rel) => {
      writePage(rel);
      expect(() => scanUserPages(pagesDir)).toThrow(/\[markopress\]/);
    },
  );
});

describe("mergeUserPages 薄包装与镜像清理", () => {
  it("写入包装（显式 import 用户真身）+ 幂等（二次零写入）", () => {
    writePage("about.marko");
    const first = mergeUserPages(pagesDir, routesDir, new Map());
    expect(first.written).toEqual(["_pages/about+page.marko"]);
    const wrapper = join(routesDir, "_pages", "about+page.marko");
    expect(readFileSync(wrapper, "utf-8")).toContain(
      `import Page from "../../../pages/about.marko"`,
    );
    expect(readFileSync(wrapper, "utf-8")).toContain("<Page ...input/>");
    const second = mergeUserPages(pagesDir, routesDir, new Map());
    expect(second.written).toEqual([]);
    expect(second.removed).toEqual([]);
  });

  it("路由撞车 fail fast：报冲突双方", () => {
    writePage("index.marko");
    const taken = new Map([["/", '集合 entry "index"']]);
    expect(() => mergeUserPages(pagesDir, routesDir, taken)).toThrow(
      /pages\/index\.marko.*集合 entry "index"/,
    );
  });

  it("删源 → 包装清理；pages 空 → _pages 目录消失", () => {
    writePage("a.marko");
    writePage("b.marko");
    mergeUserPages(pagesDir, routesDir, new Map());
    rmSync(join(pagesDir, "b.marko"));
    const after = mergeUserPages(pagesDir, routesDir, new Map());
    expect(after.removed).toContain("(removed) _pages/b+page.marko");
    expect(existsSync(join(routesDir, "_pages", "a+page.marko"))).toBe(true);
    rmSync(join(pagesDir, "a.marko"));
    mergeUserPages(pagesDir, routesDir, new Map());
    expect(existsSync(join(routesDir, "_pages"))).toBe(false);
  });
});

describe("pruneGeneratedTree 按来源差集清理", () => {
  it("用户包装不被根清理吃掉；旧树顶层残留迁移自愈消失", () => {
    // 新树（§4.2 形态）
    writeFileSync(join(routesDir, "_content", "+layout.marko"), "layout");
    writeFileSync(join(routesDir, "_content", "guide.intro+page.marko"), "page");
    mkdirSync(join(routesDir, "_pages"));
    writeFileSync(join(routesDir, "_pages", "about+page.marko"), "wrapper");
    // 旧树残留（升级前形态：顶层平铺 + 根 layout）
    writeFileSync(join(routesDir, "+layout.marko"), "old layout");
    writeFileSync(join(routesDir, "guide.intro+page.marko"), "old page");

    const removed = pruneGeneratedTree(
      routesDir,
      new Set(["_content", "+404.marko"]),
      new Set(["+layout.marko", "guide.intro+page.marko"]),
    );
    expect(removed).toContain("(removed) +layout.marko");
    expect(removed).toContain("(removed) guide.intro+page.marko");
    // _pages 镜像自管（根清理只认组目录本身）；_content 内容按派生清单保留
    expect(existsSync(join(routesDir, "_pages", "about+page.marko"))).toBe(true);
    expect(existsSync(join(routesDir, "_content", "+layout.marko"))).toBe(true);
    expect(existsSync(join(routesDir, "+layout.marko"))).toBe(false);
  });
});

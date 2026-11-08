// 集合路由前缀（route.prefix）测试：routeIdFor 校验/拼接 + routeFor/pageFileFor
// 的尾段 index 折叠（带前缀集合的 index = 集合着陆页 /<prefix>）。
import { describe, expect, it } from "vitest";
import { pageFileFor } from "../src/gen-routes.ts";
import { routeFor, routeIdFor } from "../src/plugins.ts";

describe("routeIdFor 集合路由前缀", () => {
  it("prefix 拼在 entry id 前；无 prefix 原样透传", () => {
    expect(routeIdFor(undefined, "intro")).toBe("intro");
    expect(routeIdFor("guide", "intro")).toBe("guide/intro");
    expect(routeIdFor("docs/guide", "intro")).toBe("docs/guide/intro");
  });

  it("entry 404 禁带前缀（根特例文件名是 special 身位的全部）", () => {
    expect(() => routeIdFor("guide", "404")).toThrow(/404.*无前缀/s);
  });

  it.each(["", "/guide", "guide/", "gui.de", "[slug]", "a//b"])(
    "非法前缀 fail fast：%s",
    (prefix) => {
      expect(() => routeIdFor(prefix, "intro")).toThrow(/\[markopress\]/);
    },
  );
});

describe("尾段 index 折叠（带前缀集合的着陆页）", () => {
  it("routeFor：guide/index → /guide；index → /；普通路径不变", () => {
    expect(routeFor("index")).toBe("/");
    expect(routeFor("guide/index")).toBe("/guide");
    expect(routeFor("guide/intro")).toBe("/guide/intro");
    expect(routeFor("a/b")).toBe("/a/b");
  });

  it("pageFileFor：guide/index → guide+page.marko（URL /guide 的扁平名）", () => {
    expect(pageFileFor("index")).toBe("+page.marko");
    expect(pageFileFor("guide/index")).toBe("guide+page.marko");
    expect(pageFileFor("guide/intro")).toBe("guide.intro+page.marko");
    expect(pageFileFor("404")).toBe("+404.marko");
  });
});

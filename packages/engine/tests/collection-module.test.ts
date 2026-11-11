// 集合级数据模块（virtual:mp/collection/<name>，strapi-loader-design §6）：
// 源码形状（client-safe——聚合 meta 模块而非内容模块，html 正文不进 client 图）
// + 内置三件对 route:false 集合（urlOf=null）的跳过。
import { describe, expect, it, vi } from "vitest";
import { renderCollectionModule } from "../src/content-modules.ts";
import { sitemap } from "../src/builtins/sitemap.ts";
import { rss } from "../src/builtins/rss.ts";
import { search } from "../src/builtins/search.ts";
import type { DataEntry } from "../src/content/index.ts";

const entry = (id: string, slug = id): DataEntry => ({ id, slug, data: {} }) as DataEntry;

describe("renderCollectionModule", () => {
  it("空集合导出空数组（消费方拿到稳定形状）", () => {
    expect(renderCollectionModule("changelog", [])).toContain("export const entries = []");
  });

  it("聚合 per-entry meta 模块（client-safe）：import 引用 + entries 投影；不带 html 正文", () => {
    const source = renderCollectionModule("changelog", [entry("42", "v1-2-3"), entry("43")]);
    expect(source).toContain(
      'import { data as data0, headings as headings0 } from "virtual:mp/meta/changelog/42";',
    );
    expect(source).toContain(
      'import { data as data1, headings as headings1 } from "virtual:mp/meta/changelog/43";',
    );
    expect(source).toContain('{ id: "42", slug: "v1-2-3", data: data0, headings: headings0 },');
    // 红线：segments（html 渲染载荷）不得出现在集合模块——交互组件（nav 等）经它拿
    // 标题/列表时，不能把全集合正文烤进浏览器共享 chunk（resumability 下是纯死重）
    expect(source).not.toContain("segments");
    // 引用而非内联：per-entry digest 缓存各自生效，纯内容编辑下本文件字节不变
    // （rspack 侧 write-if-changed 吸收 ⇒ 零文件事件，meta 模块沿编译图传播）
    expect(source).not.toMatch(/"data"\s*:/);
  });
});

/** 最小 PluginCtx 假体：docs = 有路由集合；changelog = route:false（urlOf → null） */
function makeCtx() {
  const written: Record<string, unknown> = {};
  const render = vi.fn(async () => ({ segments: [{ type: "html", html: "<p>正文</p>" }] }));
  const ctx = {
    config: { collections: { docs: {}, changelog: {} } },
    store: {
      values: (name: string) =>
        name === "docs"
          ? [
              { id: "a", slug: "a", data: { title: "A", date: "2026-01-02" } },
              { id: "b", slug: "b", data: { title: "B", date: "2026-01-03" } },
            ]
          : [{ id: "42", slug: "v1", data: { title: "Changelog 条目" } }],
    },
    // docs 有路由、changelog route:false —— urlOf 的 null 语义由装配层（content.ts）保证
    urlOf: (collection: string, id: string) => (collection === "docs" ? `/${id}` : null),
    render,
    setData: async (name: string, value: unknown) => {
      written[name] = value;
    },
  };
  return { ctx, written, render };
}

describe("route:false 集合在内置三件的跳过（urlOf=null）", () => {
  it("sitemap：null 条目不进 URL 集", async () => {
    const { ctx, written } = makeCtx();
    await sitemap({ site: "https://x.test" }).contentSynced!(ctx as never);
    expect((written.sitemap as { urls: string[] }).urls).toEqual(["/a", "/b"]);
  });

  it("rss：null 条目不进 feed", async () => {
    const { ctx, written } = makeCtx();
    await rss({ site: "https://x.test" }).contentSynced!(ctx as never);
    const items = (written.rss as { items: Array<{ path: string }> }).items;
    expect(items.map((i) => i.path)).toEqual(["/b", "/a"]); // date 倒序
  });

  it("search：null 条目不建索引（渲染也被跳过，省成本）", async () => {
    const { ctx, written, render } = makeCtx();
    await search().contentSynced!(ctx as never);
    expect(render).toHaveBeenCalledTimes(2); // 只有 docs 的两条
    expect(JSON.stringify(written.search)).not.toContain("changelog/42");
  });
});

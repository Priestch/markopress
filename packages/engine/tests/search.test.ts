// search 插件单测：节切分（纯函数）+ MiniSearch 序列化往返（服务端建 → 浏览器 loadJSON）。
// 往返是双端契约：loadJSON 需要与服务端相同的 options（含 tokenize 函数，不经 JSON 传递）。
import { describe, expect, it } from "vitest";
import MiniSearch from "minisearch";
import { buildSearchDocs, htmlToText, search } from "../src/builtins/search.ts";
import { SEARCH_OPTIONS, tokenize, type SearchDoc } from "../src/builtins/search-options.ts";

describe("htmlToText", () => {
  it("strips tags and decodes basic entities", () => {
    expect(htmlToText('<p>a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;</p>')).toBe('a & b <c> "d" \'e\'');
  });

  it("drops script/style content entirely", () => {
    expect(htmlToText("keep<script>drop()</script>keep<style>.x{}</style>")).toBe("keep keep");
  });

  it("collapses whitespace", () => {
    expect(htmlToText("<p>a\n\t  b</p>")).toBe("a b");
  });

  it("keeps code block text searchable", () => {
    expect(htmlToText("<pre><code>pnpm dev</code></pre>")).toBe("pnpm dev");
  });
});

describe("buildSearchDocs", () => {
  const page = { collection: "docs", id: "guide/start", title: "起步", url: "/guide/start" };

  it("splits sections at h2/h3 with ids and deep-links", () => {
    const html = [
      "引言文字",
      '<h2 id="install">安装</h2>',
      "<p>先装依赖</p>",
      '<h3 id="pnpm">用 pnpm</h3>',
      "<p>pnpm install</p>",
    ].join("");
    const docs = buildSearchDocs(html, page);
    expect(docs.map((d) => d.id)).toEqual([
      "docs/guide/start",
      "docs/guide/start#install",
      "docs/guide/start#pnpm",
    ]);
    expect(docs[1]).toMatchObject({ url: "/guide/start#install", heading: "安装", text: "先装依赖" });
    expect(docs[2]).toMatchObject({ heading: "用 pnpm", text: "pnpm install" });
  });

  it("whole page is one doc when no h2/h3", () => {
    const docs = buildSearchDocs("<p>只有一段</p>", page);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ id: "docs/guide/start", heading: "" });
  });

  it("ignores deeper headings (stay inside their section) and h1", () => {
    const html = '<h1 id="top">标题</h1><p>a</p><h4 id="deep">小节</h4><p>b</p>';
    const docs = buildSearchDocs(html, page);
    expect(docs).toHaveLength(1);
    expect(docs[0].text).toContain("小节");
  });

  it("discards empty sections", () => {
    const html = '<h2 id="a">A</h2><h2 id="b">B</h2><p>内容</p>';
    const docs = buildSearchDocs(html, page);
    expect(docs.map((d) => d.id)).toEqual(["docs/guide/start#b"]);
  });
});

describe("MiniSearch roundtrip (server build → browser loadJSON)", () => {
  it("serializes and searches identically after loadJSON", () => {
    const docs = buildSearchDocs(
      '引言：配置文件 <code>markopress.config.ts</code><h2 id="theme">主题配置</h2><p>theme 字段选择主题包</p>',
      { collection: "docs", id: "index", title: "配置", url: "/" },
    );
    const server = new MiniSearch<SearchDoc>(SEARCH_OPTIONS);
    server.addAll(docs);

    // setData 落盘 → 浏览器侧 loadJSON（options 双端同源 = src/search-options.ts）
    const client = MiniSearch.loadJSON<SearchDoc>(JSON.stringify(server.toJSON()), SEARCH_OPTIONS);

    const latin = client.search("markopress", { limit: 5 });
    expect(latin.length).toBeGreaterThan(0);
    expect(latin[0].url).toBe("/");

    // CJK：默认分词下整句是单 token，前缀只能命中句首——自定义 tokenize 逐字后任意位置可搜
    const cjk = client.search("主题");
    expect(cjk.length).toBeGreaterThan(0);
    expect(cjk[0].heading).toBe("主题配置");
  });

  it("tokenize keeps latin words whole and CJK per character", () => {
    expect(tokenize("markopress 配置指南 vite")).toEqual(["markopress", "配", "置", "指", "南", "vite"]);
  });
});

describe("search() plugin", () => {
  function makeCtx() {
    const values: Record<string, Array<Record<string, unknown>>> = {};
    const written: Array<{ name: string; value: unknown }> = [];
    return {
      ctx: {
        config: { collections: { docs: {}, news: {} } },
        store: {
          values: (name: string) => values[name] ?? [],
          get: (name: string, id: string) => (values[name] ?? []).find((e) => e.id === id),
        },
        urlOf: (_c: string, id: string) => (id === "index" ? "/" : `/${id}`),
        render: async (entry: Record<string, unknown>) => ({
          segments: [{ type: "html", html: `<h2 id="s">${entry.title as string}</h2><p>${entry.body as string}</p>` }],
        }),
        setData: async (name: string, value: unknown) => {
          written.push({ name, value });
        },
      },
      values,
      written,
    };
  }

  it("full round indexes all entries of configured collections and writes data module", async () => {
    const { ctx, values, written } = makeCtx();
    values.docs = [
      { id: "a", slug: "a", data: { title: "Alpha" }, body: "alpha body", title: "Alpha", contentType: "text/markdown" },
    ];
    values.news = [{ id: "n", slug: "n", data: { title: "News" }, body: "news body", title: "News" }];
    const plugin = search({ collections: ["docs"] });
    await plugin.contentSynced(ctx, undefined);
    expect(written).toHaveLength(1);
    expect(written[0].name).toBe("search");
  });

  it("incremental round updates only changed pages", async () => {
    const { ctx, values, written } = makeCtx();
    values.docs = [{ id: "a", slug: "a", data: { title: "Alpha" }, body: "old text", title: "Alpha" }];
    const plugin = search({ collections: ["docs"] });
    await plugin.contentSynced(ctx, undefined);

    // 改 a 页正文 + 删 b 页（b 从未入过索引——幂等 discard 不炸）
    values.docs[0].body = "brand new text";
    await plugin.contentSynced(ctx, {
      changed: [{ collection: "docs", id: "a" }],
      removed: [{ collection: "docs", id: "b" }],
    });

    expect(written).toHaveLength(2);
    const last = written[1].value as { index: { documentCount: number } };
    expect(last.index.documentCount).toBe(1); // a 的一节，b 无残留

    // 增量后的索引可搜到新文本
    const payload = written[1].value as { index: ReturnType<MiniSearch<SearchDoc>["toJSON"]> };
    const client = MiniSearch.loadJSON<SearchDoc>(JSON.stringify(payload.index), SEARCH_OPTIONS);
    expect(client.search("brand")[0]?.title).toBe("Alpha");
  });
});

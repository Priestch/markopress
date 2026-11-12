// ssg.urls 接线单测：snapshotCollections（条目快照形状/空集合）+ ssgAdapterOptions
// （数组透传/函数形 routes 归一与快照注入/无 urls 空选项）。消费端 rspack-build.ts
// 只做拼装（ensureSynced 单例 + staticAdapter(options)），逻辑全在这两个纯函数里。
import { describe, expect, it } from "vitest";
import { snapshotCollections, ssgAdapterOptions, type SsgCollectionEntry } from "../src/ssg.ts";
import type { DataEntry } from "../src/content/types.ts";

function entry(id: string, slug: string, title: string): DataEntry {
	return {
		id,
		slug,
		data: { title },
		// body/contentType 有也不进快照——URL 派生只需要 id/slug/data
		body: `# ${title}`,
		contentType: "text/markdown",
	} as DataEntry;
}

const store = {
	values(name: string): Array<DataEntry> {
		const blog = [entry("1", "openai-introduces-gpts", "OpenAI introduces GPTs")];
		const categories = [entry("9", "product", "Product")];
		return name === "blog" ? blog : name === "blogCategories" ? categories : [];
	},
};

describe("snapshotCollections", () => {
	it("快照每集合条目只含 id/slug/data（body 不进）", () => {
		const snap = snapshotCollections(store, { blog: {}, blogCategories: {} });
		expect(Object.keys(snap).sort()).toEqual(["blog", "blogCategories"]);
		const blog = snap.blog as SsgCollectionEntry[];
		expect(blog).toHaveLength(1);
		expect(blog[0]).toEqual({
			id: "1",
			slug: "openai-introduces-gpts",
			data: { title: "OpenAI introduces GPTs" },
		});
	});

	it("空集合（loader 返回零条）快照为空数组而非缺键", () => {
		const snap = snapshotCollections(store, { empty: {} });
		expect(snap.empty).toEqual([]);
	});
});

describe("ssgAdapterOptions", () => {
	it("无 urls（未配置）= 空选项，不碰 adapter 默认行为", () => {
		expect(ssgAdapterOptions(undefined, {})).toEqual({});
	});

	it("数组形原样透传", () => {
		const opts = ssgAdapterOptions(["/a/", "/b/"], {});
		expect(opts).toEqual({ urls: ["/a/", "/b/"] });
	});

	it("函数形：routes 形状归一（Route.path.path → path）+ 注入集合快照", async () => {
		let seenRoutes: Array<{ path: string }> | undefined;
		let seenCollections: Record<string, Array<SsgCollectionEntry>> | undefined;
		const opts = ssgAdapterOptions(({ routes, collections }) => {
			seenRoutes = routes;
			seenCollections = collections;
			return (collections.blog ?? []).map((e) => `/blog/${e.slug}`);
		}, snapshotCollections(store, { blog: {} }));

		const urlsFn = opts.urls as (routes: unknown[]) => Promise<string[]>;
		const urls = await urlsFn([
			{ path: { path: "/blog/$slug" }, keys: [], pattern: {} }, // marko-run Route 的多余字段应被无视
		]);

		expect(seenRoutes).toEqual([{ path: "/blog/$slug" }]);
		expect(seenCollections?.blog?.[0]?.slug).toBe("openai-introduces-gpts");
		expect(urls).toEqual(["/blog/openai-introduces-gpts"]);
	});

	it("函数形可返回 Promise（远端派生场景同通道）", async () => {
		const opts = ssgAdapterOptions(
			async ({ collections }) => (collections.blog ?? []).map((e) => `/blog/${e.slug}`),
			snapshotCollections(store, { blog: {} }),
		);
		const urls = await (opts.urls as (r: unknown[]) => Promise<string[]>)([
			{ path: { path: "/blog/$slug" } },
		]);
		expect(urls).toEqual(["/blog/openai-introduces-gpts"]);
	});
});

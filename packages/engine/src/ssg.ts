// SSG 显式页面清单（build 期；rspack-build.ts 消费）。
//
// 参数路由（marko-run 原生 $slug/$$rest 用户页——如 /blog/$slug 详情）无法被
// adapter-static 爬虫枚举（爬虫只跟 <a> 链接，链接可达性 ≠ 全量内容）。本模块把
// config.ssg.urls 接到 adapter-static 的 Options.urls：
//   - 数组形：原样透传；
//   - 函数形：收 { routes, collections }——collections 是 **sync 后的集合条目快照**
//     （route:false 集合派生详情路径不需要二次拉远端），routes 归一为 { path }
//     （adapter 的 marko-run Route.path.path → path 字符串）。
import type { DataEntry } from "./content/types.ts";

export interface SsgCollectionEntry {
	id: string;
	slug: string;
	data: Record<string, unknown>;
}

export interface SsgUrlContext {
	/** marko-run 路由表（path = 路由模式串，如 "/blog/$slug"） */
	routes: Array<{ path: string }>;
	/** sync 后的集合条目快照（按集合名；只有派生 URL 需要的 id/slug/data，无 body） */
	collections: Record<string, Array<SsgCollectionEntry>>;
}

export type SsgUrls = string[] | ((ctx: SsgUrlContext) => string[] | Promise<string[]>);

/** config.ssg：SSG 显式页面清单（MarkoPressConfig.ssg 的类型）。 */
export interface SsgOptions {
	urls?: SsgUrls;
}

/** 集合条目快照：body 不进（体积与泄漏面——URL 派生只需要 id/slug/data）。 */
export function snapshotCollections(
	store: { values(name: string): Array<DataEntry> },
	collections: Record<string, unknown>,
): Record<string, Array<SsgCollectionEntry>> {
	return Object.fromEntries(
		Object.keys(collections).map((name) => [
			name,
			store.values(name).map((entry) => ({
				id: entry.id,
				slug: entry.slug,
				data: entry.data as Record<string, unknown>,
			})),
		]),
	);
}

/**
 * config.ssg.urls → adapter-static Options.urls。routes 形状归一：
 * marko-run Route（{ path: { path } } 结构）→ { path: string }，配置回调不认上游类型。
 * 返回类型与 adapter-static 的 Options.urls 结构兼容（无需 import 上游类型）。
 */
export function ssgAdapterOptions(
	urls: SsgUrls | undefined,
	snapshot: Record<string, Array<SsgCollectionEntry>>,
): { urls?: string[] | ((routes: Array<{ path?: { path?: string } }>) => Promise<string[]>) } {
	if (urls === undefined) return {};
	if (Array.isArray(urls)) return { urls };
	return {
		urls: async (routes: Array<{ path?: { path?: string } }>) =>
			urls({
				routes: routes.map((r) => ({
					path: typeof r.path === "object" && r.path !== null ? r.path.path : String(r.path),
				})),
				collections: snapshot,
			}),
	};
}

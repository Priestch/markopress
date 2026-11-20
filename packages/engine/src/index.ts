// 引擎公共出口。主体（rspack 路径）经 bin 消费；Vite 对照路径的插件经 "./vite"
// 子路径（vite 仅 devDep——不进发布依赖，rspack 用户配置装载不触发 vite 解析）。
export { defineMarkoPressConfig } from "./plugins.ts";
// 内容层用户面（app 配置文件一站式 import；getCollection/getEntry 经 "./content" 子路径
// 供深度用户——typegen 的 interface 增广也挂那个模块）
export { defineCollection, defineContentConfig, defineLoader, getCollection, getEntry } from "./content/index.ts";
// 自定义 loader 作者面（契约语义见 packages/engine/CONTRACT.md；编写指南 docs/custom-loaders.md）
export type {
	DataEntry,
	ContentConfig,
	CollectionConfig,
	Loader,
	LoaderContext,
	DataStore,
	MetaStore,
	EntryType,
	FileChangeEvent,
	FileChangeResult,
	Logger,
} from "./content/index.ts";
export { glob } from "./content/loaders/glob.ts";
export { strapi } from "./content/loaders/strapi.ts";
export type { StrapiOptions } from "./content/loaders/strapi.ts";
export type { MarkoPressConfig, ThemeConfig, ThemeOptions } from "./plugins.ts";
export { patchTitles } from "./patch-titles.ts";
// 内置三件（原独立插件包，2026-10-29 并入——功能开关而非换件单元，不值得单独成包；
// 插件契约不变，第三方仍可发布自己的 markopress-plugin-*）
export { rss } from "./builtins/rss.ts";
export { sitemap } from "./builtins/sitemap.ts";
export { search } from "./builtins/search.ts";
export { ROOT, ensureSynced } from "./content.ts";

// 引擎公共出口。主体（rspack 路径）经 bin 消费；此处导出的是仓库内 Vite 对照
// 路径与工具脚本需要的面（packages/site 的 vite.config / patch-titles-vite）。
export { markopressPlugin } from "./markopress-plugin.ts";
export { defineMarkoPressConfig } from "./plugins.ts";
// 内容层用户面（app 配置文件一站式 import；getCollection/getEntry 经 "./content" 子路径
// 供深度用户——typegen 的 interface 增广也挂那个模块）
export { defineCollection, defineContentConfig, getCollection, getEntry } from "./content/index.ts";
export type { DataEntry, ContentConfig, CollectionConfig } from "./content/index.ts";
export { glob } from "./content/loaders/glob.ts";
export type { MarkoPressConfig, ThemeOptions } from "./plugins.ts";
export { patchTitles } from "./patch-titles.ts";
// 内置三件（原独立插件包，2026-10-29 并入——功能开关而非换件单元，不值得单独成包；
// 插件契约不变，第三方仍可发布自己的 markopress-plugin-*）
export { rss } from "./builtins/rss.ts";
export { sitemap } from "./builtins/sitemap.ts";
export { search } from "./builtins/search.ts";
export { ROOT, ensureSynced } from "./content.ts";

// markopress 管线与插件配置（与 content.config.ts 分工：那边管数据源，这边管管线/插件）。
// 契约：docs/plugin-design.md。变更本文件 → 两路 dev watcher 都触发全量重建。
import { defineMarkoPressConfig } from "./scripts/plugins.ts";
import { sitemap } from "@markopress/plugin-sitemap";

export default defineMarkoPressConfig({
  // markdown 管线（R1）：shiki 默认开；remarkPlugins/rehypePlugins 直通 unified。
  // 改这里 → 两路 watcher 都触发全量重建（renderer 重建，缓存新鲜）。
  markdown: {
    shiki: { themes: { light: "github-light", dark: "github-dark" } },
  },
  plugins: [
    sitemap({ site: "https://markopress.example.com" }),
  ],
});

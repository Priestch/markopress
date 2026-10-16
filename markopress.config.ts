// markopress 管线与插件配置（与 content.config.ts 分工：那边管数据源，这边管管线/插件）。
// 契约：docs/plugin-design.md。变更本文件 → 两路 dev watcher 都触发全量重建。
import { defineMarkoPressConfig } from "./scripts/plugins.ts";
import { sitemap } from "@markopress/plugin-sitemap";

export default defineMarkoPressConfig({
  plugins: [
    sitemap({ site: "https://markopress.example.com" }),
  ],
});

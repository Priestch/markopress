// markopress 管线与插件配置（与 content.config.ts 分工：那边管数据源，这边管管线/插件）。
// 契约：docs/plugin-design.md。变更本文件 → 两路 dev watcher 都触发全量重建。
import { defineMarkoPressConfig } from "./scripts/plugins.ts";
import { sitemap } from "@markopress/plugin-sitemap";
import { rss } from "@markopress/plugin-rss";
import { search } from "@markopress/plugin-search";

export default defineMarkoPressConfig({
  // 主题（D5：主题 = npm 包；槽位契约 <mp-layout>/<mp-page>，themes.md §9）。
  // 换主题 = 改这一行 + 装对应包；省略则默认 @markopress/theme-docs。
  theme: "@markopress/theme-docs",
  themeOptions: {
    site: "markopress",
    // 风格预设（纯样式）：default | vitepress | starlight | nextra | docusaurus
    style: "docusaurus",
    // perf 集合（5000 页夹具）不进侧边栏——整树会内嵌每页 HTML（写放大，themes.md §8）
    sidebar: { collections: ["docs"] },
  },
  // markdown 管线（R1）：shiki 默认开；remarkPlugins/rehypePlugins 直通 unified。
  // 改这里 → 两路 watcher 都触发全量重建（renderer 重建，缓存新鲜）。
  markdown: {
    shiki: { themes: { light: "github-light", dark: "github-dark" } },
  },
  plugins: [
    sitemap({ site: "https://markopress.example.com" }),
    rss({
      site: "https://markopress.example.com",
      title: "markopress",
      description: "markopress 文档站（dogfood）",
    }),
    // 本地全文搜索（MiniSearch）：dev/build 都可搜（store 常驻服务端）。
    // 换搜索方案 = 换实现 <mp-search> 槽位的另一个插件包（plugin-design.md §5.3）。
    search({ collections: ["docs"] }),
  ],
});

// markopress 站点配置（唯一用户配置文件，VitePress .vitepress/config.ts 形态）：
//   collections —— 内容层（markopress-content 契约：loader + zod schema）
//   theme/themeOptions/markdown/plugins —— 管线（docs/plugin-design.md）
// 内部分发不变：collections 子树照旧算 store digest；改本文件 → 两路 dev watcher
// 全量重建（resetSynced）。perf 形态 = perf.config.ts（pnpm dev:perf / build:perf）。
import { defineCollection, glob } from "markopress";
import { z } from "zod";
import { defineMarkoPressConfig, rss, search, sitemap } from "markopress";

export default defineMarkoPressConfig({
  collections: {
    docs: defineCollection({
      loader: glob({ pattern: "**/*.md", base: "./content" }),
      // date/description 可选：rss 插件按字段名读取（plugin-rss dateField 默认 "date"）；
      // order 可选：侧边栏显式排序键（scripts/sidebar.ts 排序链首位）。
      // schema 变更 → 集合 digest 变 → store 全量重建（自愈，见 docs/plugin-design.md）
      schema: z.object({
        title: z.string(),
        date: z.coerce.date().optional(),
        description: z.string().optional(),
        order: z.number().optional(),
      }),
    }),
  },

  // 主题（D5：主题 = npm 包；槽位契约 <mp-layout>/<mp-page>，themes.md §9）。
  // 换主题 = 改这一行 + 装对应包；省略则默认 markopress-theme-docs。
  theme: "markopress-theme-docs",
  themeOptions: {
    site: "markopress",
    // 页 <title> 模板（postbuild 补写；dev 期显示站名）
    titleTemplate: "%s · markopress",
    // 风格预设（纯样式）：default | vitepress | starlight | nextra | docusaurus
    style: "docusaurus",
    sidebar: { collections: ["docs"] },
  },
  // 图片管线 v2（docs/images-v2-design.md）：授权域 + md ![]() 接管（opt-in）+ AVIF。
  // 未列名域的远程图直通原始 URL（不 fetch 不优化）。
  images: {
    domains: ["docs.astro.build"],
    markdown: true,
    formats: ["avif", "webp"],
  },
  // markdown 管线（R1）：shiki 默认开；remarkPlugins/rehypePlugins 直通 unified。
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

// spike：blog（~/Enter/blog，旧 markopress 0.0.24）内容直连新栈——theme-blog 验证载体。
// posts 集合 base 指向 blog 仓库的 content/（glob loader 的 base 按 cwd 解析——
// 经 pnpm --filter 运行时 cwd = packages/site，与配置文件所在目录无关）。
// 旧站 layout 值（blog/blog-listing/root/projects）不映射——缺省 "post" 兜底，
// 真迁移时 sed 成新规范值（post/home/list/page）一次。
import { defineCollection } from "@markopress/content";
import { glob } from "@markopress/content/loaders/glob";
import { z } from "zod";
import { search } from "@markopress/plugin-search";
import { defineMarkoPressConfig } from "../scripts/plugins.ts";

export default defineMarkoPressConfig({
  collections: {
    posts: defineCollection({
      loader: glob({ pattern: "**/*.md", base: "../../../blog/content" }),
      schema: z.object({
        title: z.string(),
        date: z.coerce.date().optional(),
        description: z.string().optional(),
        layout: z.string().optional(),
      }),
    }),
  },
  theme: "@markopress/theme-blog",
  themeOptions: {
    site: "Priestch's Blog",
    titleTemplate: "%s · Priestch's Blog",
    nav: [
      { href: "/", label: "Home" },
      { href: "/blogs", label: "Blogs" },
      { href: "/excerpts", label: "Excerpts" },
    ],
    sidebar: { collections: ["posts"], sortBy: "date" },
  },
  markdown: {
    shiki: { themes: { light: "github-light", dark: "github-dark" } },
  },
  plugins: [search({ collections: ["posts"] })],
});

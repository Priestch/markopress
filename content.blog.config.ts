// spike：blog（~/Enter/blog，旧 markopress 0.0.24）内容直连新栈——量化差距用，非长期文件。
// 只有一个 posts 集合，base 指向 blog 仓库的 content/（glob loader 支持父目录 base）。
// 资产断点已接（scripts/images.ts）：旁挂 png 出 webp srcset + blur，`<image src="/<slug>/x.png">`
// 解析到 entry 同名子目录。仍保留的断点：layout: frontmatter 被 zod strip（无 per-page 布局）。
import { defineCollection, defineContentConfig } from "@markopress/content";
import { glob } from "@markopress/content/loaders/glob";
import { z } from "zod";

export default defineContentConfig({
  collections: {
    posts: defineCollection({
      loader: glob({ pattern: "**/*.md", base: "../blog/content" }),
      schema: z.object({
        title: z.string(),
        date: z.coerce.date().optional(),
        description: z.string().optional(),
      }),
    }),
  },
});

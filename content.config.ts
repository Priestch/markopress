// 内容配置：集合定义 + zod schema。digest 由 defineContentConfig 计算（集合/loader 投影）；
// schema 变更应改本文件——文件层面的变更未来接 config 文件指纹后触发全量重建。
//
// 默认配置 = markopress 文档站（dogfood：功能验证默认在这个站上做）。
// 性能夹具（content-perf/，5000 页）不进默认链路——用 content.perf.config.ts
// （pnpm dev:perf / build:perf），见 scripts/content.ts 的 MP_CONTENT_CONFIG。
import { defineCollection, defineContentConfig } from "@markopress/content";
import { glob } from "@markopress/content/loaders/glob";
import { z } from "zod";

export default defineContentConfig({
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
});

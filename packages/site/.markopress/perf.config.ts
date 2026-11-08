// 性能测试配置（全量形态：collections + 管线）：文档站 + 5000 页夹具
// （content-perf/，node scripts/perf-test.mjs 5000 生成）。
// 不直接使用——经 pnpm dev:perf / build:perf（MP_CONTENT_CONFIG 指向本文件）。
// 注意：与默认配置 digest 不同 ⇒ 切换会触发 store 全量重建 + 生成目录按新路由集收缩/扩张
// （write-if-changed + 差集清理，秒级 fs churn，自愈；切换是低频操作，不值得分目录隔离）。
import { defineCollection, glob } from "markopress";
import { z } from "zod";
import { defineMarkoPressConfig } from "markopress";

export default defineMarkoPressConfig({
  collections: {
    docs: defineCollection({
      loader: glob({ pattern: "**/*.md", base: "./content" }),
      schema: z.object({ title: z.string() }),
    }),
    perf: defineCollection({
      loader: glob({ pattern: "**/*.md", base: "./content-perf" }),
      schema: z.object({ title: z.string() }),
    }),
  },
  theme: "markopress-theme-docs",
  themeOptions: {
    site: "markopress (perf)",
    // 万页夹具不进侧边栏——整树会内嵌每页 HTML（写放大，themes.md §8）
    sidebar: { collections: ["docs"] },
  },
});

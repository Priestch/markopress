# `@markopress/markdown`

**markdown 内容格式的 EntryType + unified 渲染器**（gfm + slug/headings → segments 数组）。

## 定位

- **EntryType 实现**：把 `.md` 文件接进 content layer（frontmatter → data，body 原文进 store）。
- **渲染器**：body 源文本 → `{ segments: [{ type: 'html', html }], headings }`。渲染惰性且按 digest 内存缓存（deltas #1）。
- **segments 数组的门**：本期只有 html 段；未来加 component 段（remark directive v1 / 编译期 Marko tag v2）时不改虚拟模块接口、不改生成的页面包装（只需在循环里加 `<if=seg.type === "component">` 分支）。

## 依赖白名单（不得依赖 vite / marko / @marko/run）

- **unified / remark-parse / remark-gfm / remark-rehype / rehype-slug / rehype-stringify**：标准 markdown → HTML 管线，与 Astro 同款（踩坑路径验证过）。
- **gray-matter**：frontmatter 拆分（带 js-yaml），边界情况（CRLF / 体内 `---` / 空块）已被上游处理。
- vitest / typescript / @types/node / @types/hast（dev）。

## 已知边界

- **不加 rehype-raw**：原始 HTML 节点透传到输出（allowDangerousHtml），但插件看不见它们——md 里手写 `<h2 id="x">` 不会被 rehype-slug 收集（Astro 默认管线同样不收集）。
- **shiki 高亮**：下轮做（是真正的渲染大头，单页 10-100ms；本期只有朴素 `<code class="language-js">`）。

## 验收通过

- 15 测试全绿（frontmatter / gfm / headings / digest 缓存 / 坏 YAML 报错）。
- tsc 干净。

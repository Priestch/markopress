# `@markopress/markdown`

**markdown 内容格式的 EntryType + unified 渲染器**（gfm + slug/headings → segments 数组）。

## 定位

- **EntryType 实现**：把 `.md` 文件接进 content layer（frontmatter → data，body 原文进 store）。
- **渲染器**：body 源文本 → `{ segments: [{ type: 'html', html }], headings }`。渲染惰性且按 digest 内存缓存（deltas #1）。
- **segments 数组的门**：本期只有 html 段；未来加 component 段（remark directive v1 / 编译期 Marko tag v2）时不改虚拟模块接口、不改生成的页面包装（只需在循环里加 `<if=seg.type === "component">` 分支）。

## 依赖白名单（不得依赖 vite / marko / @marko/run）

- **unified / remark-parse / remark-gfm / remark-rehype / rehype-slug / rehype-stringify**：标准 markdown → HTML 管线，与 Astro 同款（踩坑路径验证过）。
- **remark-directive**：`:::name` 容器指令解析（R1；内置 remarkContainers 转换器 → `mp-container` div）。
- **shiki + @shikijs/rehype**：默认语法高亮（R1）。双主题（light 内联、dark 走 `--shiki-dark*` CSS 变量，切换 CSS 由站点提供）。**语言懒加载**：`langs: []` + `lazy`（不传 langs 的话 @shikijs/rehype 会一次性加载全部 ~280 个内置语言，实测 ~3s/进程；懒加载后冷启动 ~100ms，新语言首次出现 ~2-20ms 进 singleton 一次性累积，未知语言回退 `fallbackLanguage: 'text'` 不炸）。highlighter 是进程级 singleton。
- **gray-matter**：frontmatter 拆分（带 js-yaml），边界情况（CRLF / 体内 `---` / 空块）已被上游处理。
- vitest / typescript / @types/node / @types/hast（dev）。

## 已知边界

- **不加 rehype-raw**：原始 HTML 节点透传到输出（allowDangerousHtml），但插件看不见它们——md 里手写 `<h2 id="x">` 不会被 rehype-slug 收集（Astro 默认管线同样不收集）。
- **@shikijs/rehype 的嵌套 root**：它替换 code 节点时塞入整棵 `codeToHast` 的 root 文档（非规范 hast）。内置 `rehypeFlattenRoots` 在其后、用户 rehype 之前拍平——移除它会让用户插件的顶层遍历看不见 pre（有测试守住）。
- **自配 shiki**：`shiki: false` + 用户 rehypePlugins 里自带 @shikijs/rehype 时，拍平插件不会跟着跑（它只挂内置 shiki 链上）——文档里要提醒用户自己拍平或递归遍历。

## 验收通过

- 21 测试全绿（frontmatter / gfm / headings / digest 缓存 / 坏 YAML 报错 / R1：remark-rehype 直通、shiki 默认与关闭、双主题、容器、未知语言回退）。
- tsc 干净。

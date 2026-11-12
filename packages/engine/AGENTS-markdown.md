# `@markopress/markdown`

**markdown 内容格式的 EntryType + unified 渲染器**（gfm + slug/headings → segments 数组）。

## 定位

- **EntryType 实现**：把 `.md` 文件接进 content layer（frontmatter → data，body 原文进 store）。
- **渲染器**：body 源文本 → `{ segments: [{ type: 'html', html }], headings }`。渲染惰性且按 digest 内存缓存（deltas #1）。
- **segments 数组**：`html | component` 两态（component 段 = md 块级 Marko 组件，
  v2 已落地，机制见下节）；渲染惰性且按 digest 内存缓存（deltas #1）。

## 依赖白名单（不得依赖 vite / marko / @marko/run）

- **unified / remark-parse / remark-gfm / remark-rehype / rehype-slug / rehype-stringify**：标准 markdown → HTML 管线，与 Astro 同款（踩坑路径验证过）。
- **remark-directive**：`:::name` 容器指令解析（R1；内置 remarkContainers 转换器 → `mp-container` div）。
- **shiki + @shikijs/rehype**：默认语法高亮（R1）。双主题（light 内联、dark 走 `--shiki-dark*` CSS 变量，切换 CSS 由站点提供）。**语言懒加载**：`langs: []` + `lazy`（不传 langs 的话 @shikijs/rehype 会一次性加载全部 ~280 个内置语言，实测 ~3s/进程；懒加载后冷启动 ~100ms，新语言首次出现 ~2-20ms 进 singleton 一次性累积，未知语言回退 `fallbackLanguage: 'text'` 不炸）。highlighter 是进程级 singleton。
- **gray-matter**：frontmatter 拆分（带 js-yaml），边界情况（CRLF / 体内 `---` / 空块）已被上游处理。
- vitest / typescript / @types/node / @types/hast（dev）。

## md 内 Marko 组件段（v2 已落地：engine/src/segments.ts）

`.markopress/components/` 的 tag library（经生成的 marko.json `tags-dir` 发现）
可在 md 块级直接 `<tag/>`。链路：提取 → 占位符注释 → 渲染后切段
（html|component）→ 组件段落盘 `.markopress/vseg/<c>/<id>/<n>.marko` → 模块
import `virtual:mp/segment/…`（rspack NormalModuleReplacement / vite resolveId
双侧解析到真实文件，编译归 bundler）→ mp-page `<${seg.component}/>` 动态
渲染 + Marko 水合。

- **markopack 配套**：translator 的 hydrate 发射只看 .marko→.marko 闭包；
  .js 中转的组件需 MarkoRspackPlugin 补浏览器入口 import（clientHydrateImports，
  必须在 ?browser-entry 之前执行，否则注册晚于 init）。
- 边缘：dev 会话中途**新增**组件文件要重启（taglib 进程缓存）；fenced code
  内安全（不提取）。

## 已知边界

- **不加 rehype-raw**：原始 HTML 节点透传到输出（allowDangerousHtml），但插件看不见它们——md 里手写 `<h2 id="x">` 不会被 rehype-slug 收集（Astro 默认管线同样不收集）。
- **@shikijs/rehype 的嵌套 root**：它替换 code 节点时塞入整棵 `codeToHast` 的 root 文档（非规范 hast）。内置 `rehypeFlattenRoots` 在其后、用户 rehype 之前拍平——移除它会让用户插件的顶层遍历看不见 pre（有测试守住）。
- **自配 shiki**：`shiki: false` + 用户 rehypePlugins 里自带 @shikijs/rehype 时，拍平插件不会跟着跑（它只挂内置 shiki 链上）——文档里要提醒用户自己拍平或递归遍历。

## 验收通过

- 21 测试全绿（frontmatter / gfm / headings / digest 缓存 / 坏 YAML 报错 / R1：remark-rehype 直通、shiki 默认与关闭、双主题、容器、未知语言回退）。
- tsc 干净。

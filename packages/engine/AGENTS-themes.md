# 主题系统（内置 + 外部契约）

2026-11-20 v0.1.0 形态定案：**主题内置化**——docs/blog 随 markopress 单包分发
（原三个 theme 包并入 engine；与 2026-10-29 rss/sitemap/search 并入同款判断：
换件单元不值得单独成包）。发布面 = 单包 `markopress`。本文合并原三个主题包的
AGENTS 契约并按新形态更新。

## 目录与发现机制

- `engine/tags/` —— 引擎级 taglib（marko.json `tags-dir: ./tags`）：
  mp-image / mp-image-html / mp-search / **mp-content-styles** / **mp-head-entries**。
  经 app → markopress 依赖探测全局可用（主题与用户组件都直接可用）。
- `engine/themes/{docs,blog}/tags/` —— 主题槽位实现，**不进** marko.json
  tags-dir：docs/blog 的 mp-layout/mp-page 同名互斥，全局发现会撞名（theme-blog
  曾顶包 theme-docs）。绑定手段 = 生成物相对路径**显式 import**（gen-routes 的
  pageTemplate/layoutTemplate/notFoundTemplate）；主题内部跨文件引用同样显式
  import（docs 的 mp-layout → `./mp-sidebar.marko`）。同目录递归（mp-sidebar
  自引用）走模板自身 tag 名，无需处理。

## config 形态（纯对象，v0.1.0 定案）

```ts
theme: { name: "docs" | "blog" | "<npm 包名>" | "./本地路径", options?: ThemeOptions }
```

- 省略 `theme` = docs（零配置路径）
- `options` 类型联动：`name` 内置字面量收敛（IDE 补全）；字段面是 engine 中介
  的共享面（sidebar.sortBy 连 blog 的 prev/next 都喂）——不按主题分裂类型
- **css 注入口**：`options.css: 路径 | 路径数组`（**必须位于站点 public/ 下**，
  装配期校验）→ head 注入 `<link>` 指原文件（dev sirv 链 / build adapter 拷贝
  静态服务）——改文件即生效，无快照。为什么不走 bundler（实测否决）：.marko
  模板内未引用的 side-effect import 被 Marko 编译器丢弃；浏览器 entry 的 css
  chunk 不进 SSR html 的 <link> 集。稳定覆盖抬特异性（如 `html` 前缀）
- 解析（content.ts resolveTheme）：内置 → `ENGINE_PACKAGE_ROOT/themes/<name>`；
  `./x` → 相对站点根（须含 package.json）；其余 → 从 app 上下文 require.resolve

## 槽位契约（生成器写死 tag 名，主题提供实现）

- `mp-layout` 站点骨架：input `{ site, tree, style, nav, head, content, search? }`
- `mp-page` 页面骨架：input `{ page: { data, segments, headings }, nav: { prev, next }, flat }`
  （page = 虚拟模块导出；nav = page-nav.js 从 sidebar flat 序算的邻居）
- `SidebarNode = { type: "page", title, href } | { type: "group", title, href?, children }`
- 功能槽位（mp-search 等）可选：插件声明 `slots: ["mp-search"]`（mp-* 保留
  命名空间，撞名 fail fast）→ 生成器 `<@search><mp-search/></@search>` 属性体
  注入 → 主题 `<if=input.search><${input.search}/></if>`（**位置归主题，实现
  归插件**）。gating 必须在生成器——Marko 对未知 tag 是硬错误。
- 主题**不得自 import** sidebar.json/site.json：跨包解析 app 文件是 taglib 探测
  同款坑，生成器传参是唯一干净通道。

## 内置 docs 主题（themes/docs）

- 风格预设 `options.style`：default / vitepress / starlight / nextra /
  docusaurus —— 纯 CSS 变量层（只覆盖 --mp-accent/bg/bg-soft/fg/fg-muted/
  border/radius + 少量组件规则；色值出处见 mp-layout 预设块注释）。经
  sidebar.json → `<html data-style>` 驱动。加新预设三步：ThemeStyle 联合类型
  加名 → mp-layout 加亮/暗两个 token 块（**暗块必须紧跟亮块**——同特异性全靠
  顺序）→ 组件级差异加在预设区尾部。
- mp-sidebar 渲染侧边栏树，active 态由页尾脚本按 location.pathname 标注。

## 内置 blog 主题（themes/blog）

- 无侧边栏顶栏（nav 走顶栏链接）+ 时间序文章流；tree/style 接收但忽略。
- mp-page 按 frontmatter `layout` 分流：`post`（缺省，日期头 + 较早/较新）/
  `home`（hero + 最近 8 篇）/ `list`（全量归档倒序）/ `page`（纯文档式）。
- 推荐 schema：title（必填）/ date / description / layout。

## 机械内容样式（engine/tags/mp-content-styles）

- 归属划分：**机械**（.mp-image 几何 / .mp-container 家族 + 语义色板 / shiki
  双主题切换）归本 tag；**排版立场**（.mp-doc 字体/间距/标题层级/链接）归各主题。
- 纪律：除 .mp-container 语义色板外零自带色值——只吃 --mp-* 令牌；暗色规则
  的选择器特异性（html[data-theme]）必须压过主题亮色规则，与加载顺序无关。
- `<mp-head-entries/>` 是**裸 HTML 构造**，不走 Marko 编译——内联 script 必须
  字面进首帧（走编译会进 bundle 延迟执行）。
- markopack 把主题 CSS 注在 head 末尾：站点自定义 CSS（public/ + head link
  或 options.css）需抬特异性才能稳定覆盖。

## CSS 变量契约（tokens 即契约，v0.1.0 定案）

- 机械样式**不导出**（theme-base 溶入 engine，无子路径导出）——外部主题按
  契约自行实现；单一事实源 = 各主题 mp-layout 的 `:root` 声明块。
- 令牌面：`--mp-bg / --mp-bg-soft / --mp-fg / --mp-fg-muted / --mp-border /
  --mp-accent / --mp-radius / --mp-content-w / --mp-sidebar-w / --mp-toc-w`。
- 暗色：`html[data-theme="dark"]` 同 token 重声明；切换键 localStorage
  `markopress-theme`；**属性选择器而非 prefers-color-scheme**（后者不跟手动切换）。
- 无法变量化的结构行为写成"必须实现的类行为"：.mp-container 家族几何、
  .mp-image 响应式几何、shiki 双主题的 html[data-theme] 映射模式。
- 用户微调 = options.css + 令牌覆盖，无需写主题。

## 外部主题契约（v0.1.0 起公开）

- 目录形态：`package.json` + `marko.json`（`tags-dir` 缺省 "tags"）+
  `tags/mp-layout.marko` + `tags/mp-page.marko`（缺槽位 = 装配期硬错误）。
- **不得给 package.json 加 `exports`**——装配层要从 app 上下文解析
  `<name>/package.json` 子路径做槽位校验。
- `@marko/runtime-tags` 必须 **dependencies** 且与所用 markopress 的编译版本
  pin 对齐（两份 runtime-tags = hydration 炸；engine 侧 pin 6.4.16）。
- 无框架依赖：纯 Marko 组件 + CSS；主题状态不进 Marko state（data-* + 手写
  脚本，resume 安全）。
- 本地路径主题（`theme: { name: "./my-theme" }`）同形态，相对站点根解析。

## 验收

- docs 站：`pnpm build`（Rspack 主链路）+ `pnpm dev` 手测（暗色三态、侧边栏、搜索）
- blog spike：`MP_CONTENT_CONFIG=.markopress/blog.config.ts pnpm dev`
- 双主题回归点：容器四色、图片几何、shiki 亮暗切换

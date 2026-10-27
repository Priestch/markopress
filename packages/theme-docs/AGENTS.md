# theme-docs

`@markopress/theme-docs` —— markopress 默认文档主题：`<mp-layout>` / `<mp-page>` 槽位实现。
设计依据 `docs/research/themes.md`（四家对比 + §9 设计启示），本文件是契约速查。

## 槽位契约（生成器写死 tag 名，主题包提供实现）

- `mp-layout`：站点级骨架。input `{ site: string, tree: SidebarNode[], style: ThemeStyle, content: RenderBody }`
- `mp-page`：页面级骨架。input `{ page: { data, segments, headings }, nav: { prev, next } }`
  （page = 虚拟模块导出；nav = `.markopress/page-nav.js` 从 sidebar flat 序算的邻居）
- `SidebarNode = { type: "page", title, href } | { type: "group", title, href?, children }`
  （来源 `.markopress/sidebar.json`，派生自 `scripts/sidebar.ts`）
- 发现机制：`marko.json` tags-dir + **root 包依赖探测**——app 的 package.json 必须依赖本包
  （工作区 `workspace:*`），否则 tag 不被 Marko 编译器发现。
- 换主题 = 实现同槽位名的另一个包 + `markopress.config.ts` 改 `theme` 一行。

## 可选功能槽位（`mp-*` 保留命名空间）

- 结构槽位（mp-layout/mp-page）必有实现；**功能槽位可选**，接线机制：
  1. 插件注册面声明 `slots: ["mp-search"]`（装配期撞名 fail fast，scripts/content.ts
     validateSlots；`mp-*` 保留命名空间强制）；
  2. **生成器**在 +layout.marko 生成 `<@search><mp-search/></@search>` 属性体
     （仅当有插件声明该槽位——Marko 对未知 tag 是**硬错误**，无「空元素透传」；
     且 taglib 依赖探测从模板就近 package.json 出发，主题包内看不到 app 依赖的
     插件 taglib，只有生成物（app 根下）能解析到）；
  3. 主题在选定位位置渲染 `<if=input.search><${input.search}/></if>`
     （**位置归主题，实现归插件**；缺省不渲染）。
- 当前功能槽位：`search`（顶栏，`@markopress/plugin-search` 实现）。换搜索方案 =
  换声明同槽位的插件包，主题/生成器零改动。
- 实现方纪律：槽位组件自备样式且只吃 `--mp-*` 令牌（零自带色值，暗色/预设自动适配）。

## 风格预设（themeOptions.style → sidebar.json → `<html data-style>`）

`default | vitepress | starlight | nextra | docusaurus`——纯 CSS 变量层切换
（各预设只覆盖 `--mp-accent/bg/bg-soft/fg/fg-muted/border/radius` + 少量组件规则，
色值取自各家源码，出处见 mp-layout 预设块注释）。加新预设三步：ThemeStyle 联合类型加名 →
mp-layout 加亮/暗两个 token 块（**暗块必须紧跟亮块**——`html[data-style]` 与
`html[data-theme=dark]` 特异性相同，全靠顺序，见预设块头注释）→ 需要组件级差异加在预设区尾部。

## 内容样式契约（2026-10-28 拆分）

正文排版（.mp-doc 基调）归本主题；**机械部分**（.mp-image 几何 / .mp-container 家族 /
shiki 双主题切换）在 `@markopress/theme-base`（`<mp-content-styles/>` 渲染一次）。
改动机械行为去 theme-base 并双主题回归——归属划分见其 AGENTS.md。

## 硬纪律

1. **不得给 package.json 加 `exports` 字段**——装配层（`scripts/content.ts` resolveTheme）
   要从 app 上下文解析 `<name>/package.json` 子路径做槽位校验。
2. **无框架依赖、无 runtime 依赖**：纯 Marko 组件 + CSS（比 Nextra 的 peer 强耦合干净，
   themes.md §9 #8）。唯一依赖 = @markopress/theme-base（纯 CSS 契约包，同理）。
3. CSS 纪律：`--mp-*` 令牌只声明在 mp-layout（文档属主）；暗色 = `html[data-theme="dark"]`
   同 token 重声明且必须排在亮色之后（同特异性后者胜，R1 踩坑）；正文元素选择器一律
   `.mp-doc` scope（`$!{html}` 注入内容无组件边界，裸选择器会泄漏全站）。
4. 主题状态（暗色/抽屉）**不进 Marko state**——`data-*` 属性 + 手写脚本（resume 安全，
   themes.md §5 #5 对 Marko 的转译）。
5. shiki 双主题切换 CSS 挂 `html[data-theme]` 属性选择器，不是 `prefers-color-scheme`
   media 查询（后者只跟随系统，手动切换不生效）。

## 验收

app 级无 linter/单测：改完跑 root 的 `pnpm dev`（Rspack 主链路）与 `pnpm dev:vite` 双路
手测（Playwright MCP），`pnpm build` 全过为准。

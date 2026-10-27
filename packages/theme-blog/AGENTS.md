# @markopress/theme-blog

**博客主题**：无侧边栏顶栏（nav 链接 + search 槽位）+ 时间序文章流。与 theme-docs
共用 mp-layout/mp-page 槽位契约，互斥使用（`theme: "@markopress/theme-blog"` 一行切换）。

## mp-layout（站点骨架）

- input：`{ site, nav?, content, search? }`；`tree`/`style` 是 docs 概念，接收但忽略
- nav 数据面：`themeOptions.nav` → sidebar.json.nav → 生成器透传
- 暗色/令牌机制与 theme-docs 同款（data-theme 属性 + `<html-script>` pre-paint；
  `--mp-*` 令牌在此声明——theme-base 机械样式吃同一套令牌）
- 已知边界：窄屏（≤720px）藏 nav（v1 简化）；favicon 未内置

## mp-page（页面骨架，按 frontmatter `layout` 分流）

| layout | 形态 | 数据源 |
|---|---|---|
| `post`（缺省） | 标题+日期+摘要头 → 正文 → 时间序 prev/next（较早/较新） | 虚拟模块 + flat |
| `home` | hero + 最近 8 篇（date desc，flat 过滤有日期项） | flat |
| `list` | 全量归档（平铺倒序；年分组 v1.1） | flat |
| `page` | 纯文档式正文（无日期头/分页） | 虚拟模块 |

- `flat` 由生成器传参（`<mp-page … flat=sidebar.flat/>`）——**主题不得自 import
  sidebar.json**：跨包解析 app 文件是 taglib 探测同款坑，生成器传参是唯一干净通道
- segments 契约义务：html 段 `$!{html}` 注入 + component 段 `<${seg.component}/>`
  动态渲染水合（与 theme-docs 的 mp-page 同款 else 分支）
- 机械内容样式经 `<mp-content-styles/>`（theme-base）；排版基调在本包 `.mp-doc` 块

## schema（推荐给站点内容配置）

`title`（必填）/ `date`（z.coerce.date）/ `description` / `layout`——旧站 legacy 值
（blog/blog-listing/root/projects）不映射，缺省 "post" 兜底；真迁移 sed 一次。

## 硬纪律

同 theme-docs：无 exports 字段（resolveTheme 探测 package.json 子路径）、无框架依赖、
CSS 只吃 `--mp-*` 令牌、主题状态不进 Marko state。

## 验收

`MP_CONTENT_CONFIG=.markopress/blog.config.ts pnpm dev`（base 指向 ~/Enter/blog/content）：
home 文章流倒序、post 日期头+较早/较新、暗色三态、search 槽位、`<image>` 资产管线图。

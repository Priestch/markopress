# 插件系统功能规划（生态对照版）

> 状态：规划稿（2026-10-15）。依据：`docs/research/{astro,vitepress}.md`（源码级调研）+
> 生态目录抽查（awesome-astro-integrations、官方 docs，周下载为 2026-10 近似值）。
> 钩子契约的具体设计见 `docs/plugin-design.md`（已定稿 + spike 验证）。
>
> **进度（2026-10-16）**：R2 的装配层与试金石 #1 已落地——`scripts/plugins.ts`（接口 + 助手）、
> `markopress.config.ts`（装配点）、`packages/plugin-sitemap`（双路 build/dev + 增量验证通过）。
> R1 已落地：`createMarkdownRenderer` 支持 remarkPlugins/rehypePlugins 直通、shiki 双主题默认开
>（`shiki: false` 关闭）、`:::name` 容器（remark-directive → `mp-container` div，主题样式在
> layout `<style>`）；20 测试全绿，双路（rspack/vite）build + 浏览器亮暗验收通过（样式提取依赖
> markopack 侧的 style 通道修复，见其 changeset）。rss / search 未动工。

## 0. 一句话结论

VitePress 证明**没有插件 API 也能走很远**（内置 + 四个扩展面）；Astro 证明**插件 API 换来的是生态**
（adapters / 内容格式 / CMS 全靠它）。markopress 的正确位置在两者之间：
**Astro 生态里装机量最大的类别（UI 框架渲染器）恰恰是我们按设计删除的东西**——所以我们的插件面
比 Astro 小得多，第一梯队只需要「SEO 产出 + 搜索 + md 扩展直通」。

## 1. 两家生态的实际形状

### VitePress：没有插件系统，只有四个扩展面

| 扩展面 | 内容 |
|---|---|
| Vite 插件直通 | 用户 Vite 配置原样生效（UnoCSS/Tailwind 等 Vite 生态免费继承） |
| markdown-it 配置 | `markdown` 选项注入自定义 markdown-it 插件 |
| Theme 契约 | 5 字段接口（Layout/enhanceApp/…），默认主题 ~60 组件也只是个符合契约的包 |
| site-config 钩子 | `transformHead` / `transformHtml` / `transformPageData` / `postRender` 四个 |

「插件级功能」多数做成了**内置**：local search（MiniSearch，按 locale 分块懒加载）/ Algolia、sitemap、
last-updated（git）、死链检查、~15 个 markdown-it 插件（shiki 双主题、containers、code-group、
snippet `<<<`、`@include`、行号、attrs/emoji/footnote…）、动态路由 `paths.ts`、`*.data.ts` 加载器。
社区插件散落 npm（vitepress-plugin-mermaid、vitepress-sidebar…），**无统一 API、无目录**。

**教训**：内置 + 少量钩子能撑到产品市场契合；插件 API 的收益是生态（第三方替你写功能），不是单个功能。

### Astro：完整 Integrations API + 大生态

钩子面（`research/astro.md` §5）：`astro:config:setup`（`addRenderer` / `injectScript` / `injectRoute` /
`addWatchFile` / `addClientDirective` / `addMiddleware` / `updateConfig` + 隐藏的
`addContentEntryType` / `addPageExtension`）、`config:done`（`setAdapter` / `injectTypes`）、
`server:*`、`build:*`、`route:setup`。**adapter 就是 integration**（unshift 到队首）；
**MDX 整个内容格式全走 integration API**——API 充分性的标准证明。

装机量排序（周下载，2026-10 近似）：

| 类别 | 代表 | 周下载 |
|---|---|---|
| UI 渲染器 | @astrojs/react 1.2M、svelte 264K、vue 167K… | **最大类** |
| SEO 产出 | **@astrojs/sitemap 1.3M**（全站第一）、astro-seo 153K、@astrojs/rss 45K | 第二大类 |
| 内容格式 | @astrojs/mdx 986K、starlight（文档主题）85K、markdoc 5K | |
| 样式 | tailwind 861K、UnoCSS 150K | |
| 适配器 | node 623K、vercel 241K、netlify 148K、cloudflare 95K | |
| 图片/图标 | astro-icon 374K、astro-font 12K、expressive-code 12K | |
| 性能 | astro-compress 25K、critters 8K、partytown 45K | |
| CMS/DB/认证 | contentful/sanity/strapi、@astrojs/db 15K、auth 8K | |

**事实**：sitemap（1.3M）> react（1.2M）——非渲染器类别里 SEO 产出是第一刚需。

## 2. 对照映射：markopress 的归属

| Astro/VP 生态类别 | markopress 对应 | 归属 |
|---|---|---|
| UI 框架渲染器（react/vue/svelte…） | **不需要**——Marko 单一组件模型 + resumability，这正是差异化（D 系决策的出发点） | 删除 |
| 适配器（node/vercel/cloudflare…） | marko-run 原生 adapter（D1） | 免费 |
| 样式（tailwind/UnoCSS） | Vite/Rspack 插件直通 | 免费 |
| 内容格式（mdx/markdoc） | EntryType + renderer 契约（已设计）；md 内组件走 segments 门（D3 v1 directive / v2 编译期标签） | 契约已留门 |
| 主题（starlight） | D5 taglib（npm 包 = 布局+组件） | 已定稿 |
| md 扩展（expressive-code、mermaid、katex…） | unified 直通：`markdown: { remarkPlugins, rehypePlugins }` | **核心配置，非插件** |
| SEO 产出（sitemap/rss/seo/robots） | app 级钩子（route + 读路径） | **插件，第一梯队** |
| 搜索（MiniSearch local / Algolia） | D6 既定方向（MiniSearch 分标题索引） | **插件，第一梯队** |
| last-updated / og-image | pageData 钩子（git mtime / 出图） | 插件，第二梯队 |
| 性能（compress/critters/partytown） | partytown≈injectScript 类钩子；compress≈HTML 后处理钩子 | 后置 |
| CMS loaders（sanity/contentful/wp） | **loader 契约**（wp 有纸上设计，Phase 3） | 正交，已有契约 |
| 认证/DB | marko-run middleware/handlers | Phase 3 |

## 3. 功能规划（分轮）

### R1 · md 扩展直通（无新 API，本轮就做）

- `markdown: { remarkPlugins, rehypePlugins }` 配置直通（`createMarkdownRenderer` 收参数）。
- **shiki**：默认语法高亮（渲染大头，单页 10-100ms；双主题、按需语言）。markdown AGENTS 已排「下轮」。
- containers（`:::tip` → 主题标签，D3 v1）。
- 验收：本仓库文档站的代码块全部 shiki 化；第三方 remark/rehype 插件可零成本接入。

### R2 · app 钩子 v0 + 三个试金石插件

- 先纸面设计钩子（`docs/plugin-design.md`，用下面三个插件当用例走查，跑不通改钩子）：
  注册面（entryTypes/renderers/markdown 注入）、`contentSynced`（读路径）、`routes`（产出路由+数据模块）、
  `pageData`、`transformBody`；候选待定：head 注入面（transformHead 类，覆盖 seo/analytics，便宜）。
- **插件 1：sitemap**（+ robots.txt 顺带）——最简只读消费者，API 诚实性的试纸。
- **插件 2：rss**——第一个写路径（加路由 + 集合数据序列化，走 marko-run `emitRoutes`）。
- **插件 3：local-search（MiniSearch）**——最重读路径（逐页 render-to-text、分块产出、
  **必须继承 O(1) 增量纪律**，否则 perf 形态 5000 页直接退化）。
- 三者刻意不做成核心功能：它们的职责就是逼 API 存在且诚实。dogfood 本仓库文档站，冻结 v0。

### R3 · 生态补全（低成本长尾）

- last-updated（git mtime → pageData）、og-image / seo head（视 R2 是否已含 head 面）、
  404/重定向清单、expressive-code 级代码呈现（shiki 之上的升级路线）。

### R4 · 单独立项（本轮不碰）

- **图片管线**：用户价值大但协调最重（资源指纹/产出/md 引用改写）；Astro 收成核心 `astro:assets`
  正因为插件层别扭——到时先做「核心 vs 插件」决策再动手。
- **wp() loader**：loader 契约上，Phase 3 主线。
- 认证/后台/DB：Phase 3（marko-run middleware/handlers 是现成原语）。

## 4. 与既有文档的关系

- 钩子四类（md transform / page-data / layout / route）是 `docs/background.md` Phase 3 既定形状，本文不改它，只排顺序。
- 设计约束四条（确定性、死锁纪律、双路纪律、增量纪律）见上一轮讨论，进 `plugin-design.md` 定稿。
- 顺序：R1 立即（已在 markdown 包日程）→ R2 纸面设计先行 → R3 跟随 → R4 另立项。

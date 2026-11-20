# 调研背景与结论

> 调研日期：2026-10-14。版本时点：`marko@6.4.5`（runtime-tags，`latest` dist-tag）、`@marko/compiler` 5.42.11、`@marko/run` 0.11.13、Astro 7.3.8（main）、VitePress（main）。
> 方法：四路并行子代理调研 —— Marko 仓库（本地 `/home/gp/Enter/marko`）、`@marko/run` 源码 + 官方文档、Astro 源码镜像 + 文档、VitePress 源码。原始报告见 [research/](research/)。

## 项目目标

基于 Marko 做一款内容框架：

- **VitePress 形态**：`.md` 文件即页面，文档站开箱即用；
- **Astro 形态**：schema 化内容集合、主题生态、SSG/SSR 混合；
- **WordPress 方向**（远期）：动态内容源（DB/API）、后台编辑、发布触发重建/按需重验。

## 核心结论

**不从零造框架、不 fork Marko —— 在 `@marko/run` 之上做一层内容框架。**

Marko 6 已解决视图层（流式 SSR + resumability + 语言级懒加载指令）；marko-run 已解决应用层（文件路由 + Vite 集成 + SSG 适配器 + WHATWG fetch 服务器模型）。要造的只有三样：

1. **Markdown → Marko 管线** —— Marko 仓库里没有任何 markdown 代码，完全空白；
2. **内容数据层** —— 照抄 Astro 的 Content Layer 设计（loader → store → digest 增量 → zod 校验 → 生成类型）；
3. **主题系统** —— 用 Marko 原生 taglib 机制（npm 包 = 布局 + 组件 + `marko.json`）。

WordPress 方向是后期把内容层的 loader 从文件换成数据库 + 加后台，不是另起炉灶。

**关于 Astro**：Astro 做的正是「组件模型之上的内容框架」，占了目标位置的大半。但它为多框架 hydration 付出的架构税 —— renderer 注册表、props 类型标记元组序列化、`<astro-island>` 自定义元素、自顶向下 hydration 编排、`client:` 指令抽取 —— Marko 6 的 resumability 让这些**整个不存在**。所以这不是复刻 Astro，而是有真实差异化的空位。

## 底座盘点（调研事实）

| 层 | 状态 | 提供的能力 |
|---|---|---|
| `marko@6`（runtime-tags 6.4.5，`latest`） | ✅ 正式版 | 流式 SSR（`render()` 返回的 RenderedTemplate 同时是 Promise / AsyncIterable / `.pipe()` / `.toReadable()`）；resumability（HTML 内 resume 注释 + JS 表达式 payload，无 vdom diff，仅序列化分析证明客户端要读的状态）；`$!{html}` 原始 HTML 注入（cheatsheet.md:131，须为平衡片段）；**语言级懒加载指令** `idle` / `visible#sel` / `media()` / `on-click`（cheatsheet.md:174，带构建期代码分割与 `<try>@placeholder`）≈ Astro `client:*` 的语言内等价物；taglib 机制（`marko-tag.json` 的 `parse/migrate/transform/translate` 编译期钩子 + `tags/` 目录约定 + node_modules 自动发现 = 组件分发通道） |
| `@marko/compiler` 5.42.x | ✅ 稳定 | `compile/compileFile`，`Config`（`output`、`entry`、可插拔 `fileSystem`、`linkAssets`/`resolveVirtualDependency` —— `@marko/vite` 的集成缝）；`output:"source"/"migrate"` 反打印源码（codemod API）；`@marko/compiler/babel-utils`（`defineTag` 等）；`@marko/compiler/register`（Node require 钩子） |
| `@marko/run` 0.11.13 | ⚠️ pre-1.0 但活跃（peer `marko 5-6`） | Vite 8 + rolldown + `@marko/vite` 6；`+page/+layout/+handler/+middleware/+meta` 文件约定（page 锁死 `.marko` 扩展名，handler/middleware/meta 任意扩展）；布局**构建期融合**为单一模板（主题外壳零运行时成本）；编译期 switch-trie 路由 + `routes.d.ts` 类型生成（`Run.href` 内链类型化）；MPA 模型（无客户端路由，静态页近零 JS）；**static adapter 自带 SSG**（从无参路由 + `urls` 清单爬内链写 HTML）；扩展点：包插件 / `addExternalRoutes` / `emitRoutes` / 自定义 Adapter / 程序化 `fetch-match-invoke` |
| Markdown / 内容建模 / 主题 / 数据加载 | ❌ 全空白 | 全部由本框架提供 —— 既是工作量，也是在 marko 生态的定位 |

**红线（不要依赖的内部件）**：translator 分析机器（sections/bindings/reasons）、`writer.ts` 的 Chunk/Boundary、serializer 线格式（均为 codegen 内部）；Marko 6 的 HMR 在外部 `@marko/vite`（仓库内的 HMR 是 Marko 5 的）。

## 定位与差异化

一句话卖点：**「内容框架，但内容里嵌交互组件不花钱。」**

- Astro 里每个交互组件都要做 islands 核算（选 renderer、序列化 props、编排 hydration 顺序、选 `client:` 策略）；Marko 6 里交互组件直接写进模板 —— SSR 流出去，客户端认领 DOM 恢复，静态部分零 JS。
- VitePress 为省 hydration 做的 `.lean.js` 双 chunk 手艺活（剥离静态 vnode 字符串），Marko 面前整段删除。
- Astro 的 `client:idle/visible/media` ≈ Marko 语言级 `idle`/`visible#sel`/`media()`，且多了事件触发（`on-click`）。
- 内容站最典型的「文档页 + 几个小交互 demo」场景，天生比 Astro 少一层运行时。

## 总体架构

```
┌─ markopress ─────────────────────────────────────────────────┐
│  CLI: press dev / build / preview（薄壳，程序化调 Vite）      │
│                                                             │
│  核心包 = Vite 插件                                         │
│   ├─ 包裹 markoRun()            ← 官方预期的组合方式         │
│   ├─ .md transform              ← unified 管线 → 虚拟模块    │
│   │      导出 { html, frontmatter, headings }（Astro 契约）  │
│   ├─ 路由生成器                  ← 扫 src/pages + src/content │
│   │      生成 routes 目录：每个 md → 极小 +page.marko 包装    │
│   └─ 虚拟模块: site-data / content / search-index           │
│                                                             │
│  内容层（独立包，抄 Astro Content Layer）                    │
│   loader → store → digest 增量 → zod 校验 → 生成类型         │
│   glob() | file() | fetch() | live()（WordPress 方向）       │
│                                                             │
│  主题 = npm 包（Marko taglib: layouts + components）        │
│                                                             │
│  Adapter: 包 static adapter，url 用显式清单（不需爬虫）      │
└─────────────────────────────────────────────────────────────┘
        ↓ 只依赖已发布的包，不 fork
   @marko/run → @marko/vite → @marko/compiler → marko@6
```

## 关键技术决策

### D1 · 建在 marko-run 上，不旁路

路由/SSR/适配器/Vite 接线全有，且 MPA 形态与内容站天然一致。做法：自己的插件工厂包裹 `markoRun()`，透传全部 `@marko/vite` 选项。pre-1.0 的 API 变动用自家 `defineConfig` facade + 锁版本隔离。不 fork —— 0.11.x 快速演进中，fork 等于放弃上游。

### D2 · `.md` 进路由：生成 routes 目录

硬约束：路由文件正则（`routes/builder.ts:16-22`）把页面锁死 `.marko` 扩展名，`+page.md` 不可行；Walker 接口可插拔但未从包导出。推荐组合：

- **(a) 生成目录（主机制）**：扫描内容 → 生成极小包装文件（形如 `<layout-doc page=input.page>$!{input.html}</layout-doc>`）→ `routesDir` 指向生成目录。marko-run 的 dev watcher 监听该目录的增删自动重建路由；自有 watcher 监听源内容目录触发再生成。用户手写 `.marko` 页面由生成器统一收编（用户只面对 `src/pages/`，不碰生成目录）。
- **(b) `.md` transform 成模块 + marko 页面引入**：服务于 collections 模式（页面在 marko、内容是数据），与 (a) 并存。
- `addExternalRoutes` 需自己做匹配，留给边缘场景。

### D3 · Markdown 管线：unified（remark/rehype）+ shiki

产出惰性 HTML 字符串，`$!{html}` 注入（md 渲染产物天然是平衡片段，满足其约束）。选 unified 不选 markdown-it：插件生态、Astro 的处理器契约（`render() → {code, metadata}`）可直接照抄、处理器可替换（Rust 化演进路线 Astro 已趟过 —— 其 `markdown.processor` 已可插拔）。

md 内嵌组件分两步：
- v1：remark directive（`:::tip` 等容器）映射主题标签；
- v2：编译期 `<markdown>` 自定义标签（`marko-tag.json` transformer 在编译期吃 md AST）—— md 里直接写 Marko 标签，比 Astro MDX 更自然。

### D4 · 内容模型双模式，共享同一条 md 管线

- **pages 模式**（VitePress 式）：`.md` 文件 = 页面，零配置；
- **collections 模式**（Astro 式）：`src/content/<集合>` + zod schema + `getCollection()` 查询。抄 Astro 全套：loader 契约、每集合 scoped store、xxhash digest 增量（改一个文件只重渲染一个）、metaStore 配置指纹失效、devalue 分块持久化（未查询的集合零打包成本）、zod → `.d.ts` 类型生成。
- **WordPress 方向 = loader 从 `glob()` 换成 DB/live loader**（Astro 的 `LiveLoader` + `cacheHint{tags, lastModified}` 就是按 WP 形状设计的）。

### D5 · 主题：Marko 原生 taglib，不发明槽位注册表

主题 = npm 包（layouts + components + `marko.json`），走编译器现成的 node_modules 发现机制；覆盖/继承走组件组合（Marko 的 attribute tags 与 render-body 原生强于 VitePress 的 35 个转发槽）。v1 先做一个 docs 布局（侧边栏来自文件树/标题）。frontmatter `layout:` 字段选布局。

> **2026-11-20 修订（v0.1.0 发版准备，所有者改判）**：槽位契约不变，但**分发改
> 单包**——docs/blog 两个内置主题并入 `markopress`（`engine/themes/`），不再
> 独立发包。理由：npm 包名是一次性门（先拆后合并会占坑，先合并后拆出是纯增
> 量）；0.x 期主题契约高频变动，拆包意味着每次发版 4 包联动 + runtime-tags 三
> 处 pin 对齐；与 2026-10-29 rss/sitemap/search 并入同款判断。外部主题仍是
> npm 包或本地路径（契约见 `packages/engine/AGENTS-themes.md`）；config 形态
> 改纯对象 `theme: { name, options? }`。

### D6 · SSG：包 static adapter + 显式 url 清单

路由在扫描时全知（VitePress 同理），既不需要 Astro 的 `getStaticPaths` 也不需要爬虫 —— 直接把清单喂给 static adapter 的 `urls`。逐路由 prerender 标记走 `+meta`。死链检查在编译期对着路由全清单做。搜索用 MiniSearch + 复用同一 md 渲染器分标题建索引（VitePress 模式，含按 locale 懒加载 chunk）。

## 分阶段路线图

| 阶段 | 交付 | 验收 |
|---|---|---|
| **0 · Spike**（几天） | 新仓库；插件包裹 `markoRun()`；一个硬编码 md → 生成 `+page.marko`；static build | 证明「生成目录 + watcher」组合（D2）成立，dev/build 全通 |
| **1 · 文档 MVP** | pages 模式全量、unified 管线（GFM/shiki/headings/frontmatter）、默认 docs 主题、md HMR、SSG + 死链检查 | 拿它给一个真实项目写文档（dogfood） |
| **2 · 内容/博客** | collections（glob loader + zod + 类型生成 + `getCollection`）、`$slug` 动态路由、RSS/sitemap（`emitRoutes`）、本地搜索、图片管线 | 一个真实博客跑起来 |
| **3 · WordPress 方向** | DB/API loader + `cacheHint`、后台编辑器（marko-run 的 handlers + middleware 是现成服务器原语）、鉴权、发布→重建/按需重验、显式插件钩子（md transform / page-data / layout / route 四类钩子点 —— 不要 WP 式全局 action/filter 派发） | 内容从后台发布即可上站 |

贯穿：给 marko-run / marko 提 PR（如导出 Walker 接口、让 `addExternalRoutes` 的路由进生成路由表），跟进 0.11 → 1.0。

## 风险与对策

| 风险 | 对策 |
|---|---|
| marko-run pre-1.0，API 变动 | 锁版本 + 自家 `defineConfig` facade；它在官方团队手里活跃维护，策略是跟进而非冻结 |
| 生态小，markdown/搜索/图片全自己造 | 反面即定位：marko 生态此位置完全空着；marko 团队对 DX 有投入（cheatsheet 进包、编译错误带 agent 修复指南） |
| md 内组件化（编译期 transformer）复杂 | v1 先惰性 HTML + remark directive 渐进，`<markdown>` 标签后置 |
| 与 Astro 正面竞争 | 差异化就是 resumability 一件事 —— 单一组件模型 + 零 islands 核算；守不住这个卖点，项目不成立 |

## 已验证的语法事实（本地仓库核实）

- `$!{html}` 注入原始 HTML：`packages/runtime-tags/cheatsheet.md:131`（须平衡片段，否则更新时删错节点）；
- 懒加载指令：`packages/runtime-tags/cheatsheet.md:174` —— `visible#sel` / `idle` / `media(...)` / `on-click#sel` / `render`，`<try>` + `@placeholder` 处理加载态，服务端 HTML 立即渲染，JS 延迟到触发后加载；
- Marko 6 无 `<macro>`（Marko 5 才有），等价物是 `<define>` 与标签变量（`<let/count=0>`）；
- Marko 6 核心标签清单见 `packages/runtime-tags/src/translator/core/index.ts`（无 `html` 标签，原始 HTML 走 `$!{}` 插值）。

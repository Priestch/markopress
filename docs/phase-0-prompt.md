# Phase 0 Spike — 启动 prompt

> 用法：在 `/home/gp/Enter/markopress` 目录下开一个新的 Claude Code 会话，把下面整段作为首条消息发给它。

---

## 任务：markopress Phase 0 spike

工作目录是 `/home/gp/Enter/markopress`。这是 markopress 项目的第一次开工。

**先读背景**：`docs/background.md`（结论、架构、六个技术决策），需要细节再查 `docs/research/*.md`（marko-internals / marko-run / astro / vitepress 四份调研报告，含文件级出处）。本 prompt + 这些文档就是你的全部背景。

### 项目是什么

markopress：基于 Marko 6 + `@marko/run` 的内容框架（VitePress/Astro 形态）——`.md` 文件即页面，经 Marko 布局渲染，支持 SSG；远期做内容集合和 WordPress 方向。**本次只做 Phase 0 spike：验证最大的架构假设，不构建框架本身。**

### 已定的决策，不要重新讨论

1. **建在 `@marko/run` 之上，绝不 fork 或旁路。** 我们的 Vite 插件包裹 `markoRun()`（`@marko/run/vite` 导出的普通插件工厂）——这是官方预期的组合方式。
2. **`.md` 通过「生成 routes 目录」进入路由。** 硬约束：marko-run 的路由文件正则把 `+page` 锁死 `.marko` 扩展名（调研见 `docs/research/marko-run.md` §3/§7）。方案：扫描内容目录 → 生成极小 `+page.marko` 包装文件到生成目录 → `routesDir` 指向它。marko-run 的 dev watcher 会监听生成目录的增删并重建路由；我们自己的 watcher 监听源内容目录，变更时重新生成。
3. **SSG** = marko-run 的 static adapter + 显式 `urls` 清单（路由在扫描时全知，无需爬虫）。
4. **md 的 HTML 进模板用 `$!{html}`**（Marko 6 语法，要求平衡片段——md 渲染产物天然满足）。
5. 调研时版本：`marko@6.4.5`、`@marko/run@0.11.13`（**pre-1.0，API 会动**）。研究与实际不符时，以 `node_modules/@marko/run` 里安装的源码为准，并记录差异。

### 具体步骤

1. `git init`，写 `.gitignore`（`node_modules/`、`dist/`、生成目录）。Node ≥ 22.18（先 `node -v` 确认），pnpm。
2. 装依赖：`marko@^6`、`@marko/run`、static adapter 包（包名以 [marko-run 文档](https://markojs.com/docs/marko-run/adapters/)或安装源码为准）、vite（跟随 @marko/run 要求的版本）。脚手架参考 [getting-started](https://markojs.com/docs/marko-run/getting-started/)，但目录结构按我们的来。
3. 建 `content/`：2–3 个带简单 frontmatter（title）的 `.md`。
4. 写路由生成器（spike 阶段独立脚本即可，如 `scripts/gen-routes.mjs`）：扫描 `content/` → 在生成目录里产出 `+layout.marko`（简单文档外壳：nav + 正文区）和每个 md 一个 `+page.marko`。md 渲染用最简单可用的库（`marked` 即可，无需 unified/shiki）；**渲染出的 HTML 直接内联进生成的 `.marko` 文件**（spike 允许；transform 虚拟模块方案留给 Phase 1）。
5. `vite.config.ts`：导出包裹 `markoRun({ routesDir: <生成目录>, ... })` 的插件数组。
6. 在布局或某一页放一个小的 Marko 交互组件（如计数器）。
7. 接通 dev 增量：内容目录变更 → 重新生成（vite 插件 `configureServer` 里 watch，或复用生成脚本）。
8. `pnpm build`：static adapter，`urls` 用扫描出的显式清单，产出 `dist/public/` 下每页的 `.html`。

### 验收标准（全部满足才算完成）

- [ ] `pnpm dev`：每个 md 路径渲染成完整页面（布局 + `$!{html}` 正文 + frontmatter 标题）
- [ ] 编辑 md → 浏览器刷新后内容更新（HMR 是加分项，整页刷新即可接受）
- [ ] 新增/删除 md → 路由随之出现/消失（证明「再生成 × marko-run re-walk」组合成立——**这是本次 spike 的核心验证点**）
- [ ] `pnpm build`：每个 md 页面产出静态 HTML，文件直接打开内容完整
- [ ] 计数器组件 SSR 渲染、加载后可交互（Marko resumability 自动完成，无需手写 hydration）
- [ ] 布局走 `+layout.marko` 约定（证明主题外壳能骑在 marko-run 的布局融合机制上）

### 范围限制（spike 就该丑）

- 不做 unified 管线、shiki、主题系统、collections、搜索、CLI 打磨——`package.json` scripts 即可
- 配置可硬编码，错误处理最小化
- 不为 Phase 1 之外的想象需求做抽象

### 护栏

- `/home/gp/Enter/marko`（marko monorepo）是**只读参考**：Marko 6 语法看 `packages/runtime-tags/cheatsheet.md`，resume 机制看 `packages/runtime-tags/RESUMABILITY.md`。绝不修改那个仓库。
- 只用已发布的包；若 `@marko/run` 实际 API 与调研笔记不符，读安装后的源码 reconciling，把差异记下来。
- 通用 Marko 文档：https://markojs.com/llms.txt（URL 加 `.md` 后缀取 markdown）。

### 交付物

1. 可运行的 dev + build（见验收标准）
2. `docs/spike-notes.md`：哪些成立、与调研笔记的差异、值得给上游提 PR 的摩擦点、对「生成 routes 目录」方案的 go/no-go 结论、Phase 1 最短必做清单

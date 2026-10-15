# Phase 0 Spike 结果

> 日期：2026-10-14。版本：`marko@6.4.5`、`@marko/run@0.11.13`、`@marko/run-adapter-static@2.0.10`、`vite@8.3.4`（@marko/run 自带依赖）、`marked@18.1.1`。

## 结论：Go

「生成 routes 目录」方案（D2）**成立**：

- `content/*.md` → 生成扁平 `+page.marko` 包装（HTML 内联）→ `routesDir` 指向生成目录 → marko-run 照常走路由、融合布局、生成虚拟入口。
- **dev 增量全通**：新增 md → 路由 ~50–100ms 内出现；删除 → 404；编辑 → 刷新即更新。marko-run 的 dev watcher 对生成目录增删的 re-walk 完全如调研预期（`plugin.ts` `configureServer` 路径核实无误）。
- **SSG 全通**：static adapter + 显式 `urls` 清单（生成器写的 `urls.json`），`Crawled 6, success 6`，`dist/public/` 每页一个 `.html`，内容完整。
- **resumability 量化**：构建产物每页 JS 仅 ~82–92 字节 + 共享 runtime ~2.5KB（计数器组件）。SSR HTML 里的 resume 注释（`<button>clicked <!>0<!--M_$8 b--> times</button>`）即全部客户端成本。
- 布局走 `+layout.marko` 约定、构建期融合为单一入口模板（`dist/.marko-run/<key>.marko`）核实成立。

**但有一个重要发现**（见下）：marko-run 0.11.13 的 dev server 存在竞态死锁，触发条件恰好是「页面新增 × 布局变更同批」。我们的规避方案（布局静态化 + nav 走数据模块）恰好也是 Phase 1 的正确架构，因此不构成 no-go。

## 验收标准逐项

| 标准 | 结果 | 证据 |
|---|---|---|
| `pnpm dev`：每个 md 渲染完整页面（布局 + `$!{html}` + frontmatter 标题） | ✅ | nav + `<main><article><h1>{title}</h1>` + 正文均渲染（curl + Playwright 核实） |
| 编辑 md → 刷新后更新 | ✅ | EDIT-MARKER 逐次出现；标题改名同步更新 nav 与 `<h1>` |
| 新增/删除 md → 路由出现/消失（**核心验证点**） | ✅ | add → 200（50–100ms）；delete → 404；期间其他路由全程健康（ms 级响应） |
| `pnpm build`：每页静态 HTML，直接打开内容完整 | ✅ | `dist/public/{index,about,getting-started}.html`，标题/正文/计数器 SSR 均在 |
| 计数器 SSR + 加载后可交互（无手写 hydration） | ✅ | dev 与 build 后的页面各点击均计数（"clicked 2 times"） |
| 布局走 `+layout.marko` 约定 | ✅ | 融合入口 `dist/.marko-run/<key>.marko` 生成；nav 来自布局 |

## 重要发现：dev server 竞态死锁（规避而非解决）

**现象**：dev 运行中，同一 watcher 批次内同时「新增 `+page.marko`」+「修改 `+layout.marko`」→ 之后所有请求挂起；日志见 `fetchModule("@marko/run/router")` 60s 超时（module-runner 重试 `startOffset:3` 后放弃）。**服务器永久卡死**（改回文件也不恢复），只能重启。没有浏览器连接、没有进行中的请求时同样触发。

**排查矩阵**（/tmp/mr-repro 最小复现 + 本仓库）：

| 场景 | 结果 |
|---|---|
| 仅新增 page（任何 adapter、任何 routesDir） | ✅ 健康 |
| 仅修改 layout | ✅ 健康（44ms） |
| 顺序执行：新增 page → 等 4s → 修改 layout | ✅ 健康 |
| **同批**：新增 page + 修改 layout，static adapter（默认 src/routes） | ❌ 卡死 |
| **同批**，static adapter，dot-dir routesDir（`.markopress/routes`） | ❌ 卡死 |
| **同批**，node adapter（无 adapter 选项），本项目布局 | ❌ 卡死 |
| 同批，node adapter + 默认目录 + 极简布局（/tmp 初版） | ✅ 一次通过（样本少，判断为竞态非确定性） |

与 adapter、routesDir 位置、是否有自定义插件**均无关**；与 markopress 插件无关（无插件裸 marko-run 也复现）。判定为 marko-run dev watcher 的 re-walk 与 Vite 模块图失效之间的竞态。

**规避（本仓库已实施）**：生成的 `+layout.marko` 是**静态**的 —— nav 数据放 `.markopress/nav.json`，布局 `import nav from "../nav.json"`（Vite json 管线，实测可行）。这样运行期布局文件**永不变化**，增/删 md 只产生单页面文件事件（已证明安全）；标题编辑只改 nav.json + 页面文件，走模块图失效路径（同样安全，实测 1.4ms）。Phase 1 把 nav.json 升级为 site-data 虚拟模块即可，形态已验证。

## 与调研笔记的差异

调研（`docs/research/marko-run.md`）基本全对，版本一字不差。补充/修正：

1. **vite 不用单独装**：`@marko/run` 直接依赖 `vite ^8.0.7`（不是 peer）。我们另加了 devDep 显式声明。
2. **flat 路由名**：`name+page.marko`（`a/b.md` → `a.b+page.marko`，`index.md` → 根 `+page.marko`）。生成器因此无需维护目录树，删除路由 = 删一个文件。这一点文档（file-based-routing.md）有、调研笔记没展开。
3. **路由正则核实**：`[+](?:(page|layout|404|500)\.(?:.*\.)?marko|...)` 作用于 basename（`dist/vite/index.js:1434`），flat 名天然匹配。
4. **布局渲染语法**：Marko 6 中布局收到 `input.content`，用 `<${input.content}/>` 渲染（不是 Marko 5 的 `input.renderBody`）。marko 仓库 fixture `lazy-tag-layout-assets-after-doctype/layout.marko` 是权威样例。
5. **`staticAdapter()` 是默认导出工厂**：`adapter: staticAdapter({ urls: [...] | async (routes) => [...] })`；`urls` 函数收到 `routes.list`。
6. **CLI**：二进制名 `marko-run`（`dev|build|preview`）；无 vite.config 时才用内置默认配置。

## 踩坑记录

1. **concise mode 陷阱（生成代码必看）**：模板根级裸行 `$!{html}` 会解析成 custom tag `<$!{html}>`（编译错：Unable to find entry point）。插值必须放进显式开闭标签内（如 `<article>…$!{html}…</article>`）。cheatsheet 规则 #1 的 `$!{}` 变体，错误信息不直白。
2. **config 热重启后路由 404**：修改 vite.config 的依赖（含 gen-routes.mjs）→ Vite 重启 dev server → 首个请求 404 "Cannot GET"。再重启即恢复。开发生成器时的体验噪音，未深究。
3. **pnpm 12 默认拒绝 esbuild 的 build script**：需 `package.json` 里 `pnpm.onlyBuiltDependencies: ["esbuild"]`（esbuild 0.28 走 optionalDependencies 分发二进制，实际不批准也能跑）。
4. **URLS 读取时机**：`staticAdapter({ urls })` 工厂在 vite.config 求值时立即调用，若传数组会在生成器跑之前读文件 → 必须传 `async () => ...`（buildEnd 时才求值）。

## 值得给上游提 issue/PR 的点（按价值排序）

1. **dev server 死锁竞态**（上述）：附最小复现（src/routes 下同批 `touch 新 page + 改 layout`，static 或 node adapter 均可）。这是「生成 routes 目录」这类二次生成场景的主要摩擦。
2. **文档**：vite-plugin 文档可把「`routesDir` 指向生成目录」列为受支持模式（D2 的整个方案骑在这上面；目前文档只说「不建议移动」）。
3. （低）config 热重启后路由失效的恢复路径。

## 规模边界补充（2026-10-14，Phase 1 增量同步落地后实测）

- **内容 sync 无边界问题**：5k 文件站点，单文件编辑增量 sync **1.1ms**（全量重扫 233ms；`syncer.syncFile` O(1) 路径）。
- **dev 启动路由风暴**：路由数从 ~500 涨到 5000（新增 4500 个 `+page.marko`）时，marko-run dev watcher 对每个新增 routable 文件 re-walk，首个请求阻塞 ~53s 后恢复。一次性规模跳变才触发；之后请求 ms 级。
- **build OOM（已定位根因，2026-10-14）**：`pnpm build` 在 ~3000+ 路由时 V8 堆耗尽。根因是 **@marko/run-adapter-static crawler 无并发上限**：`crawl()` 把全部起始 URL 一次性 `.map(visit)`（`dist/index.js` L140），每个 in-flight visit 持有整次 Marko SSR 渲染状态 + 响应流 + htmlparser2 parser + 写文件流。我们的布局每页渲染 N 条链接的 nav ⇒ 单次渲染内存 ∝ N，全部并发 ⇒ 峰值 ∝ N²。
  - **放大器（已修）**：adapter 本来就会把路由表里所有无参数路由入队，我们又传了显式 `urls` 清单 ⇒ 起始队列 2N、每页爬两次（`Crawled 2006`/`5006` 的 ×2 来源）；起始队列不去重（`seen` 只管链接发现）。已从 vite.config 移除 `urls`（crawl 次数减半）。
  - **验证**：阈值实测 ~2500 路由（默认 4GB 堆，1003 路由峰值 1.7GB）；给 crawler 加 100 并发上限（临时 node_modules 补丁，已还原）后 **5003 路由全过**（峰值 4.5GB，大头是 build 阶段打包 5003 个模块，不是 crawl）。
  - **上游反馈：挂起**（后续再决定是否报 issue/PR；两个 bug 上游 2.0.10 至今未修）。**两处修复均已落地（2026-10-15）**：(1) markopress `patches/@marko__run-adapter-static.patch`（注册于 `pnpm-workspace.yaml`）——起始队列去重 + 全局 100 并发上限（路径队列 + worker 池，替换 `Promise.all` 波次循环；只 cap 起始批对深链接拓扑不够）+ visit 异常首错语义，5003 路由实测 `Crawled 5003, success 5003`、峰值 RSS 4.31GB、耗时 2:15；(2) markopack 的 vendored `adapter-static/src/crawler.ts` 同步修复（含 `await finished(pageWriter)` 对齐上游 2.0.10——旧 vendored 缺这行，crawl 会在页面文件 flush 完前返回），`npm run test:crawler` 单测守卫，偏离记录于其 UPSTREAM_SYNC.md，`sync:marko-run:check` 会显式报告该文件待重放修复。

## Phase 1 最短必做清单

1. **`.md` → 虚拟模块 transform**：`{ html, frontmatter, headings }`，生成的 `+page.marko` 变成极小包装（import 虚拟模块 + `$!{input.html}`）。HTML 不再内联 → 生成文件不再随内容抖动，md 编辑走 HMR，为 unified/shiki 铺路。
2. **marked → unified 管线**：remark-gfm、rehype-slug、headings 提取、shiki。
3. **nav.json → site-data 虚拟模块**（形态已在本 spike 验证）。
4. **主题机制**：`+layout.marko` 由主题包（taglib）提供；frontmatter `layout:` 选布局。
5. **死锁 issue 上游提交**（带最小复现）。
6. md HMR：先接受整页刷新；后续研究 @marko/vite 的 HMR 边界。

## 运行

```sh
pnpm install
pnpm dev       # localhost:3000，改/增/删 content/*.md 即时生效
pnpm build     # dist/public/ 静态站
pnpm preview   # sirv 预览构建产物
pnpm gen       # 手动跑一次生成器（一般不需要，dev/build 自动跑）
```

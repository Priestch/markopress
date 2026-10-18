# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目是什么

markopress：基于 Marko 6 + `@marko/run` 的内容框架（VitePress/Astro 形态，`.md` 文件即页面）。当前处于 **Phase 1（content 层）进行中：markdown 已接入 content layer，单文件增量同步已落地**。技术决策（D1–D6）已定稿于 `docs/background.md`，不要重新讨论；五份调研报告在 `docs/research/`（与实际不符时以 `node_modules/@marko/run` 安装源码为准；`rspack-watcher.md` 是 markopack/Rspack 迁移评估依据）。

仓库是 pnpm workspace：`packages/content`（@markopress/content，内容层契约 + store，整体抄 Astro Content Layer 契约）、`packages/markdown`（@markopress/markdown，`.md` EntryType + unified 渲染器）、`packages/theme-docs`（默认文档主题）、`packages/plugin-rss` / `plugin-sitemap`（插件）——**在工作目录对应的包前先读其 AGENTS.md**。root 暂时兼任 spike app（收包为 `packages/site` 的定案见 `docs/plan-site-package.md`，等 markopack 发版后执行，勿提前讨论）。

## 常用命令

```sh
pnpm dev       # 主链路 = markopack（Rspack）dev，**默认是文档站（content/，dogfood 验证功能）**
                #   PORT 指定端口；含 dev full-reload（SSE + /__markopack_reload.js 注入）
pnpm build     # 文档站 SSG：dist/server/public/ 自包含静态根（build 自动清 dist）
pnpm dev:perf  # 性能测试形态（content.perf.config.ts = 文档 + content-perf/ 5000 页夹具）
pnpm build:perf# 性能测试 SSG；夹具生成：node scripts/perf-test.mjs 5000
pnpm dev:vite  # Vite 对照路径（@marko/run + vite.config.ts + markopress-plugin.ts）
pnpm build:vite# Vite SSG：dist/public/*.html（与 rspack 产物同用 dist/，对比前先清）
pnpm preview   # 预览 Rspack 产物（sirv dist/server/public，/404 兜底）；preview:vite 预览 Vite 产物
pnpm gen       # 手动跑路由生成器（dev/build 会自动跑，一般不需要）
```

**perf 与默认链路解耦**：默认 `content.config.ts` 只有 docs 集合；perf 走 `MP_CONTENT_CONFIG=content.perf.config.ts`（dev:perf/build:perf 已带）。两配置 digest 不同 ⇒ 切换触发 store 全量重建 + 生成目录收缩/扩张（write-if-changed + 差集清理，自愈，切换是低频操作）。

pnpm --filter @markopress/content test    # 内容层包 vitest（含单文件增量）
pnpm --filter @markopress/markdown test   # markdown 包 vitest
```

**双路并行纪律（同树双命令，不用 git 分支）**：内容层/store/`gen-routes.ts`/`content-modules.ts` 为两路共享，新功能落共享层；打包器特定代码只允许出现在 `virtual:mp/content/` 解析与 watcher 层（Vite = markopress-plugin.ts，Rspack = rspack-*.ts）。对比数据见 `docs/perf-rspack-vs-vite.md`。

Node ≥ 22.18（原生 type stripping，workspace 包以 TS 源码分发，无构建步骤），pnpm 12（esbuild 构建审批在 `pnpm-workspace.yaml` 的 `allowBuilds`——package.json 的 `pnpm` 字段已不读）。app 级无 linter —— 验收靠浏览器手测（Playwright MCP）与 `pnpm build`；两个包有 vitest。markopack 以 `link:../markopack` 直连本地工作区（未发版的编排层/crawler 修复必须本地直连；`@marko/runtime-tags` 需为直接依赖，pnpm 严格布局下水合入口从根解析）。

## 架构（数据流）

```
content.config.ts：集合定义（loader: glob + zod schema），docs→content/（默认仅此一个；
     perf→content-perf/ 在 content.perf.config.ts，经 MP_CONTENT_CONFIG 启用）
markopress.config.ts：管线与插件 + 主题（defineMarkoPressConfig({ theme, themeOptions, plugins })；
     契约 = docs/plugin-design.md，主题契约 = docs/research/themes.md §9；装配点 = content.ts
     setup()（theme 解析 + 槽位校验 fail fast），两路 watcher 都监听它的变更 → resetSynced 全量重建）
     │
     ▼  scripts/content.ts（ensureSynced 单例：装载 store/meta → sync → typegen → 插件注册/通知）
content*/ ──glob loader(markdownEntryType)──▶ .markopress/store/<collection>.json（devalue）
     │
     ▼  scripts/gen-routes.ts（数据源 = store.values()；含插件 routes 钩子产出的 +handler.mjs；
        sidebar.ts 纯函数派生侧边栏树 + flat 序）
.markopress/（gitignore，全部生成物）
  ├─ routes/+layout.marko      静态外壳：<mp-layout> 槽位（import sidebar.json，永不变化）
  ├─ routes/<name>+page.marko  极小包装：<mp-page> 槽位（import 虚拟模块 + page-nav.js）
  ├─ routes/<seg%2E…>+handler.mjs  插件路由包装（路径段含 `.` 必须 %2E，动词逐个 export const）
  ├─ plugin-data/<name>.js     插件数据模块（setData 产物；经 virtual:mp/plugin/<name> 消费）
  ├─ sidebar.json              侧边栏树+flat 序（模块 import；重写走模块图失效——prev/next 同源）
  ├─ page-nav.js / urls.json   静态邻居助手（永不变化）/ SSG 显式清单
     │
     ▼  scripts/markopress-plugin.ts（markopress() Vite 插件）
虚拟模块 virtual:mp/content/<collection>/<id> → { data, segments, headings }
  （惰性渲染 + digest 内存缓存；segments 数组为 md 内 Marko 组件段留门，本期只有 html 段；
   transformBody/pageData 钩子在渲染路径上，按有效 digest 缓存——scripts/content-modules.ts。
   prev/next 不进虚拟模块：跨文件数据，per-entry digest 缓存会在重排后过期——走 sidebar.json）
packages/theme-docs：@markopress/theme-docs 主题包（mp-layout/mp-sidebar/mp-page 槽位实现；
  marko.json tags-dir 经 root 包依赖探测全局发现；暗色 = data-theme 属性 + <html-script>
  内联 pre-paint 脚本；契约细节见其 AGENTS.md）
vite.config.ts：markopressPlugin() 包裹 markoRun({ routesDir, adapter: staticAdapter() })
  （不传 urls——adapter 自动爬无参数路由，显式清单会每页爬两次；见硬约束 3）
```

- **失效路径（死锁纪律的落地点）**：md 编辑 → `syncer.syncFile`（O(1)：只读事件文件，load 建立的 fileToId 映射定位）→ 只失效该 entry 的虚拟模块（Vite 模块图）→ full-reload；routes 目录零写入。slug 增/删才产生单 `+page.marko` 文件事件，marko-run dev watcher 对此 re-walk——「再生成 × re-walk」是核心机制（`docs/spike-notes.md`）。config 文件变更（content/markopress 两者）→ resetSynced 全量重建。插件 `contentSynced(changed)` 在批次末后台入队（进程级单飞链），plugin-data 落盘走模块图/原生 watcher 失效，同样不碰 routes 目录。
- watcher 监听所有集合 loader 声明的 `watchDirs`（多集合多 base 目录都覆盖）。
- **Rspack 双胞胎路径**（`scripts/rspack-*.ts`）：同样的 sync/gen 前置，虚拟模块改为落盘 `.markopress/vcontent/`（`NormalModuleReplacementPlugin` 重写 `virtual:mp/content/`），失效走 Rspack 原生 watcher；slug 增/删由 markopack 内置 watchRoutes re-walk（进程内增量，无 marko-run 的全量 re-walk 风暴）。模块源码唯一来源在 `scripts/content-modules.ts`（两后端共用）。
- 已知边界：store flush 整集合 JSON 重写（写放大，deltas #3 的分块持久化是升级路径）；dev 启动若新增数千路由文件，marko-run watcher re-walk 风暴会卡首个请求 ~1min（路由规模问题，与内容增量无关）。
- 布局是 marko-run 的构建期融合（`<Layout><Page/></Layout>` 嵌套进单一入口模板），布局里用 `<${input.content}/>` 渲染页面。

## 硬约束（踩过坑的，改生成器/模板前必读）

1. **生成的 `+layout.marko` 必须保持静态**：nav 等站点数据走 `nav.json`（模块 import），运行期绝不能改布局文件。「新增 page + 修改 layout 同一 watcher 批次」会触发 marko-run 0.11.13 dev server 的竞态死锁（所有请求永久挂起），详见 `docs/spike-notes.md`。
2. **`$!{html}` 等插值不能出现在模板根级的裸行**：concise mode 会把它解析成 custom tag，必须包在显式开闭标签内（如 `<article>…</article>`）。
3. **static adapter 不传 `urls`**：adapter 本来就会爬路由表里所有无参数路由，显式清单会让每页爬两次（并发 ×2，大站点 OOM——见 spike-notes「build OOM」）。`urls.json` 生成保留（未来带参数路由的显式清单用）；若将来要传，`staticAdapter({ urls })` 只能传 async 函数——工厂在 vite.config 求值时立即调用，传数组会在生成器运行前求值（spike 踩坑记录）。
4. `/home/gp/Enter/marko`（marko monorepo）是**只读参考**：语法看 `packages/runtime-tags/cheatsheet.md`，resume 机制看 `RESUMABILITY.md`。绝不修改。
5. `@marko/run` 是 pre-1.0（0.11.x），API 会动；本仓库锁 `^0.11.13`。

## Marko 6 语法速查（本仓库用到过的）

状态 `<let/count=0>`（更新直接赋值 `count++`）；事件 `onClick() { … }`；循环 `<for|item| of=nav>`；动态标签/布局体 `<${input.content}/>`；原始 HTML `$!{html}`（须平衡片段）；模块级常量 `static const`；**模板级每次渲染的常量是 `<const/x=…>` 标签**（裸 `const x = …` 会被解析成 `<const>` 标签报错，除非前缀 `static`）；`.marko` 内可 `import nav from "../nav.json"`（走打包管线）；**内联 `<script>` 会被编译进浏览器 bundle（延迟执行）**——要字面内联 HTML（如 pre-paint 反闪脚本）必须用 `<html-script>`。

## 生成目录与 git

`.markopress/`（我们的生成物）、`.marko-run/`（marko-run 的类型）、`dist/` 均已 gitignore。`scripts/gen-routes.ts` 是路由生成器（vite.config 与 CLI 共用）、`scripts/markopress-plugin.ts` 是 Vite 插件本体、`scripts/content.ts` 是内容层装配单例；写文件前比对内容（write-if-changed），避免无效 watcher 抖动。`content-perf/` 是性能测试夹具（`node scripts/perf-test.mjs [N]` 生成）。

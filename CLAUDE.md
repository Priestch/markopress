# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目是什么

markopress：基于 Marko 6 + `@marko/run` 的内容框架（VitePress/Astro 形态，`.md` 文件即页面）。当前处于 **Phase 1（content 层）进行中：markdown 已接入 content layer，单文件增量同步已落地**。技术决策（D1–D6）已定稿于 `docs/background.md`，不要重新讨论；五份调研报告在 `docs/research/`（与实际不符时以 `node_modules/@marko/run` 安装源码为准；`rspack-watcher.md` 是 markopack/Rspack 迁移评估依据）。

仓库是 pnpm workspace：`packages/content`（@markopress/content，内容层契约 + store，整体抄 Astro Content Layer 契约）、`packages/markdown`（@markopress/markdown，`.md` EntryType + unified 渲染器）、`packages/theme-docs`（默认文档主题）、`packages/plugin-rss` / `plugin-sitemap` / `plugin-search`（插件，search = MiniSearch 本地搜索 + 首个 UI 槽位插件）、`packages/theme-base`（内容样式契约的机械部分，双主题共享）、`packages/theme-blog`（博客主题：layout post/home/list/page 分流）、**`packages/site`（狗粮站 = 未来脚手架模板形态：package.json + content/ + .markopress/{config.ts,components/}，收包已执行见 `docs/plan-site-package.md`）**——**在工作目录对应的包前先读其 AGENTS.md**。root 只做 workspace 编排（scripts 全部 `--filter` 代理进 site，命令名不变）。

## 常用命令

```sh
pnpm dev       # 主链路 = markopack（Rspack）dev，**默认是文档站（content/，dogfood 验证功能）**
                #   PORT 指定端口；含 dev full-reload（SSE + /__markopack_reload.js 注入）
pnpm build     # 文档站 SSG：dist/server/public/ 自包含静态根（build 自动清 dist）
pnpm dev:perf  # 性能测试形态（.markopress/perf.config.ts = 文档 + content-perf/ 5000 页夹具）
pnpm build:perf# 性能测试 SSG；夹具生成：node scripts/perf-test.mjs 5000
pnpm dev:vite  # Vite 对照路径（@marko/run + vite.config.ts + markopress-plugin.ts）
pnpm build:vite# Vite SSG：dist/public/*.html（与 rspack 产物同用 dist/，对比前先清）
pnpm preview   # 预览 Rspack 产物（sirv dist/server/public，/404 兜底）；preview:vite 预览 Vite 产物
pnpm gen       # 手动跑路由生成器（dev/build 会自动跑，一般不需要）
```

**perf 与默认链路解耦**：默认 `.markopress/config.ts` 只有 docs 集合；perf 走 `MP_CONTENT_CONFIG=.markopress/perf.config.ts`（dev:perf/build:perf 已带）。两配置 digest 不同 ⇒ 切换触发 store 全量重建 + 生成目录收缩/扩张（write-if-changed + 差集清理，自愈，切换是低频操作）。

pnpm --filter @markopress/content test    # 内容层包 vitest（含单文件增量）
pnpm --filter @markopress/markdown test   # markdown 包 vitest
pnpm --filter @markopress/plugin-search test  # search 包 vitest（节切分 + 索引往返）
```

**双路并行纪律（同树双命令，不用 git 分支）**：内容层/store/`gen-routes.ts`/`content-modules.ts` 为两路共享，新功能落共享层；打包器特定代码只允许出现在 `virtual:mp/content/` 解析与 watcher 层（Vite = markopress-plugin.ts，Rspack = rspack-*.ts）。对比数据见 `docs/perf-rspack-vs-vite.md`。

Node ≥ 22.18（原生 type stripping，workspace 包以 TS 源码分发，无构建步骤），pnpm 12（esbuild 构建审批在 `pnpm-workspace.yaml` 的 `allowBuilds`——package.json 的 `pnpm` 字段已不读）。app 级无 linter —— 验收靠浏览器手测（Playwright MCP）与 `pnpm build`；三个包有 vitest。**含 `.marko` tag 的包（theme-docs / plugin-search）必须声明 `@marko/runtime-tags` devDep**（编译产物 import 它；收包前靠 root 上溯解析，收包后 pnpm 严格布局下上溯链断——2026-10-25 踩过）。markopack 已接 npm `^0.4.0`（0.4.0 发版于 2026-10-25，含本仓库需要的全部修复：热路由/crawler 并发/public/ 约定/水合盲区等；本地工作区 `../markopack` 仅作上游开发参考——要试未发版改动时临时切回 `link:`）。**pnpm 12 坑**：lockfile 变更后 `pnpm run`（dev/build）可能卡死在「Verifying lockfile against supply-chain policies」——直跑 `node scripts/rspack-dev.ts` / `node scripts/rspack-build.ts`（在 packages/site 下）绕过。

## 架构（数据流）

```
.markopress/config.ts：唯一用户配置（VitePress .vitepress/config.ts 形态）——collections
     （内容层：loader + zod schema）+ theme/themeOptions/markdown/plugins（管线）合一；
     装配层按键分发（collections 子树单独算 store digest）。perf 形态 = perf.config.ts
     （MP_CONTENT_CONFIG 指向）。变更 → 两路 watcher resetSynced 全量重建。
     marko.json / .markopress/entry.ts 由 writeConventions 生成（用户不手写；
     marko.json 的 tags-dir → .markopress/components，目录不存在则不生成）
     │
     ▼  scripts/content.ts（ensureSynced 单例：装载 store/meta → sync → typegen → 插件注册/通知）
content*/ ──glob loader(markdownEntryType)──▶ .markopress/store/<collection>.json（devalue）
     │
     ▼  scripts/gen-routes.ts（数据源 = store.values()；含插件 routes 钩子产出的 +handler.mjs；
        sidebar.ts 纯函数派生侧边栏树 + flat 序）
.markopress/ 生成物区（gitignore；用户区 = 同目录的 config.ts/components/）
  ├─ routes/+layout.marko      静态外壳：<mp-layout> 槽位（import sidebar.json，永不变化；
  │                              插件 UI 槽位接线 <@search><mp-search/></@search> 在此生成，
  │                              由插件 slots 声明 gating——Marko 对未知 tag 是硬错误，且
  │                              taglib 探测从模板就近 package.json 出发，只有生成物能解析
  │                              插件包 taglib；位置归主题（<if=input.search>），实现归插件）
  ├─ routes/<name>+page.marko  极小包装：<mp-page> 槽位（虚拟模块 + page-nav）
  ├─ routes/<seg%2E…>+handler.mjs  插件路由包装（路径段含 `.` 必须 %2E，动词逐个 export const）
  ├─ plugin-data/<name>.js     插件数据模块（setData 产物；经 virtual:mp/plugin/<name> 消费）
  ├─ sidebar.json              侧边栏树+flat 序（模块 import；重写走模块图失效——prev/next 同源）
  ├─ page-nav.js / urls.json   静态邻居助手（永不变化）/ SSG 显式清单
     │
     ▼  scripts/markopress-plugin.ts（markopress() Vite 插件）
虚拟模块 virtual:mp/content/<collection>/<id> → { data, segments, headings }
  （惰性渲染 + digest 内存缓存；transformBody/pageData 钩子在渲染路径上，按有效 digest 缓存
   ——scripts/content-modules.ts。渲染 digest 带 ::extracted 命名空间：pluginCtx.render
   （搜索等插件）以原始 body 用裸 digest 缓存，不隔离会把未提取的 html 污染进模块渲染。
   prev/next 不进虚拟模块：跨文件数据，per-entry digest 缓存会在重排后过期——走 sidebar.json）
md 内 Marko 组件段（scripts/segments.ts）：.markopress/components/ 的 tag library（生成的 marko.json
  tags-dir 发现）在 md 块级直接 <tag/>。提取→占位符注释→渲染后切段（html|component）→
  组件段落盘 .markopress/vseg/<c>/<id>/<n>.marko→模块 import virtual:mp/segment/…（rspack
  NormalModuleReplacementPlugin / vite resolveId 双侧解析到真实文件，编译归 bundler）→
  mp-page <${seg.component}/> 动态渲染 + Marko 水合。**markopack 配套**：translator 的
  hydrate 发射只看 .marko→.marko 闭包，.js 中转的组件需 MarkoRspackPlugin 补浏览器入口
  import（clientHydrateImports，必须在 ?browser-entry 之前执行否则注册晚于 init）。
  已知边缘：dev 会话中途新增组件文件要重启（taglib 进程缓存）；fenced code 内安全。
资产管线（scripts/images.ts，app 共享层，两后端共用）：md 块级 <mp-image …/>（mp-* 保留命名空间；
  行尾内联形态归一；属性三形态（双/单/无引号）；fenced code 安全）→ 预提取占位符 → sharp webp srcset 梯 + blur 占位 +
  原图拷贝 → public/_markopress/image/<源内容 sha1 前8>/ 内容寻址落盘（vite 原生服务
  publicDir；rspack 靠 markopack dev sirv 链 + adapter-static buildEnd 拷贝——两处 public/
  约定是本次在 markopack 配套落地的）。资产不进 store、不进核心包（content AGENTS.md
  红线）；资产 digest 折进 entry 有效 digest（渲染/变换/pageData 缓存全级联），watcher 资产
  事件 → assetOwners（同目录/同名子目录）→ 重渲染归属 entry。v1 属性面：src/alt/layout/width|height/quality/sizes/placeholder/fetchpriority（per-tag quality 进变体文件名防覆盖）。
  v2 门（未做）：AVIF/<picture>/DPR densities/远程图优化/`image()` helper/组件内用图。
  解析缓存键必须含源内容 digest——同路径换字节不折叠键的话 vcontent 逐字节不变、失效断链（踩过）。
  **多主题共存撞名**：生成器显式 import 主题组件（mp-layout/mp-page 经解析后的主题包路径），
  不走 taglib 全局发现——site 同时装 theme-docs+theme-blog 时同名 tag 后者顶包（踩过）；
  插件功能槽位（mp-search）仍走发现（app 根就近、名字唯一）。
packages/theme-docs / theme-blog：主题包（同槽位契约互斥；theme-blog 按 frontmatter layout
  分流 post/home/list/page，flat 由生成器传参——主题不得自 import sidebar.json，跨包解析
  app 文件是 taglib 同款坑）。机械内容样式（mp-image/容器/shiki 切换）共享于 theme-base
  （<mp-content-styles/>，各主题渲染一次）；themeOptions.nav/titleTemplate/sidebar.sortBy
  经 sidebar.json/生成器透传。per-page <title> = postbuild HTML 补写（scripts/patch-titles.ts，
  marko-run 无 head 通道；rspack 在 rspack-build.ts 收尾，vite 在 build:vite 串联脚本——
  adapter 爬取晚于一切 Vite 钩子；dev 期显示站名 = 已知边界）。暗色 = data-theme 属性 +
  <html-script> 内联 pre-paint 脚本；契约细节见各包 AGENTS.md
vite.config.ts：markopressPlugin() 包裹 markoRun({ routesDir, adapter: staticAdapter() })
  （不传 urls——adapter 自动爬无参数路由，显式清单会每页爬两次；见硬约束 3）
```

- **失效路径（死锁纪律的落地点）**：md 编辑 → `syncer.syncFile`（O(1)：只读事件文件，load 建立的 fileToId 映射定位）→ 只失效该 entry 的虚拟模块（Vite 模块图）→ full-reload；routes 目录零写入。slug 增/删才产生单 `+page.marko` 文件事件，marko-run dev watcher 对此 re-walk——「再生成 × re-walk」是核心机制（`docs/spike-notes.md`）。config 文件变更（.markopress/config.ts，rspack 侧盯 .markopress 目录非递归）→ resetSynced 全量重建。插件 `contentSynced(changed)` 在批次末后台入队（进程级单飞链），plugin-data 落盘走模块图/原生 watcher 失效，同样不碰 routes 目录。
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

`.markopress/` 已翻转语义：**用户目录**（config.ts/perf.config.ts/components/，git 跟踪）+ 生成物子目录（store/routes/vcontent/vseg/plugin-data/sidebar.json/page-nav.js/urls.json/content.d.ts/entry.ts，选择性 gitignore——`*` 排除 + 显式反排除）。**清缓存 = 删生成子目录，绝不能 `rm -rf .markopress`**（会删用户配置）。`.marko-run/`、`dist/`、`packages/site/marko.json`（生成）仍 gitignore。`packages/site/scripts/gen-routes.ts` 是路由生成器（vite.config 与 CLI 共用）、`packages/site/scripts/markopress-plugin.ts` 是 Vite 插件本体、`packages/site/scripts/content.ts` 是内容层装配单例；写文件前比对内容（write-if-changed），避免无效 watcher 抖动。`content-perf/` 是性能测试夹具（`node scripts/perf-test.mjs [N]` 生成）。

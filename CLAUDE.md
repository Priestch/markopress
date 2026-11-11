# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目是什么

markopress：基于 Marko 6 + `@marko/run` 的内容框架（VitePress/Astro 形态，`.md` 文件即页面）。当前处于 **Phase 1（content 层）进行中：markdown 已接入 content layer，单文件增量同步已落地**。技术决策（D1–D6）已定稿于 `docs/background.md`，不要重新讨论；五份调研报告在 `docs/research/`（与实际不符时以 `node_modules/@marko/run` 安装源码为准；`rspack-watcher.md` 是 markopack/Rspack 迁移评估依据）。

仓库是 pnpm workspace：**`packages/engine`（= npm 包 `markopress`：引擎 CLI + 内容层 `src/content/`（契约整体抄 Astro Content Layer，红线 = 目录级审计测试锁 import 面）+ markdown 渲染器 `src/markdown/` + 内置 rss/sitemap/search `src/builtins/`）**、`packages/theme-base`（内容样式机械部分，双主题共享）、`packages/theme-docs` / `theme-blog`（互斥主题）、**`packages/site`（狗粮站 = 脚手架模板形态；scripts 全部走 `markopress` bin——狗粮面即用户面）**。2026-10-29 包收敛：9 包 → 6 包（引擎 1 + 主题 3 + site + ……npm 发布面 = markopress + theme-base + theme-docs + theme-blog 四个；用户 package.json 只见 markopress + 一个主题）。分层不变（D4：content 子树红线由 engine/tests/content/audit.test.ts 守住）；插件契约不变（内置件与第三方 markopress-plugin-* 同形）。**在 engine 的 content/markdown 子树工作前先读其 AGENTS-content/AGENTS-markdown**。root 只做编排。

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
                #   site 的 public/ = 源站静态资产（robots.txt 等；rspack dev sirv 链 +
                #   adapter build 拷贝，markopack 0.4.0 约定）
```

**perf 与默认链路解耦**：默认 `.markopress/config.ts` 只有 docs 集合；perf 走 `MP_CONTENT_CONFIG=.markopress/perf.config.ts`（dev:perf/build:perf 已带）。两配置 digest 不同 ⇒ 切换触发 store 全量重建 + 生成目录收缩/扩张（write-if-changed + 差集清理，自愈，切换是低频操作）。

pnpm --filter markopress test  # 引擎全家 vitest：content 63 + markdown 21 + search 12 + images 23 + 根级 25（route-prefix/user-pages/collection-module）
```

**双路并行纪律（同树双命令，不用 git 分支）**：内容层/store/`gen-routes.ts`/`content-modules.ts` 为两路共享，新功能落共享层；打包器特定代码只允许出现在 `virtual:mp/content/` 解析与 watcher 层（Vite = markopress-plugin.ts，Rspack = rspack-*.ts）。对比数据见 `docs/perf-rspack-vs-vite.md`。

Node ≥ 22.18（原生 type stripping，workspace 包以 TS 源码分发，无构建步骤），pnpm 12（esbuild 构建审批在 `pnpm-workspace.yaml` 的 `allowBuilds`——package.json 的 `pnpm` 字段已不读）。app 级无 linter —— 验收靠浏览器手测（Playwright MCP）与 `pnpm build`；测试全在引擎包（86 个）。**含 `.marko` tag 的包（engine / theme-docs / theme-blog）必须声明 `@marko/runtime-tags` devDep**（编译产物 import 它；pnpm 严格布局下不声明就解析不到——2026-10-25 起踩过三次：theme-docs、engine 先后中招）。**markopack 当前临时 `link:` 本地**（`packages/engine/package.json` 两依赖指 `/home/gp/Enter/markopack/packages/*` **绝对路径**——pnpm 12 对 @scope 包的相对 `link:` 会少写一层目录、链接悬空；npm 版止步 0.4.0，dev.proxy 透传依赖本地未发版改动，切回时机 = markopack 发含 proxy 的版后）。本地工作区 `../markopack` 是上游开发位：改完先在其内 `pnpm build`（dist 是单文件 index.js 发射），markopress 侧无需重装。**pnpm 12 坑**：lockfile 变更后 `pnpm run`（dev/build）可能卡死在「Verifying lockfile against supply-chain policies」——在 site 下直跑 `node_modules/.bin/markopress dev|build` 绕过。

## 架构（数据流）

```
.markopress/config.ts：唯一用户配置（VitePress .vitepress/config.ts 形态）——collections
     （内容层：loader + zod schema；**可选 route: { prefix } 集合路由前缀**——物理目录与
     URL 解耦（content/operations/* → /guide/*），prefix 拼 entry id 进 routeFor/pageFileFor
     即全链路生效（文件名/URL/侧边栏/prev-next/urls.json/ctx.urlOf 三件内置）；集合 index
     → /<prefix> 着陆页（尾段 index 折叠）；entry "404" 禁入带前缀集合，gen 期 fail fast）
     + theme/themeOptions/markdown/plugins（管线）合一；
     装配层按键分发（collections 子树单独算 store digest）。perf 形态 = perf.config.ts
     （MP_CONTENT_CONFIG 指向）。变更 → 两路 watcher resetSynced 全量重建。
     marko.json / .markopress/entry.ts 由 writeConventions 生成（用户不手写；
     marko.json 的 tags-dir → .markopress/components，目录不存在则不生成）
     │
     ▼  engine/src/content.ts（ensureSynced 单例：装载 store/meta → sync → typegen → 插件注册/通知）
content*/ ──glob loader(markdownEntryType)──▶ .markopress/store/<collection>.json（devalue）
     │
     ▼  engine/src/gen-routes.ts（三源路由表：store.values() 投影 + app 根 pages/ 用户页
        薄包装（user-pages.ts）+ 插件 routes 钩子 handler；三源 URL 撞车 gen 期 fail fast；
        sidebar.ts 纯函数派生侧边栏树 + flat 序（产出并入 site.json））
.markopress/ 生成物区（gitignore；用户区 = 同目录的 config.ts/components/；**app 根 pages/
  = 用户自定义页源（组件不进 store，custom-pages-design.md）**）
  ├─ routes/_content/+layout.marko   主题外壳：只包派生内容页——**根目录不放 layout**（root
  │                              layout 包住一切，pathless group 隔离不了外层；用户页要默认
  │                              裸，§4.2）。插件 UI 槽位接线 <@search><mp-search/></@search>
  │                              在此生成，由插件 slots 声明 gating——Marko 对未知 tag 是硬
  │                              错误，且 taglib 探测从模板就近 package.json 出发，只有生成物
  │                              能解析插件包 taglib；位置归主题（<if=input.search>），实现归插件）
  ├─ routes/_content/<name>+page.marko  极小包装：<mp-page> 槽位（虚拟模块 + page-nav；显式
  │                              import 主题组件——多主题共存时 taglib 发现撞名，见 mp-* 治理段）
  ├─ routes/_pages/<user>+page.marko    用户页薄包装（user-pages.ts）：显式 import app 根
  │                              pages/ 真身（.marko→.marko 闭包，水合语义不变）；默认无外壳，
  │                              要外壳 = 页内显式 import 主题 Layout（opt-in）；违禁命名
  │                              `[`动态段/`+`角色/`_`pathless/文件名点号——gen 期 fail fast
  ├─ routes/+404.marko         内容驱动 404（根特例：marko-run 约定根目录无路径前缀 +404
  │                              后缀 = NotFound 页；前缀会被解析成路径段从而失去 special
  │                              身份——404+404.marko 踩过。根无 layout ⇒ 包装内显式包主题
  │                              Layout）。
  │                              dev 未知路由 text/html → 渲染它回 404；build 经 adapter
  │                              notFoundPath 落 404.html；404 不进侧边栏/prev-next
  ├─ routes/<seg%2E…>+handler.mjs  插件路由包装（路径段含 `.` 必须 %2E，动词逐个 export const）
  ├─ plugin-data/<name>.js     插件数据模块（setData 产物；经 virtual:mp/plugin/<name> 消费）
  ├─ site.json                 站点数据模块（site/style/nav/head/tree/flat；模块 import，
  │                              重写走模块图失效——prev/next 同源。原 sidebar.json 改名，生成期自愈清理旧文件）
  ├─ page-nav.js / urls.json   静态邻居助手（永不变化）/ SSG 显式清单
     │
     ▼  engine/src/markopress-plugin.ts（markopress() Vite 插件）
虚拟模块 virtual:mp/content/<collection>/<id> → { data, segments, headings }
  （惰性渲染 + digest 内存缓存；transformBody/pageData 钩子在渲染路径上，按有效 digest 缓存
   ——engine/src/content-modules.ts。渲染 digest 带 ::extracted 命名空间：pluginCtx.render
   （搜索等插件）以原始 body 用裸 digest 缓存，不隔离会把未提取的 html 污染进模块渲染。
   prev/next 不进虚拟模块：跨文件数据，per-entry digest 缓存会在重排后过期——走 sidebar.json）
md 内 Marko 组件段（engine/src/segments.ts）：.markopress/components/ 的 tag library（生成的 marko.json
  tags-dir 发现）在 md 块级直接 <tag/>。提取→占位符注释→渲染后切段（html|component）→
  组件段落盘 .markopress/vseg/<c>/<id>/<n>.marko→模块 import virtual:mp/segment/…（rspack
  NormalModuleReplacementPlugin / vite resolveId 双侧解析到真实文件，编译归 bundler）→
  mp-page <${seg.component}/> 动态渲染 + Marko 水合。**markopack 配套**：translator 的
  hydrate 发射只看 .marko→.marko 闭包，.js 中转的组件需 MarkoRspackPlugin 补浏览器入口
  import（clientHydrateImports，必须在 ?browser-entry 之前执行否则注册晚于 init）。
  已知边缘：dev 会话中途新增组件文件要重启（taglib 进程缓存）；fenced code 内安全。
资产管线 v2（engine/src/images.ts = 叶子管线 + images-owners.ts = ensureSynced 归属三件套，app 共享层，
  docs/images-v2-design.md 定稿）：md 块级 <mp-image …/> + **md ![]() 接管（config.images.markdown，
  默认关——只接管独立段落，行内不接管）** + **页面侧 <mp-image> Marko 组件**（engine tags/，用户页/
  .markopress/components 可用；`server import` + `<await>` 无占位 = 零客户端 JS）→ 预提取占位符 →
  sharp 变体（formats 默认 ["webp"]，含 "avif" 即 <picture> 多格式）+ blur/color/none 占位 + 原图拷贝 →
  public/_markopress/image/<源内容 sha1 前8>/ 内容寻址落盘。**远程图**（授权面 config.images.domains/
  remotePatterns，SSRF 防线；未授权 = 直通 <img>）fetch 走 .markopress/cache/images/ HTTP 语义缓存
  （max-age/24h 启发式新鲜度 + etag/last-modified 条件重验 + 失败陈旧降级；build 硬炸 dev 软降级 =
  MARKOPRESS_PHASE）。属性面 v2 增 formats/densities/title/class/placeholder=color。
  **叶子层纪律（踩过）**：tags/*.marko 的 server import 只能指叶子模块——ensureSynced 边会把
  内容层/CLI 集群拖进 server bundle（cli.ts TLA + markopack sirv 解析全炸）；设置经
  .markopress/images-settings.json 传递（setup 落盘、渲染期 mtime 缓存读）；sharp 在 rspack
  server 侧 externals 绝对路径外部化（vite SSR 默认 externalize，无需处理）。
  资产不进 store、不进核心包（content AGENTS.md 红线）；资产 digest 折进 entry 有效 digest
  （渲染/变换/pageData 缓存全级联），watcher 资产事件 → assetOwners（entry 目录子树递归——
  img/ 等深层旁挂目录也级联，blockers #7）→ 重渲染
  归属 entry。v1 属性面：src/alt/layout/width|height/quality/sizes/placeholder/fetchpriority
  （per-tag quality 进变体文件名防覆盖）。
  剩余门（未做）：frontmatter `image()` helper。
  解析缓存键必须含源内容 digest——同路径换字节不折叠键的话 vcontent 逐字节不变、失效断链（踩过）。
  **mp-* 命名空间治理（装配期 validateNamespace，fail fast）**：① 主题组件显式 import
  （生成器经 resolveTheme 包路径写 import——多主题共存时 taglib 全局发现撞名，theme-blog
  曾顶包 theme-docs，踩过）；② 插件槽位必须 mp-* 且唯一（原有）；③ 插件槽位不得与
  ACTIVE 主题 tag 同名；④ 用户组件目录禁 mp-* 前缀（撞插件 tag + 遮蔽管线 <mp-image>）。
  插件功能槽位（mp-search）仍走 taglib 发现（app 根就近、经此治理名字唯一）。
packages/theme-docs / theme-blog：主题包（同槽位契约互斥；theme-blog 按 frontmatter layout
  分流 post/home/list/page，flat 由生成器传参——主题不得自 import sidebar.json，跨包解析
  app 文件是 taglib 同款坑）。机械内容样式（mp-image/容器/shiki 切换）共享于 theme-base
  （<mp-content-styles/>，各主题渲染一次）；themeOptions.nav/titleTemplate/sidebar.sortBy
  经 site.json/生成器透传。站点级 head 注入（GA/Clarity/字体/验证 meta）：config 顶层 `head: [{tag, attrs?, content?}]`
  （站点关切，不进 themeOptions——换主题不丢统计）→ sidebar.json.head → 生成器传
  mp-layout → 主题 <head> 渲染 <mp-head-entries/>（theme-base，裸 HTML 构造——内联
  script 必须字面进首帧，走 Marko 编译会进 bundle 延迟执行）。自定义 CSS = public/
  文件 + head link 条目；注意 markopack 主题 CSS 在 head 末注入，站点 CSS 需抬特异性
  （html 前缀）才能稳赢。per-page <title> = postbuild HTML 补写（engine/src/patch-titles.ts，
  marko-run 无 head 通道；rspack 在 rspack-build.ts 收尾，vite 在 build:vite 串联脚本——
  adapter 爬取晚于一切 Vite 钩子；dev 期显示站名 = 已知边界）。暗色 = data-theme 属性 +
  <html-script> 内联 pre-paint 脚本；契约细节见各包 AGENTS.md
vite.config.ts：markopressPlugin() 包裹 markoRun({ routesDir, adapter: staticAdapter() })
  （不传 urls——adapter 自动爬无参数路由，显式清单会每页爬两次；见硬约束 3）
```

- **失效路径（死锁纪律的落地点）**：md 编辑 → `syncer.syncFile`（O(1)：只读事件文件，load 建立的 fileToId 映射定位）→ 只失效该 entry 的虚拟模块（Vite 模块图）→ full-reload；routes 目录零写入。slug 增/删才产生单 `+page.marko` 文件事件，marko-run dev watcher 对此 re-walk——「再生成 × re-walk」是核心机制（`docs/spike-notes.md`）。config 文件变更（.markopress/config.ts，rspack 侧盯 .markopress 目录非递归）→ resetSynced 全量重建。插件 `contentSynced(changed)` 在批次末后台入队（进程级单飞链），plugin-data 落盘走模块图/原生 watcher 失效，同样不碰 routes 目录。
- **用户自定义页失效路径（custom-pages §4.1）**：改 `pages/*.marko` 内容 → 模块图直连（包装 import 真身，Rspack 原生 watcher / Vite 模块图失效，**routes 目录零事件**）；增/删/改名 → 批末 generateRoutes 写/删单个 `_pages/` 包装 → markopack watchRoutes 进程内增量 re-walk。pages/ 事件在两侧 watcher 分流（isUserPageFile），不走 syncFile/assetOwners；纯用户页批次跳过插件增量。
- watcher 监听所有集合 loader 声明的 `watchDirs`（多集合多 base 目录都覆盖）。
- **Rspack 双胞胎路径**（`engine/src/rspack-*.ts`）：同样的 sync/gen 前置，虚拟模块改为落盘 `.markopress/vcontent/`（`NormalModuleReplacementPlugin` 重写 `virtual:mp/content/`），失效走 Rspack 原生 watcher；slug 增/删由 markopack 内置 watchRoutes re-walk（进程内增量，无 marko-run 的全量 re-walk 风暴）。模块源码唯一来源在 `engine/src/content-modules.ts`（两后端共用）。
- 已知边界：store flush 整集合 JSON 重写（写放大，deltas #3 的分块持久化是升级路径）；dev 启动若新增数千路由文件，marko-run watcher re-walk 风暴会卡首个请求 ~1min（路由规模问题，与内容增量无关）。
- 布局是 marko-run 的构建期融合（`<Layout><Page/></Layout>` 嵌套进单一入口模板），布局里用 `<${input.content}/>` 渲染页面。

## 硬约束（踩过坑的，改生成器/模板前必读）

1. **生成的 `_content/+layout.marko` 必须保持静态**：nav 等站点数据走 `site.json`（模块 import），运行期绝不能改布局文件。「新增 page + 修改 layout 同一 watcher 批次」会触发 marko-run 0.11.13 dev server 的竞态死锁（所有请求永久挂起），详见 `docs/spike-notes.md`。树形约束（custom-pages §4.2）：**根目录不放 layout**——root layout 包住一切含 `_pages/`，用户页默认裸就无处安放；主题外壳只住 `_content/`，404 在包装内显式包 Layout。
2. **`$!{html}` 等插值不能出现在模板根级的裸行**：concise mode 会把它解析成 custom tag，必须包在显式开闭标签内（如 `<article>…</article>`）。
3. **static adapter 不传 `urls`**：adapter 本来就会爬路由表里所有无参数路由，显式清单会让每页爬两次（并发 ×2，大站点 OOM——见 spike-notes「build OOM」）。`urls.json` 生成保留（未来带参数路由的显式清单用）；若将来要传，`staticAdapter({ urls })` 只能传 async 函数——工厂在 vite.config 求值时立即调用，传数组会在生成器运行前求值（spike 踩坑记录）。
4. `/home/gp/Enter/marko`（marko monorepo）是**只读参考**：语法看 `packages/runtime-tags/cheatsheet.md`，resume 机制看 `RESUMABILITY.md`。绝不修改。
5. `@marko/run` 是 pre-1.0（0.11.x），API 会动；本仓库锁 `^0.11.13`。

## Marko 6 语法速查（本仓库用到过的）

状态 `<let/count=0>`（更新直接赋值 `count++`）；事件 `onClick() { … }`；循环 `<for|item| of=nav>`；动态标签/布局体 `<${input.content}/>`；原始 HTML `$!{html}`（须平衡片段）；模块级常量 `static const`；**模板级每次渲染的常量是 `<const/x=…>` 标签**（裸 `const x = …` 会被解析成 `<const>` 标签报错，除非前缀 `static`）；`.marko` 内可 `import nav from "../nav.json"`（走打包管线）；**内联 `<script>` 会被编译进浏览器 bundle（延迟执行）**——要字面内联 HTML（如 pre-paint 反闪脚本）必须用 `<html-script>`。

## 生成目录与 git

`.markopress/` 已翻转语义：**用户目录**（config.ts/perf.config.ts/components/，git 跟踪）+ 生成物子目录（store/routes/vcontent/vmeta/vseg/vcollection/plugin-data/site.json/page-nav.js/urls.json/content.d.ts/entry.ts，选择性 gitignore——`*` 排除 + 显式反排除）。**vmeta = per-entry 元数据（data/headings，client-safe）；集合模块 `virtual:mp/collection/<name>` 只聚合 vmeta——html 正文（segments）只住 vcontent 的 SSR 渲染链，聚合进集合模块会把全集合正文烤进浏览器共享 chunk（pdflux 585.js 反馈，resumability 下纯死重）**。**清缓存 = 删生成子目录，绝不能 `rm -rf .markopress`**（会删用户配置）。`.marko-run/`、`dist/`、`packages/site/marko.json`（生成）仍 gitignore；**app 根 `pages/` = 用户自定义页源（git 跟踪，dogfood 见 packages/site/pages/showcase.marko）**。引擎侧：`packages/engine/src/gen-routes.ts` 是路由生成器（三源：store 投影 + pages/ 用户页 + 插件 handler）、`user-pages.ts` 是用户页薄包装/撞车/镜像清理、`markopress-plugin.ts` 是 Vite 插件本体、`content.ts` 是内容层装配单例；写文件前比对内容（write-if-changed），避免无效 watcher 抖动。`content-perf/` 是性能测试夹具（`node scripts/perf-test.mjs [N]` 生成）。

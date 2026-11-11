# pdflux 试点：上游阻塞清单（markopress / markopack）

> 2026-11-09 晚整理自 pai-websites 复刻试点（源：paoding-officialweb/sites/pdflux，9 路由；
> 逐页工作原理与技术选型见 `pai-websites/docs/pdflux-analysis.md`）。单文件汇总当前**全部**
> 上游阻塞，按归属仓库分节，每项状态以当日代码核实为准；进展直接更新本文件。
> markopack 侧条目与 `markopack/docs/rspack-capability-exposure.md`（2026-11-09 反馈）呼应。

## 速览

| # | 阻塞 | 归属 | 影响 | 状态（2026-11-11 复核） |
|---|---|---|---|---|
| 1 | i18n 双模式设计（pdflux 运行时切换 / nanodoc 构建期双产物） | markopress | 高——卡着陆页文案抽取与 /en | 未开工（engine 无任何 locale 能力） |
| 2 | dev proxy：实现 + 透传 + 本地链路 | markopack → markopress | 高——卡 /blog 本地开发 | **已解决（本地源码链路跑通，dev/build 均验收）**。用户拍板「不发版，先用本地代码」——markopress 侧透传已提交（46bc488，dev.proxy commit，含 `link:` 绝对路径）；markopack 侧改动仍在其工作区，待 changesets 发版 |
| 3 | Strapi loader `contentPath` 默认值 | markopress | 低——试点已用选项绕过 | **已修（2026-11-11 入库）**：默认改扁平形状 `content` / `medias`（生产实例 102 条实测）；组件包装形态显式传参——设计稿 §3 已记默认值修正 |
| 4 | CSS 管线配方（less 双侧 + bootstrap modifyVars + postcss） | markopress 文档（依赖 #2 本地链路） | 中——卡样式平移 | 对象形 server 合并已在 markopack 工作区可用 |
| 5 | 多环境矩阵配方（SITE_ENV × locale + assetPrefix CDN） | markopress 配方 | 中——卡上线对齐 | 大部分 app 层可解，求官方配方 |
| 6 | 用户自定义页 404 特例（pages/404.marko → 根 +404） | markopress | 中——卡源站「404=客户端跳首页」复刻 | **已入库（2026-11-10 修复、11-11 提交）**：userPageFileFor 404 特例 + 包装落 routes 根 + MergeResult.hasNotFoundPage → 根级差集清理；engine 测试覆盖。custom-pages-design.md §4.2 已补记 |
| 7 | 旁挂资产 digest 扫描不递归子目录（img/ 形态不级联失效） | markopress | 低——FAQ 图片基本不变，重启即愈 | **已修（2026-11-11 入库）**：entryDirsFor 改 subtreeDirs 递归（点前缀目录跳过），digest 折叠面与 watcher 归属同步放大（两处同面，防漏映射）；subtreeDirs 单测覆盖 |
| 8 | 用户自定义页嵌套 index 路由（pages/guide/index.marko → /guide） | markopress | 中——卡 /guide 重定向页 | **已入库（2026-11-11）**：userPageFileFor/scanUserPages 补 `/\/index$/` 剥离，与集合通道 routeIdFor 对齐；撞车（目录 index vs 显式同名页）merge 期 fail fast；专测 scan/merge 两面覆盖 |
| 9 | 内容配置指纹：schema 变更不失效 store（deltas #9 app 侧欠账） | markopress | 中——schema 加字段后旧数据带旧的剥离存活 | **已随 46bc488 提交（dev.proxy 批次，msg 未提 digest——2026-11-11 上游复核确认；content.ts 工作区无 diff）**。曾误记为 92ce4bc，已勘误 |
| 10 | md `![]()` 接管缺默认值配置面（width/quality/densities 只有管线常量） | markopress | 高——卡 pdflux guide 15 页切接管（源站是全局配置驱动普通 md 的机制） | **已入库（2026-11-11）+ pdflux 已切换**：`images.markdown` 对象形（boolean 兼容），见 §6 |
| 11 | 「点开原图」无等价物，接管后消费方无补救钩子 | markopress | 中——行为差异（gatsby-remark-images 默认包 `<a href=原图>`） | **已入库（同批）**：`<mp-image link>` 属性 + 接管默认进 #10 配置对象，见 §6 |
| 12 | srcset 不含原始宽度档（densities 封顶） | markopress | 低——与 gatsby 产物对齐时的噪音项 | **已入库（同批）**：densities 模式恒补 sourceWidth 档，见 §6 |
| 13 | 非 md 内容通路的图片解析 API（strapi html 字符串内嵌图） | markopress | 中——pdflux /log 形态；即 v2 设计留的 real-CMS touchstone | 见 §6 |
| 14 | adapter-static 爬虫把资源 `<a>` 当页面爬：404 噪音 + `xxx.png.html` 垃圾 404 文档 | markopack | 中——#11 link 落地后暴露（资产链接进页面 HTML 即触发） | **已修复（2026-11-11，markopack 工作区未提交）**：scheduleVisit 资源扩展名跳过 + 404 分支不写 404 文档 |
| 15 | 浏览器产物无跨 entry 共享 chunk：每路由自包含 entry，共享模块（marko runtime/theme/公共组件）逐 entry 复制 | markopack | 中——首访仍占优（2~3×），但站内二次导航每页全量重下、CDN 产物重复（pdflux 3.4MB vs 源站 ~1MB） | **已反馈（2026-11-11）**：`markopack/docs/cross-entry-shared-chunks.md`——实测数据（16 个 guide 页 CSS 同 contenthash 4beae23f）+ 源码定位（config.ts:229 只配 runtimeChunk 无 splitChunks；rspack 默认 chunks:'async' 不拆同步 entry）+ ready() 单实例不变量（cacheGroup 钉 runtime-tags）+ 验收标准 |

## 1. i18n：双模式设计缺口（markopress）

消费侧两种真实形态（同一源仓库产出，都得支持）：

- **pdflux（运行时模式）**：单构建产物。SSG 首帧中文 → 客户端 `navigator.language === 'zh-CN' ? 'zh' : 'en'` 切换（源用 react-intl）；另设独立静态英文页 `/en`（硬编码 locale）；`/` 的 SEO head 客户端按浏览器语言切换组件。要求：首帧即有译文（不闪）、切换不整页刷新。
- **nanodoc（构建期模式）**：`GATSBY_LOCALE=zh/en` 各构建一次，两套产物、两域名（nanodoc.ai / nanodoc.paodingai.com）；e2e 测试锁死构建期选语言（禁 navigator.language）；SEO 首帧即正确语言。

已定技术方向（2026-11-10 修订，pdflux-analysis §3.1）：**两模式分开定**。pdflux 运行时半边改为 **app 层先做**（`fluent-bundle` 的 FluentBundle/FluentResource + bundle 回退链 + 自定义函数，模型与 pdf.js genericl10n 同构；**不搬 fluent-dom 的 DOM overlay**——MutationObserver 改 DOM 与 Marko 6 resumability 抢节点），做完再评估上收；SSR 期按默认中文格式化（首帧有译文、零客户端 JS），切语言走 Marko 客户端组件 `<let>` locale 信号。nanodoc 构建期双产物半边仍待 markopress 设计（禁 navigator、首帧需译文）。消息内 HTML 按「拆条」先例处理，标记结构留模板。

缺口事实：engine 全量 grep 无 i18n/locale 能力（仅 localeCompare 排序用途，2026-11-09 核实）。

需要 markopress 给的：

1. 设计文档（catalog 装配位置——config.ts？构建期 locale 维度怎么进 dev/build；双产物输出布局与路由/deploy 的衔接）；
2. 运行时切换在 Marko resumability 下的形态（locale 信号 + 组件级重渲染边界，避免整页 reload / hydration 冲突）；
3. SEO head 联动（`<html lang>`、title/description 按 locale）。

排期建议：pdflux 运行时半边优先（试点着陆页可先中文硬编码不被卡死）；nanodoc 构建期半边在第二站开工前落地即可。

## 2. dev proxy 交付链（markopack → markopress）

反馈文档：`markopack/docs/rspack-capability-exposure.md`（四项 ask：`dev({proxy})`、对象形 server 侧合并、不变量护栏文档化、`dev({headers})`/define 配方）。

进展事实（2026-11-09 晚核实于 markopack 工作区，**未提交**改动）：

- `packages/rspack/src/dev.ts`：`dev({ proxy, headers })` 完整实现——http-proxy-middleware（package.json 已见 `^3.0.10`）；段边界前缀匹配（`/api/v1` 不误伤 `/api/v10`）；`bypass` 三态（false 跳过 / 字符串改写为本地处理 / undefined 放行代理）；ws；与 SSE reload 包装组合（代理响应不注入 reload 脚本）。
- `packages/rspack/src/user-config.ts` + `index.ts`：对象形 rspack.config 的 **server 侧安全子集合并**（`SERVER_MERGE_KEYS = module/resolve/builtins/devtool/stats`；css 规则自动改写 `asset/source` 适配 SSR——less-loader 双侧正是试点要的）+ `resolve.alias` 深合并 / extensions 去重 + `assertManagedInvariants` 护栏（customize() 末尾校验，越界 fail fast）。

四项 ask 已一一对应实现；markopack 另有 changeset（`@markopack/rspack: minor`）、`test:dev-proxy` 回归脚本、README Managed invariants / DefinePlugin 配方。

**2026-11-10 更新：markopress 透传已落地，本地源码链路跑通**——`MarkoPressConfig.dev.proxy`（类型复用 markopack `DevProxyConfig`）→ `SyncedContent.dev` → `rspack-dev.ts` 的 `dev({ proxy })`；engine 依赖 `link:` 指向 `/home/gp/Enter/markopack/packages/rspack`（绝对路径绕 pnpm 12 悬空链接坑）；pdflux `.markopress/config.ts` 声明 `/api/v1`、`/crm`、`/webtool` 三条挂载。实跑验收：`/api/v1/user/info` 经 dev server → 后端 401 JSON 与直连一致、`/api/v10/*` 落本地 404（段边界）、代理响应无 reload 注入、`build:pdflux` 通过（dev 配置不进产物）。

**当前决定（用户 2026-11-10 拍板）：不提交、不发版，先用本地代码，升级后面再说**。两仓库改动保留在工作区；markopack 源码改动后须先在其内 `pnpm build` 重编 dist（markopress 侧无需重装）。

**升级触发条件（暂不执行，非当前待办）**：markopack 提交 + 消费 changeset 发版（当前 npm 0.4.0）、markopress 把 `link:` 切回 npm 新版本、远端推送。

影响：试点 `/blog` 本地开发已可写真 API 组件（test 后端 `/api/v1/blog` 本身返回 404，组件需容错空态）；生产同源不受影响。

## 3. Strapi loader `contentPath` 默认值（markopress）

事实：loader 默认 `contentPath: 'content.content'`（取自 graphql 组件形状的推断）；真实 REST v4（pdflux-changelog）的 `content` 是扁平 Rich Text 字符串。试点以 `contentPath: 'content'` 选项绕过，工作正常（生产实例 102 条全量拉取验证）。

Ask：默认值改为 `'content'`，或在 `strapi-loader-design.md` 显著标注两种形状与选择方法。

## 4. CSS 管线配方（markopress 文档；依赖 #2 发版）

源站样式体系：bootstrap 5 LESS（`theme.js` modifyVars 注入品牌变量）+ 站点 `index.less` + postcss-preset-env；SVG 经 gatsby-plugin-react-svg 转 React 组件。

试点选型（pdflux-analysis §3）：保留 bootstrap 纯 CSS（类名是 HTML 约定）+ rspack `less-loader` 双侧。#2 的 SERVER_MERGE_KEYS 合并现已在本地 `link:` 链路可用（发版后同样成立），对象形 rspack.config 挂 less-loader 即可双侧生效（server 侧 css 规则自动改写 asset/source，SSR 不再无样式）；实际配方待在 pdflux 样式平移时验证。

Ask（markopress）：官方配方文档——`.markopress` 站点怎么接 less（loader 挂载点：站点根 `rspack.config.ts`？）、modifyVars 怎么传（less-loader options）、postcss 怎么串。若做成一等 config 键更佳。

## 5. 多环境矩阵配方（markopress）

源站矩阵：`SITE_ENV ∈ {test, staging, prod}` × `{默认 en, -cn}`（pdflux 无 cn 变体，nanodoc 有）；`.env.<env>` 注入 `GATSBY_*`（产品 URL / GTM / SKILL_URL）；产物 assetPrefix → `https://cdn.paodingai.com/<site>`；CI gzipper gzip+zstd 双压缩。

现状事实：markopress engine 无 publicPath/assetPrefix 处理；markopack `packages/rspack/src/config.ts:255` 硬编码 `publicPath: "/"`（2026-11-09 核实）。

试点判断：大部分 app 层可解——env 注入（scripts 已用 `--env-file-if-exists`）+ `builtins.define`（函数形通道已有）+ `output.publicPath` 覆盖（对象形可替换）+ 部署层压缩。但求 markopress 官方配方一节（「环境变量与多环境构建」），避免每站重复摸索；若有内置 assetPrefix/asset 基址能力则优先用内置。

## 6. images v2 反馈（2026-11-11，pdflux 图片通路评估，#10–#13）

背景：pdflux 复刻评估「guide md 图能否从静态收获（线上 CDN URL 冻结）切到 mp-image 接管」。
机制对位结论：v2 与 gatsby-remark-images 机制同构（构建期衍生 + 站点级一次性配置 +
普通 `![]()`），wrapper 观感（650 封顶/边框/居中）可由站点 CSS 平移；真正缺的是下面四件。

### #10 md 接管缺默认值配置面（高）——**已入库（2026-11-11）**

实现：`ImagesMarkdownDefaults`（plugins.ts）——`images.markdown` 接受对象（boolean 向后
兼容），并入接管 attrs 作缺省（md 自带 src/alt/title 与显式 `<mp-image>` tag 永远优先）；
进 attrs ⇒ resolveCache 键随配置换键，不命中旧产物。**pdflux 已按此切换**（guide 15 页 +
FAQ）：width 650 / quality 100 / densities `0.25,0.5,1,1.5,2` / link true → srcset
163/325/650/975/1300 + 源宽档，与线上 gatsby fluid 断点一致（原验收标准达成）；测试 +4
（images.test.ts 27/27）。附带修正（同批）：md 独立图片段的 `<p>` 包装整段替换——产物是
块级 `<div>`，嵌 p 非法（浏览器劈开 p、遗留空段双份边距）；gatsby-remark-images 在
mdast 层同款行为。原反馈存档：

- 现状：`images.markdown` 仅 boolean（images.ts:343）；接管 attrs 只有 `{src, alt, title?}`
  （images.ts:384-389），layout/quality/width/densities 全落管线常量
  （responsive/80/blur，images.ts:34,561,566）——设计文档自述「要调参写 `<mp-image>` tag」。
- 为什么不够：源站机制 = gatsby-remark-images **全局配置一次**（quality:100 + wrapperStyle +
  maxWidth 650），md 保持普通 `![]()`。接管常量下 displayWidth=原图宽（如 1328）→ 渲染宽度
  直接错（线上 650 封顶）；把 md 改写成 `<mp-image width=650>` 则内容文件与源仓库持续漂移
  （每次内容同步重改一遍）。

### #11 「点开原图」无等价物（中）——**已入库（同批）**

实现：`<mp-image link>` 属性（`link="false"` 显式关）+ 接管默认 `link: true`（进 #10 配置
对象）；产物在容器内包 `<a class="mp-image-link" href={原图} style="display:block"
target="_blank" rel="noopener">`——原图即管线拷贝的原名文件，URL 现成；gif/svg 直通分支
同包。连带暴露 markopack 爬虫问题 → **#14**（资产 `<a>` 被当页面爬，产 `xxx.png.html`
404 文档；已在 markopack 工作区修复）。原反馈存档：

- 现状：gatsby-remark-images 默认把图包进 `<a href=原图 target=_blank rel=noopener>`；
  mp-image 无对应属性。关键：**接管注入的 DOM 在消费方模板里没有注入点**，站点想自行包
  `<a>` 也做不到——只能上游做。

### #12 srcset 不含原始宽度档（低）——**已入库（同批）**

实现：densities 模式 `widths.add(sourceWidth)`（Set 去重）——gatsby fluid 的
presentationWidth 同款。pdflux 验收：login 尾档 1328w、translate 1920w、FAQ 图 1540w，
与线上一致。原反馈存档：

- 现状：densities 模式封顶 sourceWidth（images.ts:431-438），原图只作 src 兜底不进 srcset；
  gatsby fluid 恒含 presentationWidth。
- 场景：原图 1328 > 2×650=1300 → 高 DPR 屏拿 1300 变体而非 1328 原图（亚百分点差，视觉
  无感；但与 gatsby 产物逐项对齐时是噪音）。

### #13 非 md 内容通路的图片解析 API（中；即 v2 留的 real-CMS touchstone）

- 现状：pdflux /log 内容 = strapi 取回的 html 字符串，图片（远程 strapi URL）嵌在段落中段
  ——md 接管不经过；页面侧 `<mp-image>` 组件无法插进 `$!{html}` 字符串中段。
- 问题：`resolveImageTagHtml` 目前是 engine 内部导出（mp-image.marko 的 server import 在用），
  站点层纯 ts 变换（log-html.ts 形态）调它算不算受支持面，无文档口径。
- 建议二选一：公开为 app 可调 API（异步 html→html，远程图走 domains 授权 + HTTP 缓存，
  正好一次验完 T1 remote 管线）；或文档明确「仅组件/tag 通道受支持」，/log 形态记为边界。
  v2 设计文档留的「pdflux /log real-CMS touchstone」即此项。

## 附：app 层已定、无需上游的项（备忘）

- guide 派生页外壳 = **站点内主题包**（.markopress/theme/ + config.theme 指过去；link: 相对路径挂 site deps）。mp-layout/mp-page 两槽位即 Operation 外壳；主题包内模板对 site 组件用相对 import（taglib 发现不跨包，lasso-package-root 就近主题包自己的 package.json——`<mp-head-entries>` 靠主题包声明 theme-base 依赖）。2026-11-11 已验证：16 页字节级 + 几何全对；
- guide/FAQ 图片通路（2026-11-11 切换）：静态收获（guide-images.ts 线上 CDN URL 冻结）已废，
  改 config.images.markdown 对象形接管（#10/#11/#12 落地后）；md 与源仓库保持字节一致。
  观感平移在 guide-content.scss / plugin.scss 的 `.mp-image` 作用域（**含
  `max-width:100%!important`**——源 gatsby wrapperStyle 同款覆盖，实际显示宽 = 列宽）。
  已知偏差：线上宽高比 = gatsby 163 最小变体高度的整数取整（±0.5px@163 放大 ~5.7×），
  本地恒用原图真比例（图不变形），单图盒高差 ±2.5px——按「渲染级」标准接受；
- nginx 尾斜杠：源 301 裸→斜杠、marko-run 302 斜杠→裸，上线 nginx 不得沿用源规则（环）；

- /m 双路由 → 响应式单页（media query + matchMedia；上线时源站 nginx UA 302 规则移除/改 301，部署层处理）；
- XGPlayer 保留：Marko 组件 onMount poster 门控 + IntersectionObserver(0.8) + destroy 清理；`xgplayer/dist/index.min.css` import 链待验证，失败兜底 head link；
- axios → fetch 薄封装（envelope `{status:'ok', data}` 语义照搬）；
- react-bootstrap 组件 → bootstrap 纯 CSS + Marko 手写等价结构；react-highlight → md 管线 shiki；
- GTM/Clarity → markopress 站点级 head 注入（4b2604d 已有）；
- /404 客户端 redirect → `+404` 页 onMount 处理（小坑：markopress 404 是渲染型）。

## 2026-11-11：guide 集合数据烤进 client chunk（585.js，体积 ask 非功能 blocker）

现象（rsdoctor 1.6.5 归因 + 产物字节核查，pdflux 试点）：guide 各页共享的
`585.js`（36K raw/13K gz）磁盘内容 **89% 是 15 个 guide 页的 vcontent html 段**
（27,362 chars，`id:"basic",slug:…,data:{…},segments:[{type:"html",html:'…'}]`
形态；源码归因 = `operation-nav.marko` 编译产物 46.2K src + 15×vcontent 模块）。
该 chunk 被**每个 guide 页的 entry 引用**，即每次进 guide（含从别的 guide 页二跳）
都重新下载这 13K gz——而 resumability 下同样的内容已经内联在 SSR HTML 里，
client 在用户不触发交互时根本不需要它。

推断链路：collection/vcontent 数据模块（站点 `.markopress/vcontent/guide/*.js`
或其 virtual module）没有区分 server-only 与 client 通道，浏览器构建把全部
html 段打进了共享 chunk。#15（entry 去重）已消 entry 级 JS 重复，这是同一
主题的残留：**数据应只进 server bundle，client 只需要组件模板**。

ask：markopress/markopack 的 browser 构建侧不打包（或 tree-shake 掉）
collection 数据模块的 html segments——可能的做法是 vcontent 虚拟模块按
`side === "browser"` 拆分导出，或把 html 段从共享 chunk 挪到仅 SSR 引用。
pdflux 侧 16 页 guide 二跳可各省 13K gz。数字与归因细节：
`pai-websites/docs/pdflux-analysis.md` §3.7。

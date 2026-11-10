# Strapi Loader 设计（pdflux `/log` 通道）

> 状态：**已定稿（2026-11-09 review 修订），实现中**。来源：pai-websites 复刻项目首站 pdflux
> 的 Strapi 用法实测。前置：`docs/wp-loader-design.md`——契约级要求 1–8（id/slug 分离、
> untouched 删除归 loader、body 只存源文本、纯数据 entry、filePath 可选……）已由 WP 场景
> 定稿，本稿是**第二个真实源对契约的复核** + Strapi speci 需求。结论：**内容层契约原样
> 适用，零新条款**；新增面在 loader 工程侧（token/env、分页、失败语义）+ 两个框架侧小缺口
> （route opt-out §2a、集合级数据模块 §6）。

## 0. 一句话结论

Strapi 是 WP 的严格子集（无文件系统、id 稳定、REST 分页规范）外加两个自身特点（组件内嵌
markdown+媒体、无可靠删除事件）。契约不动；框架侧补两小块：**route opt-out**（route-less
集合不产路由）与**集合级数据模块**（自定义页消费整集合）；工程上保留全量轮 + untouched
差集删除即可（增量面整体推迟，见 §4）。

## 1. 场景（pdflux 实测，2026-11-09）

- 生产 `https://strapi.paodingai.com`，测试 `http://100.64.0.1:1337`；Bearer token 认证。
- collection `pdflux-changelog` → REST `/api/pdflux-changelogs`（v4 形状：
  `pagination[page]/pagination[pageSize]`、`populate=*`；源站 gatsby 插件用 pageSize=250
  说明实例上限已调过，loader 参数透传）。
- entry 形状（源站 graphql 逆向）：

```txt
title: string
publishAt: datetime
content: { data: {                     ← 单组件
  content: markdown 源文本（内嵌 frontmatter: version/date）
  medias: [{ alternativeText, url, … }]   ← 远程媒体数组
  videos: [...]
}}
```

- **Rich Text (Markdown) 字段存的就是 md 源文本**（Strapi 不渲染，渲染是前端的事——
 gatsby 站因此自接 remark）。内嵌 frontmatter 是内容作者的书写约定（旧系统带过来的），
  不是 Strapi 机制。
- 消费方式：**单页列表**——`/log` 一页渲染全部条目（publishAt 倒序），**非 per-entry 路由**。
  这逼出 §6（集合级数据模块）与 §2a（route opt-out）。
- 前车之鉴：源仓库把 prod/test token **明文提交**在 gatsby-config.js——「token 只走 env」
  是硬约束（§7）。

## 2. 集合定义（用户面）

```ts
const changelog = defineCollection({
  loader: strapi({
    url: process.env.STRAPI_URL,          // 按 SITE_ENV 在 config.ts 里切，本来就有
    token: process.env.STRAPI_TOKEN,      // 只从 env 读；缺失 fail fast（§7）
    contentType: 'pdflux-changelog',      // 端点按 v4 复数规则派生；或显式 endpoint
    populate: '*',
    pageSize: 100,                        // 实例默认上限，可调
  }),
  schema: z.object({
    title: z.string(),
    publishAt: z.string(),
    medias: z.array(z.object({ alt: z.string(), url: z.string(), mime: z.string() })).default([]),
    frontmatter: z.record(z.string(), z.unknown()).optional(),  // version/date 从这取
  }),
  route: false,   // 不产 per-entry 路由（§2a）；/log 是自定义页（§6）
});
```

### 2a. route opt-out（review 逼出的框架缺口）

原稿以为「无 route.prefix 即不产路由」——**不成立**：gen-routes 对所有集合的所有 entry
无差别投影。新增 `route?: { prefix: string } | false`（`route: false` = 不产 per-entry
路由），连带语义：

- 不进路由投影 ⇒ 不进 sidebar 默认面 / urls.json / prev-next（三者皆由 pages 派生）；
- `ctx.urlOf` 对 route-less 集合返回 `null`；
- 内置三件（sitemap/rss/search）**跳过 urlOf 为 null 的 entry**——不各自感知 route
  配置，null 即跳（无 URL 的搜索结果/订阅项/sitemap 条目没有意义）。

route 仍是 gen 层关切（sync/store 不读，`types.ts` 既有注释），内容层契约零改动。

## 3. 契约字段映射（wp-design §映射表 同款走查）

| 契约字段 | Strapi 来源 | 说明 |
|---|---|---|
| `id` | v5 `String(entry.documentId)`；v4 `String(entry.id)` | 双形状兼容（`documentId ?? id`），无需实现前探测版本 |
| `slug` | 派生：frontmatter `slug` 回退 `version`（sanitized）；都无 ⇒ `String(id)` | changelog 无用户可改 slug 字段；本集合不进 URL（列表页），稳定可读即可 |
| `data` | REST 列（title/publishAt/medias）+ **`data.frontmatter`**（剥离产物） | frontmatter 数据**嵌套进 `data.frontmatter`**（与 REST 列分源、永不撞名）；「version 进不进顶层 data」的争论就此终结——进，但在嵌套键下 |
| `body` | `contentPath`（默认 `content`——扁平 Rich Text 字符串；单组件包装形态显式传 `content.content`）取 md 源文本，**经 `.md` entryType 的 `getEntryInfo` 剥离 frontmatter 后入 store** | store 的 body 与文件集合形态一致（渲染器不剥离 frontmatter——剥离只发生在 load 期，原稿「body 原文含 frontmatter 头」自相矛盾，已修正）；contentType `text/markdown`，走站内同一条 md 管线（shiki/容器/segments）——changelog 白得渲染能力 |
| `digest` | `generateDigest(entry)`（整个 REST entry） | 改 title 也失效；命中跳过 parseData（契约 #1 同款，glob 的比对位置在 parse 之前） |
| `filePath` | `undefined` | 契约 #2 已允许 ✓ |

**v4/v5 REST 包装归一**（读 gatsby-source-strapi 5.x 源码交叉验证时发现）：v4 REST 把
字段包在 `attributes` 下、组件/媒体再包 `data`（md 实际路径
`attributes.content.data.attributes.content`）；v5 扁平（`content.content`）。原稿 §1 的
`content.data.content` 是 **GraphQL** 形状（pdflux 源站走 graphql 逆向），REST 不能照抄。
loader 在取值途中逐层摊平包装（v5 形状原样透传）——`contentPath`/`mediaPath` 按摊平后
逻辑路径书写，v4/v5 实例同一条路径。上游同款证据：id 用 `documentId || id` 双兼容、
增量用时间戳游标 + 全量差集删删除、富文本字段以 `text/markdown` 源文本存储渲染后置。

默认值修正（2026-11-11，blockers #3）：上面的 `content.content` 是「content 为单组件」
的形状推断；真实 pdflux-changelog 生产实例的 `content` 是**扁平 Rich Text 字符串**
（102 条全量拉取验证）——默认 `contentPath` 修正为 `content`、`mediaPath` 修正为
`medias`（扁平形状与 content 同级）；单组件包装形态两条路径显式传
（`content.content` / `content.medias`，单测保有 dig 对包装形状的摊平覆盖）。

提取面（定稿）：**pdflux 形状默认（扁平）+ 少量选项**——`contentPath`/`mediaPath` 可覆盖取值
路径（摊平后形状）；REST 列名（title/publishAt）写死 pdflux 形状，第二个真实源出现前
不抽象（无 mapEntry 回调）。

## 4. 同步策略（v1 定稿：全量轮 only）

- **全量轮**（dev 启动 / build——现有 `ensureSynced` 路径自动跑）：分页循环拉全
  （`?pagination[page]=N` 翻到 `meta.pagination.pageCount`），逐条 set（digest 命中跳过
  parseData 与写盘），本轮结束后 **untouched 差集删除**（v4 删除只有全量对比能发现）。
- **失败语义**：fetch 超时/5xx 重试 2 次退避；4xx 立即报错（401/403 提示 token、404 提示
  endpoint）；build 期 fail fast（产物可复现优先）。
- **`STRAPI_OFFLINE=1`**：不 fetch、不动 store（差集会把 store 清空）、不更新游标，warn
  后返回（CI 重跑 / 无网演示）。
- **媒体 URL**：相对路径（`/uploads/…`）以 loader `url` 为基绝对化；绝对 URL 原样。
- **`publicationState=live` 显式传参**（v4 默认即 live，写明防依赖默认值）。

### 砍掉的（后续门，v1 不做）

- **增量轮**（游标 `filters[updatedAt][$gt]`）与**轻量清单差集**——只服务于热更/webhook
  场景。webhook 要求 Strapi 机器能连通打包机（笔记本要隧道；CI 场景平台 rebuild hook
  触发重新 build = 重新全量，本就覆盖），v1 不做。Strapi 改动靠重启 dev / 重新 build
  反映（已确认接受）。
- CLI `markopress sync`：独立进程写 store 后运行中的 dev 感知不到（无 watchDirs），定位
  本就模糊，推迟。

## 5. 媒体：URL 透传（v1），资产管线化（v2 门）

- v1：`data.medias = [{alt, url, mime}]` 原样透传（相对 URL 已绝对化），页面直接
  `<img src>`。契约 #6（纯数据 entry 允许）覆盖；视频同。
- **像素验收注意点（如实记录）**：源站 Gatsby 是构建期下载 + ImageSharp 重采样
  （srcset/webp）；v1 透传是浏览器拉原图——布局尺寸可 1:1，但 DPR/加载策略有差异。
- v2：远程下载 + 寻址落盘接进 `images.ts` 资产管线（mp-image 的「远程图优化」正是其
  v2 门预留项）——届时 changelog md 里的远程图与 entry 内嵌媒体统一走管线。

## 6. 集合级数据模块（自定义页消费整集合，`virtual:mp/collection/<name>`）

`/log` 是**列表页**：自定义页（`pages/log.marko`）import 整个集合的 entries。现状虚拟
模块只有 per-entry 的 `virtual:mp/content/<collection>/<id>`。实现定稿：

- **模块源**（`content-modules.ts`，双后端唯一来源）：静态 import 全部 per-entry 模块 +
  导出 `entries` 数组（`{ id, slug, data, segments, headings }` 每条；排序/投影由消费方
  做）。渲染缓存各自按 entry digest 生效，集合模块零渲染成本。
- **Rspack**：落盘 `.markopress/vcollection/<name>.js`（不能是 `vcontent/<c>/index.js`——
  entry id "index" 会撞名）；`NormalModuleReplacementPlugin` 加前缀分支；增删条目 ⇒ 文件
  重写 ⇒ 原生 watcher 失效；内容编辑 ⇒ per-entry 模块变化沿编译图传播（集合模块源不变）。
- **Vite**：`resolveId`/`load` 内存虚拟模块；失效接线——entry **集合**变化（增/删）时
  失效对应集合模块（`syncOne`/`fullResync`），内容编辑经 per-entry 失效沿模块图传播。
- 消费方：`pages/log.marko` 内 `import { entries } from "virtual:mp/collection/changelog"`
  （用户页真身 import 虚拟模块，包装链既有机制不动）。

## 7. 安全与配置（硬约束）

- token/url **只从 `process.env`**；装配期扫 config **源文本**，`token:`（及
  secret/password/apiKey）后跟字符串字面量 ⇒ fail fast（挂 `validateNamespace` 同期）。
  运行时无法区分字面量与 env 求值结果，源码扫描是启发式——只扫主 config 文本，从其他
  模块导入的值扫不到（纵深防御，非安全边界，注释写明）。
- token 缺失 ⇒ loader 报可读错误（不静默空集合）。
- token 泄漏面：loader 日志/错误信息不得回显 token（token 只进 Authorization 头）。

## 8. 试金石（验收）

pdflux `/log` 全链路（pai-websites 项目内验证）：dev/build 拉全量渲染 /log；build SSG
对齐线上 `https://pdflux.com/log` 截图基线（§5 记录的媒体差异除外）；Strapi 删一条 ⇒
下次全量轮后消失；config 写字面量 token 被拒。
引擎测试：分页循环、untouched 差集删除、digest 去重（parseData 计数）、frontmatter 剥离
+ `data.frontmatter` + slug 派生、v4/v5 id 形状、媒体 URL 绝对化、离线模式、401/5xx/重试、
token 缺失；集合模块渲染形状；sitemap/rss/search 对 null urlOf 的跳过。

## 9. 后续门（原开放问题的收敛）

- **GraphQL 不支持**（2026-11-09 定）——REST 是 Strapi 常驻原生 API，GraphQL 是实例
  可选插件：REST loader 适配所有实例，功能面（populate/分页/过滤）零缺口；GraphQL
  另有一套响应包装 = 双倍归一化维护面。契约/下游全传输无关，真要支持是纯加法
  （独立 loader 或 transport 选项）。重开条件：仅有 GraphQL 的实例 / 万条级载荷
  裁剪瓶颈 / 订阅式实时（= 热更需求复活）；

- ~~生产实例版本（v4/v5）~~——`documentId ?? id` 双兼容，无需探测；
- ~~contentType vs endpoint 选项形状~~——`contentType`（uid）+ 复数派生，`endpoint` 显式覆盖；
- ~~slug 派生规则~~——frontmatter slug → version（sanitized）→ `String(id)`；本集合不进 URL，稳定性要求低；
- ~~轻量清单差集触发策略~~——随增量面整体推迟；
- §6 模块是否给 plugin 外的更多用户面（命名/投影）——等第二个消费者；
- 媒体 v2（远程资产进 `images.ts`）——与 images.ts 的 v2 门合并评估；
- 增量同步 + webhook/CLI 触发——pdflux 编辑频率低（changelog），全量轮够用；真有高频编辑再上。

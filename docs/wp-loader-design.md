# WP Loader 纸上设计（Phase 3 预演）

> 状态：**纸上设计**，未实现。目的：在 `packages/content/CONTRACT.md` 定稿前，用一个「没有文件系统、id 不稳定、需要增量游标」的真实内容源把契约跑一遍。跑不通改契约，不改本设计去凑。
> 结论：跑得通，且逼出了三条契约级要求——**id/slug 必须分离**、**untouched 删除必须是 loader 的策略而非 sync 层的**、**body 只存源文本**（详见文末对照表）。

## 场景

WordPress 站点作为内容源，markopress 站点消费其文章。两种接线：

- **REST API**（`/wp-json/wp/v2/*`，`context=edit` + 应用密码拿 `content.raw`）——默认；
- **直连数据库**（同站点部署时）——留门，形状相同。

## 集合划分

一个 WP 实体类型 = 一个 collection，同一个 loader 工厂不同参数：

```ts
// content.config.ts
const posts = defineCollection({
  loader: wp({ endpoint: 'https://wp.example.com', types: ['post'] }),
  schema: z.object({
    title: z.string(),
    status: z.enum(['publish', 'draft', 'pending']),
    date: z.string(),
    sticky: z.boolean().default(false),
  }),
});
```

## 全量同步（首次 / dev 启动 / build）

分页拉取 `/wp/v2/posts?per_page=100&page=N&context=edit`，对每篇 post：

| 契约字段 | WP 来源 | 说明 |
|---|---|---|
| `id` | `String(post.id)`（数字 ID） | **稳定**：改 slug、改标题都不变。WP 数字 ID 全局唯一（含 revision 除外），跨 post type 也唯一 |
| `slug` | `post.slug`（`post_name`） | **会变**：用户随时改。只用于 URL |
| `data` | `{ title: post.title.raw, status, date, sticky, … }` | 过 zod schema；REST 字段 → schema 字段的映射在 loader 里做 |
| `body` | `post.content.raw` | 源文本。配 markdown 插件的 WP 即 md 源码；纯 Gutenberg 站是块注释 HTML——都能存，渲染不是本层的事 |
| `contentType` | `'text/markdown'` 或 `'text/html'`（按站点配置探测一次） | renderer 注册表（`packages/markdown`）按它取渲染器 |
| `digest` | `generateDigest(JSON.stringify(post))` | 整个 post 对象参与哈希：改 title（在 data 里）也要失效 |
| `filePath` | `undefined` | 没有文件系统——契约里必须是可选字段 |

逐条 `store.set(...)`；**本轮扫到的 id 之外的全删**（untouched 差集）——WP 里删文章只有全量对比才能发现（trash 状态除外，`status=publish` 过滤即可）。

## 增量同步（webhook / 定时触发）

WP `post_updated` webhook → `sync({ loaders: ['wp-loader'] })` 只重跑 WP 集合：

1. 读 `meta.get('last-modified')`（上次同步见过的最大 `modified_gmt`，**持久化在 store 里**，跨进程存活）；
2. `GET /wp/v2/posts?after=<last-modified>&context=edit` 只拿变过的；
3. 逐条 set（digest 相同的会被 store.set 去重跳过——fetch 省不掉，parse/写盘省得掉）；
4. 更新 `meta.set('last-modified', …)`。

**关键：增量轮不做 untouched 删除**——`after=` 只返回变过的文章，差集删除会把没变的 999 篇全删了。所以 untouched 删除必须留在 loader 的策略里（全量轮做、增量轮不做），sync 编排层绝不能替 loader 做。Astro 同此：差集逻辑在 `glob.ts` 里，`content-layer.ts` 不管。

## 请求时重验（远期，cacheHint 形状预留）

Fastify/marko-run middleware 收到请求 → `loadEntry({ filter: { id } })` → 带 WP 的 `WP-REST-Time-Gmt` / ETag 做条件请求，未变走缓存。这正是 Astro `LiveLoader` + `cacheHint { tags, lastModified }` 的形状。**本期契约不含 live 分支**——但 store/digest/meta 三件套是共用的，live 只是在读路径上加条件请求，不需要改契约核心。

## 边界情况走查

- **改 slug（重命名）**：id 不变 → 同 id set 新 digest → 覆盖更新，URL 变化由下游 gen-routes 从 store 派生。若契约像 Astro 那样默认 id=slug 路径派生，这里就变成「删旧建新」+ 游标错乱。**⇒ id/slug 分离是硬要求。**
- **两篇 post 同 slug**（不同 post type）：id 不同、slug 撞——URL 生成是下游问题（加前缀），store 不受影响。
- **草稿/私有**：`status` 进 data，由 zod schema 约束；是否收录由 loader 参数（`status: ['publish']`）决定。
- **WP 侧删除**：全量轮 untouched 差集捕获；增量轮捕获不了（webhook 有 `post_trashed`，来了就 `store.delete(id)`）。
- **schema 改了**：WP 数据没变、digest 没变，但配置指纹（content-config-digest）变了 → sync 层 clearAll → 全量重拉重 parse。**⇒ 配置指纹失效必须在 sync 层，不能指望 loader。**
- **媒体图片**：`media` 集合存 `{ id, slug, data: { mime, width, height }, source_url }`——无 body 无 contentType 的纯数据 entry。契约必须允许「纯数据 entry」（body/contentType 可选）。

## 契约对照清单（本设计对 CONTRACT.md 的要求）

| # | 要求 | 契约条款 |
|---|---|---|
| 1 | id 稳定、slug 独立可变 | `DataEntry { id, slug, … }` 两个独立字段 |
| 2 | 无文件系统的内容源 | `filePath?` 可选 |
| 3 | 跨进程增量游标 | `ctx.meta` 按集合持久化 KV |
| 4 | 增量轮不能差集删除 | untouched 删除是 loader 策略；sync 层只编排 |
| 5 | 只存源文本，渲染后置 | `body` 源文本 + `contentType` 标记；无 rendered 字段 |
| 6 | 纯数据实体（media） | `body`/`contentType` 可选，schema 只管 `data` |
| 7 | 改 schema 必须全量失效 | metaStore 配置指纹 → clearAll 在 sync 层 |
| 8 | loader 不需要 entryTypes（无扩展名概念） | `ctx.entryTypes` 可为空 Map，WP loader 不读它 |

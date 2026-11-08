# @markopress/content 契约

> 快照基准：Astro 7 main（2026-10-14，`/tmp/research/astro-mirror/packages/astro/src/content/`）。既定偏离见 `docs/research/astro-deltas.md`，本文件只写**我们的**契约。检验：`docs/wp-loader-design.md`（WP loader 纸上设计跑通 = 契约成立）。

## 核心：Loader 契约

内容源是一个 loader；loader 需要的一切由 ctx 注入；loader 只写自己 collection 的 scoped store 视图。契约里没有一个字知道 marko / vite 的存在。

```ts
type Loader = {
  name: string                       // 唯一名（npm 包名或内置名）
  load(ctx: LoaderContext): Promise<void>
  handleFileChange?(ctx, event): Promise<FileChangeResult>   // 单文件增量（可选，见下）
  watchDirs?: string[]               // dev watcher 要监听的绝对路径；无文件面的 loader 不设
}

interface FileChangeEvent {          // app 把自己 watcher 的事件翻译成这个（不认 chokidar/vite）
  type: 'add' | 'change' | 'unlink'
  path: string                       // 绝对路径
}
interface FileChangeResult {
  handled: boolean                   // 事件属于本 loader；false = 编排层可回退全量
  changed: string[]                  // 实际写入/变化的 entry id（digest 命中则不含）
  removed: string[]                  // 被删的 id（slug 改名：老 id 在此、新 id 在 changed）
}

interface LoaderContext {
  collection: string                 // 集合名
  store: DataStore                   // 本集合的 scoped 视图（写不进别的集合）
  meta: MetaStore                    // 本集合的持久 KV（sync token / 游标）
  logger: Logger                     // info/warn/error/debug，fork 自 loader 名
  parseData<T>(opts: { id, data, filePath? }): Promise<T>   // zod 入口，见下
  generateDigest(data: string | object): string             // xxhash64，非加密
  entryTypes: Map<ext, EntryType>    // 扩展名 → 解析钩子；无文件概念的 loader 忽略
}
```

## EntryType（格式插件点；md 知识在 packages/markdown，不在本包）

```ts
interface EntryType {
  extensions: string[]               // ['.md']
  contentType: string                // 'text/markdown' —— renderer 注册表的键
  getEntryInfo({ contents, fileUrl }): Promise<{ data, body?, slug? }>
}
```

## DataEntry（store 里的形状）

```ts
interface DataEntry<TData> {
  id: string            // 集合内唯一、稳定。WP 场景 = 远端数字 ID；文件场景 = 路径派生 slug
  slug: string          // URL 用名，可变（frontmatter slug / 改名）。默认 = id
  data: TData           // 已过 schema 的结构化数据
  body?: string         // 源文本（不是渲染产物）。不变式：有 body ⇒ 有 contentType
  contentType?: string  // 'text/markdown' 等；渲染一律惰性、按 digest 内存缓存（下游）
  digest?: string       // 有则参与增量：store.set 同 id 同 digest ⇒ 跳过写入
  filePath?: string     // 相对站点根的 posix 路径；无文件系统的 loader 不设
}
```

## DataStore / MetaStore（loader 可见的面）

```ts
interface DataStore {
  get(id): DataEntry | undefined
  entries(): [id, DataEntry][]
  values(): DataEntry[]
  keys(): string[]
  has(id): boolean
  set(entry: DataEntry): boolean     // digest 去重：同 id 同 digest 返回 false 且不写
  delete(id): void
  clear(): void                      // 只清本集合
}
interface MetaStore { get(key): string | undefined; set(key, value); has(key); delete(key) }
```

## 失效三件套（Astro 踩过坑的部分，逐条保留）

1. **digest 跳过**：entry 未变（digest 相同）⇒ 不重 parse、不重写盘。glob 在 parseData 之前比对；store.set 在写盘之前比对。
2. **untouched 差集删除是 loader 的策略**：loader 全量扫描时记录本轮见到的 id，同步结束删除没见到的——增量不清全量。**sync 编排层绝不做差集**（WP 增量轮 `after=` 只返回变过的文章，差集会把没变的全删了）。
3. **配置指纹 → clearAll 是 sync 层的职责**：metaStore 全局键 `content-config-digest` / `markopress-version` 与上次不同 ⇒ 清空全部数据 + 全部 meta，重跑所有 loader。否则改 schema 后旧数据带着错类型存活。

## 同步编排（sync.ts）

- 串行：单飞 promise 链，同一时刻至多一个 sync 在跑；sync 内部各集合的 loader 也顺序执行（确定性优先，见 deltas #2/#7）。
- 每次 sync：比对配置指纹 → （变了则 clearAll）→ 逐集合 `loader.load(ctx)` → flush 持久化。
- 单文件增量（`syncer.syncFile(config, event)`，与 sync 同链排队）：只跑声明 `handleFileChange` 且认领该事件的 loader；**不做配置指纹比对**（config 变更走 resetSynced → 全量，不在这条路径）。glob 的实现：load 建立的 entry→id 映射支撑 change/unlink O(1) 定位（5k 文件站点编辑 ~O(1)，替代 O(N) 全量重扫）；add 先 glob 扫一遍确认 pattern 匹配（扫描只列目录，读文件只对事件文件做）。
- 持久化（dev/build 共用）：`<storeDir>/<collection>.json`（devalue 序列化的 `Map<id, DataEntry>`）+ `<storeDir>/_meta.json`。写盘去抖（500ms）、原子（tmp+rename）、内容不变则跳过；`onFileWritten` 供 app 做 Vite 模块图确定性失效。**已知写放大**：flush 仍整文件重写集合 JSON（deltas #3），增量化的是读侧。
- 1k 条目改 1 条 ⇒ parseData 恰好 1 次（基准断言，测试锁死）。

## zod 入口（parseData）

- data 必须过集合 schema 才能进 store（无 schema 则透传）。
- 失败抛错必带 `collection` / `id` / `filePath`（有则）+ zod issues 路径——坏 frontmatter 的报错可读是验收项。

## 类型生成（typegen）

从用户 config 模块的**类型**（不是运行时值）生成 `.markopress/content.d.ts`：模板 + marker 替换，每个集合映射到 `z.infer` 后的 `CollectionEntry`。对齐 marko-run 生成 `.marko-run/routes.d.ts` 的习惯：生成物 gitignore、write-if-changed。

## 运行时读 API（index.ts）

`defineCollection(config)`（校验 + 定型）、`defineContentConfig({ collections })`（计算配置指纹）、`getCollection(name, filter?)`、`getEntry(collection, id)`——读全局 store 引用（app 启动时 `setContentStore` 注入；未来换虚拟模块，形状不变）。

## 命名与边界

- 虚拟模块前缀 `virtual:mp/content/...`，生成目录 `.markopress/`（deltas #5）。
- 依赖红线：`package.json` 不得出现 vite / marko / @marko/run（测试断言锁死）。
- 查询引擎、集合间关联、i18n、图片服务：YAGNI，不做。

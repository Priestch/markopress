# 与 Astro content layer 的偏离台账

> 新偏离必须记入本文件（含理由）。上游 bugfix 不会自动流过来——偶尔 diff 上游 `packages/astro/src/content/`（镜像方法见 `astro.md` §0）。基准：Astro 7 main，2026-10-14。

| # | 偏离 | Astro 原样 | 理由 | 状态 |
|---|---|---|---|---|
| 1 | `body` 只存源文本 + `contentType` 标记；无 `rendered` / `deferredRender` 字段，渲染一律惰性、按 digest 内存缓存（下游） | `rendered: { html, metadata }` 可暂存进 store，`deferRender` 两态切换 | 存渲染产物等于把渲染器焊进 store；我们的渲染器（unified，`packages/markdown`）是独立插件点。WP loader 纸上设计进一步证明：远端内容源根本没有「渲染时机」可言 | 定稿 |
| 2 | 串行同步用单飞 promise 链 | PQueue(1) 排队 + sync 内 Promise.all + glob 内 pLimit(10) | 少 p-queue/p-limit 两个依赖；并发度等真有 1 万条再谈 | 定稿 |
| 3 | 持久化按集合单 chunk：`<storeDir>/<collection>.json`（devalue 整个 Map） | devalue NDJSON 分块 + manifest（未查集合零打包） | 分块服务于 bundle 惰性加载，接虚拟模块时再上；单文件 round-trip 好测 | 定稿 |
| 4 | loader ctx 收窄：去掉 `renderMarkdown`、`config`、`refreshContextData`、`watcher` | 全量 ctx（含 vite FSWatcher） | 渲染不属于 loader 职责（#1 的推论）；watch 由 app 层做（spike 已验证：watch content/ → re-sync，loader 内嵌 watcher 反而把 vite 类型引进本包） | 定稿 |
| 5 | 命名用自己的：`virtual:mp/...`、`.markopress/`、`@markopress/content` | `astro:data-layer-content`、`.astro/` | 避免与 Astro 生态混淆 | 定稿 |
| 6 | `DataEntry` 增加独立的 `slug` 字段（Astro 只有 `id`，slug 语义混在 id 里：glob 默认 id 就是路径 slug） | `{ id, ... }` | WP 场景 id 必须是稳定数字 ID 而 slug（post_name）随时可改，两者不能混（`wp-loader-design.md` 边界走查#1）；下游 URL 生成需要显式 slug | 新增（2026-10-14） |
| 7 | metaStore 独立持久化为 `_meta.json`，不作为 `meta:<collection>` 前缀集合内嵌在数据 store | meta 是同一个 store 里的 `meta:` 前缀集合 | 我们的数据 store 按集合分文件（#3），meta 内嵌就得给 meta 也造「集合文件」的假象；独立文件 + `for(collection)` 视图更直白。clearAll 时两者都清 | 新增（2026-10-14） |
| 8 | sync 内各集合的 loader 顺序执行（for..of），不做 Promise.all | 所有集合 loader 并发跑 | 与 #2 同因：确定性优先，日志可读；单集合场景无差别，多集合大站点真出现瓶颈再放并发 | 新增（2026-10-14） |
| 9 | 配置指纹的 digest 由 config 的构造方（`defineContentConfig` / app）显式提供；包内不从 config 模块文件加载推导 | Astro 自己加载 `src/content.config.ts`，文件级 digest | 「加载用户 TS config」是 app 层的事（要走 Vite 管线）；包只接收 `{ collections, digest }`。schema 是 zod 运行时值不可序列化，指纹必须来自 config 所在文件 | 新增（2026-10-14） |
| 10 | entryType 声明 `contentType`，随 entry 落进 store | Astro 的 `ContentEntryType` 无此概念，contentType 语义散在 `getRenderFunction` / `contentModuleTypes` | 渲染惰性化（#1）后，「这段 body 是什么格式」必须显式存下来供 renderer 注册表取用 | 新增（2026-10-14） |
| 11 | 单文件增量为 loader 的显式方法 `handleFileChange(ctx, event)` + `watchDirs` 元数据；watch 仍完全在 app 层 | loader 在 `load` 内向 `ctx.watcher`（vite FSWatcher）注册回调，回调里自行 syncData | 编排仍是 syncer 单驱动（回调注册的生命周期/时序不需要契约承诺）；#4 的「不引 vite 类型」保持——`FileChangeEvent` 是我们自己的框架无关形状。实测动机：全量重扫 5k 文件 ~0.6s/编辑，O(1) 后读侧只剩事件文件本身 | 新增（2026-10-14） |

## 上游对照坐标（改行为前先看上游怎么做）

- 同步编排：`content-layer.ts`（配置指纹三键比对在 `#doSync` 开头）
- digest 去重两层：`loaders/glob.ts` `syncData`（parse 前比对）+ `mutable-data-store.ts` `scopedStore().set`（写盘前比对）
- untouched 差集：`loaders/glob.ts`（`untouchedEntries` 集合，`load` 尾部删除）
- 去抖 + 原子写 + `onFileWritten`：`mutable-data-store.ts`（`SAVE_DEBOUNCE_MS = 500`、tmp+rename、内容相同跳过）
- zod 错误带 entry 坐标：`utils.ts` `getEntryData`

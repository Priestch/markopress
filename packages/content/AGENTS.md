# @markopress/content — Agent 指南

> 本包是 markopress 内容层的核心：**契约 + store**。这份文件是给在本目录工作的 agent（或未来的你）的自足背景——为什么长这样、抄哪里、抄什么、不抄什么、做到什么程度算完成。整体路线图见仓库 `docs/background.md`（D4 是本包的决策出处）。

## 这个包是什么 / 不是什么

**是**：loader 契约、per-collection store、digest 增量与失效、zod 入口校验、类型生成、同步编排、通用 glob loader。

**不是**（这些边界是刻意的，别「顺手」搬进来）：

- ❌ 不含 markdown 知识 —— frontmatter 语法、md→HTML 都在 `packages/markdown`（第二步）。本包只认 `body` 源文本 + `contentType` 标记。
- ❌ 不含 Vite / marko / @marko/run 集成 —— 虚拟模块、gen-routes 绑定在 app（未来抽 `@markopress/core`）。
- ❌ 不做查询引擎、集合间关联、i18n、图片服务 —— Astro 有，我们 YAGNI。
- **依赖红线：`package.json` 不得出现 vite、marko、@marko/run**（审计是验收项，`tests/audit.test.ts` 锁死）。允许：zod（v4）、devalue、hash 库（xxhash-wasm）、tinyglobby（glob loader 的扫描引擎，与 Astro 同款——负向模式/dotfile/extglob 语义是上游踩坑换来的）、vitest（dev）。

## 背景：content-first 决策（为什么有这个包）

markopress 的内核以 **content** 为基础，markdown 只是 content 的一种产生方式。markdown 在架构里是**两个正交的可插拔点**，不是一个「md 管线」：

1. **一种 loader**（数据从哪来：`glob()` 扫本地文件；未来 `wp()` 打 API/数据库）；
2. **一种 renderer**（`text/markdown` → HTML/segments，按 contentType 注册，属 `packages/markdown`）。

这样 Phase 3 接 WordPress = 新增一个 loader 包，主题、路由、SSG、类型全部不动。契约整体抄 Astro Content Layer——这是调研定稿的结论（`docs/research/astro.md` §8.1「Copy the Content Layer shape wholesale」），因为它已被证明 framework-generic：**loader 契约里没有一个字知道 Astro 组件的存在**。

注意：Astro 的 content layer **不是独立包**（在 `packages/astro/src/content/`，集成面焊死在 Astro 内部），没有东西可以直接 `npm install`——所以我们自建，把 Astro 当参考实现读。

## 契约要点（速览；完整版以 `CONTRACT.md` 为准）

```
Loader: ({ collection, store, meta, logger, parseData, generateDigest, ... }) => Promise<void>
        # loader 只写自己 collection 的 scoped store 视图；需要的工具全部由 ctx 注入
        # 可选增量面：handleFileChange(ctx, event)（单文件事件，O(1) 路径）+ watchDirs
        # （app watcher 据此注册监听）。形状是我们自己的（deltas #11），watch 不进包

DataEntry (我们的形状): { id, slug, data, body?, contentType, digest, filePath? }

失效三件套（Astro 踩过坑的部分，逐条抄）:
  1. digest 相同 ⇒ 完全跳过（不重解析不重渲染）
  2. loader 记 untouchedEntries 差集，同步结束删除 —— 增量不清全量
  3. metaStore 配置指纹（content-config-digest / markopress-version）变了 ⇒ clearAll()
     # 不这么做，改 schema 后旧数据会带着错的类型存活

zod:   parseData 在 ctx 里，data 必须过 schema 才能进 store；错误信息带 entry id/路径
typegen: 从 schema 生成 .markopress/content.d.ts（对齐 marko-run 的 .marko-run/routes.d.ts 习惯）
持久化: devalue，先按集合单 chunk
```

## 与 Astro 的既定偏离（别「改回去」，每条都有理由）

| # | 偏离 | Astro 原样 | 理由 |
|---|---|---|---|
| 1 | `body` 只存源文本 + `contentType`，渲染一律惰性、按 digest 内存缓存 | `rendered: {html,...}` 可暂存 + `deferRender` 两态 | 存渲染产物等于把渲染器焊进 store；我们渲染器是独立插件点 |
| 2 | 单飞 promise 链做串行同步 | PQueue(1) + pLimit(10) | 少一个依赖；并发度等真有 1 万条再谈 |
| 3 | 持久化按集合单 chunk | devalue NDJSON 分块 + manifest（未查集合零打包） | 分块服务于 bundle 惰性加载，接虚拟模块时再上 |
| 4 | loader ctx 收窄：去掉 `renderMarkdown`、`config`、`refreshContextData` | 全量 ctx | 渲染不属于 loader 职责（偏离 1 的推论）；ctx 按需加 |
| 5 | 命名用自己的（未来 `virtual:mp/...`、`.markopress/`） | `astro:data-layer-content` 等 | 避免与 Astro 生态混淆 |

**新偏离必须记入 `docs/research/astro-deltas.md`**（含理由）。上游 bugfix 不会自动流过来，偶尔 diff 上游 `packages/astro/src/content/` 即可。

## 目录规划

```
packages/content/
├── CONTRACT.md              # 契约快照（定格在 Astro 7 main, 2026-10；不追 HEAD）
├── AGENTS.md                # 本文件
├── package.json             # name: @markopress/content
├── src/
│   ├── types.ts             # Loader / LoaderContext / DataEntry / CollectionConfig
│   ├── store.ts             # per-collection scoped store + devalue 持久化
│   ├── mutable-store.ts     # dev：dirty flags + 去抖写盘 + onFileWritten 监听（确定性失效的钩子）
│   ├── meta-store.ts        # 配置指纹
│   ├── digest.ts            # generateDigest
│   ├── sync.ts              # 串行同步编排
│   ├── parse-data.ts        # zod 入口
│   ├── typegen.ts           # .markopress/content.d.ts 生成
│   ├── loaders/glob.ts      # 通用文件扫描；扩展名→entryType 由注入的钩子决定（不含 md 知识）
│   └── index.ts             # defineCollection / getCollection / getEntry
└── tests/                   # vitest
```

## 实施顺序与验收（顺序即验收）

1. **`CONTRACT.md` 先写**（一页），用 `docs/wp-loader-design.md`（WP loader 纸上设计）检验——纸上跑不通改契约，不改 WP 设计去凑。
2. store + 失效三件套的测试：digest 跳过 / 差集删除 / schema 改动 → clearAll；增、改、删、重命名场景全覆盖。
3. **基准断言：1k 条目改 1 条，`parseData` 只被调用 1 次**（计数断言；这是抄 Astro 最值的一条）。
4. typegen 快照测试；devalue 持久化 round-trip。
5. glob loader（entryType 注入钩子），配一个测试用内存 entryType。

**包级完成定义**：上述全绿 + 依赖审计干净（无 vite/marko/@marko/run）。

## 下游：第二步怎么用这个包（本包不做，但契约要为其留门）

- `packages/markdown`：`.md` entryType（frontmatter → data，body 原文）+ unified renderer（gfm + slug/headings → **segments 数组**，为 md 内 Marko 标签穿插留门，本期只有 html 段）。
- app 接线：dev 启动 sync、watcher → re-sync → 只失效变化的 entry；虚拟模块 `virtual:mp/content/<collection>/<id>` 导出 `{ data, segments, headings }`；gen-routes 数据源从扫文件换成查 store；nav/urls 由 store 派生。
- 完成标准 = spike 六项验收重过（dev 增/删/改、build、计数器、布局）+ 坏 frontmatter 报错可读。
- **死锁纪律继承**（spike 发现，见 `docs/spike-notes.md`）：布局文件运行期永不变化，站点数据走数据模块；失效走 Vite 模块图路径，不走 routes 目录文件事件。

## 参考实现坐标

- `docs/research/astro.md` §1 —— 文件级清单与行为描述（**durable，首选**）；§8.1 是「整体抄」的原始结论。
- 上游源码：`withastro/astro` 的 `packages/astro/src/content/*.ts`（Astro 7 main，2026-10-14 快照）。调研时的 `/tmp/research/astro-mirror/` 可能已清理，需要时从 `cdn.jsdelivr.net/gh/withastro/astro@main/` 逐文件重镜像（调研报告 §0 的方法）。
- 许可：Astro 是 MIT —— 移植具体代码合法，保留 attribution；真搬代码时核对上游 LICENSE 文件。

## 全局护栏（继承自仓库 CLAUDE.md）

- `/home/gp/Enter/marko`（marko monorepo）**只读**。
- 技术决策 D1–D6 已定稿于 `docs/background.md`，不重新讨论。
- markopress 用 pnpm workspace（root 暂时兼任 spike app；`packages/*` 由 `pnpm-workspace.yaml` 管理，依赖用 `workspace:*`）。
- 版本时点：`marko@6.4.5`、`@marko/run@0.11.13`（pre-1.0，API 会动）。

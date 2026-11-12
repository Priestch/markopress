# 内容层契约（CONTRACT）

> 契约本体 = `src/content/types.ts`（类型即事实）；本文件定**语义与不变式**，是内置
> loader（`glob`/`strapi`）与自定义 loader（`defineLoader`）共同遵守的规范。形状定格
> 于 Astro 7 main（2026-10 快照，整体抄其 Content Layer）；刻意偏离逐条记录在
> `docs/research/astro-deltas.md`——**改契约前先读它，新偏离必须补记**。契约是对外
> 承诺：变更即 breaking，须在发布说明中标注。
>
> 位置沿革：原计划独立包 `@markopress/content`（packages/content/），2026-10-29 包
> 收敛后并入引擎 `packages/engine/src/content/`，本契约随之落位引擎包内。

## 1. 数据模型：DataEntry

| 字段 | 语义 |
|---|---|
| `id` | 集合内唯一且**稳定**（文件源 = 路径派生 slug；REST 源 = 远端主键）。远端改名不换 id，`slug` 才是可变名 |
| `slug` | URL 用名，可随时间变（frontmatter slug / 远端改名）。默认 = id |
| `data` | 已过集合 zod schema 的结构化数据——loader 必须经 `ctx.parseData` 写入，不过 schema 不进 store（错误带 entry 坐标） |
| `body?` | **源文本，不是渲染产物**。不变式：有 body ⇒ 有 contentType |
| `contentType?` | body 的格式标记（如 `text/markdown`），下游 renderer 注册表的键 |
| `digest?` | 内容指纹（xxhash64）。同 id 同 digest ⇒ 跳过（见 §4 之一） |
| `filePath?` | 相对站点根的 posix 路径；无文件系统的内容源不设 |

渲染一律惰性、按 digest 内存缓存：store 只存源文本，md→HTML/segments 是独立插件点
（packages/markdown，偏离 #1）。

## 2. loader 可见的写面（LoaderContext 注入）

- `ctx.store`（DataStore）：**只写本集合**的 scoped 视图。`set` 按 digest 去重；
  `delete`/`clear` 只影响本集合。
- `ctx.meta`（MetaStore）：按集合持久化的小 KV——同步游标 / last-modified token 用。
- `ctx.parseData`：zod 入口（§1 data 行）。
- `ctx.generateDigest`：内容指纹；string 直接哈希，可 JSON 序列化值序列化后哈希。
- `ctx.entryTypes`：扩展名（含点）→ EntryType。REST loader 对 md body 复用 `.md`
  entryType 剥 frontmatter，与文件源同形（strapi.ts 即此做法）。
- `ctx.logger`：日志面（fork 派生前缀）。

## 3. Loader

```ts
interface Loader {
  name: string                                       // 唯一：内置名（'glob'/'strapi'）或 npm 包名
  load(context: LoaderContext): Promise<void>        // 全量同步单位
  handleFileChange?(context, event): Promise<FileChangeResult>  // 可选增量（文件源）
  watchDirs?: Array<string>                          // 可选：app watcher 据此注册监听
}
```

- `load` 把外部数据源的**当前状态**写进 scoped store。**untouched 差集删除是 loader
  的策略**：循环里记 seen 集合，结束后删除 store 中不在 seen 的 id（远端删除只有
  全量对比能发现；编排层不做这件事）。
- 无文件面的 REST/DB loader 不设 `watchDirs`/`handleFileChange`——每次 sync 全量
  `load`，digest 命中的 entry 零成本跳过（§4 之一）。
- `handleFileChange` 前提：`load` 至少跑过一次（增量映射建立在全量之上）；未实现
  则编排层回退全量 sync。

## 4. 失效三件套（编排层承诺，合规 loader 免费获得）

1. **digest 跳过**：同 id 同 digest ⇒ 不重解析不重渲染。基准断言：1k 条目改 1 条，
   `parseData` 恰好被调用 1 次。
2. **untouched 差集删除**：见 §3——执行在 loader，语义属本契约。
3. **配置指纹 clearAll**：内容配置 digest（集合名 + loader 名投影；app 可用 config
   文件内容 digest 覆盖）变化 ⇒ clearAll 全量重建。不这样，改 schema 后旧数据会带
   着错的类型存活。

## 5. EntryType（格式扩展点）

一种内容格式的解析规则：`extensions`（接管的扩展名）/ `contentType`（renderer 注册
表键）/ `getEntryInfo`（源文本 → data + body）。md 知识在 packages/markdown，本层
只定义接口并经 `ctx.entryTypes` 注入——新格式 = 新 EntryType + 对应 renderer，不碰
content 层。

## 6. 作者面（公开 import）

```ts
import { defineCollection, defineLoader, glob, strapi } from "markopress";
import type { Loader, LoaderContext, DataEntry, DataStore, MetaStore, EntryType } from "markopress";
// 深水面（store/syncer/typegen 等）在子路径 "markopress/content"
```

编写指南与完整 REST 范例：`docs/custom-loaders.md`。

**依赖红线（framework-generic）**：content 子树不得 import vite / marko /
@marko/run / 引擎编排层——`tests/content/audit.test.ts` 锁死。第三方 loader 同理：
只应依赖 Node 内建与自身依赖，契约类型为 type-only import。

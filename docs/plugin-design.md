# 插件系统钩子设计（v0 纸面设计）

> 状态：纸面设计 + **spike 验证完成**（2026-10-15，§8 双路实测全过；两处上游/管线修复已落地）。
> 功能规划与分轮见 `docs/plugin-plan.md`（本文 = 其 R2 的第一步）。
> 方法同 `docs/wp-loader-design.md`：拿 sitemap / rss / local-search 三个试金石插件把钩子在纸上跑一遍——
> 跑不通改钩子，不改插件去凑。
> 结论：跑得通，且逼出两条编排级要求——**contentSynced 在 dev 不得阻塞 ready**、
> **插件产出只准走模块图失效（plugin-data），不得写 routes 目录**（§9 对照清单）。

## 0. 插件面是什么 / 不是什么

markopress 已有的扩展点各有归属，本设计只补「app 级编排钩子」一层：

| 已有扩展点 | 机制 | 与本设计的关系 |
|---|---|---|
| 内容源（glob / wp / …） | loader 契约（packages/content） | 正交；插件可以携带 loader，但 loader 不是插件 |
| 内容格式（md / mdx / …） | EntryType 契约 | **注册面进插件**（entryTypes 数组，契约现成） |
| md 加工（shiki / katex / …） | unified 直通（R1 的 markdown 配置） | 声明性合并面进插件（markdown partial） |
| 主题（布局 + 组件） | D5 taglib（npm 包自动发现） | 正交；插件可随附组件，发现走编译器现成机制 |
| 部署目标 | marko-run adapter（D1） | 不碰 |
| 渲染器（contentType → HTML） | 未来注册表 | **v0 不开**（YAGNI：今天只有 md 渲染器） |

对 Astro 的裁剪：不设 `addRenderer`（无 islands 问题）、不设 `injectScript` / `injectRoute` 运行时注入面
（产出统一为「路由声明 + 数据模块」两种静态物）、不设 updateConfig 深合并机械（只有 entryTypes / markdown
两个声明性合并面）。对 WP 的对照：**命名钩子 + 声明序串行，不做全局 action/filter 派发**（background.md
Phase 3 既定形状的四类钩子点中，layout 一类 v0 缓开，理由见 §7）。

## 1. 配置面与装配点

新配置文件 `markopress.config.ts`（与 `content.config.ts` 分工：那边管数据源，这边管管线与插件）：

```ts
import { defineMarkoPressConfig } from "markopress"; // v0 从 scripts/ 共享层导出
import { sitemap } from "markopress-plugin-sitemap";
import { rss } from "markopress-plugin-rss";
import { search } from "markopress-plugin-search";

export default defineMarkoPressConfig({
  markdown: { remarkPlugins: [], rehypePlugins: [] }, // R1 的直通面
  plugins: [sitemap({ site: "https://…" }), rss({ collection: "docs" }), search()],
});
```

装配点唯一：`content.ts setup()`（ensureSynced 单例内），加载方式与 content.config.ts 同款
（动态 import + `?t=` 防模块缓存）。两路（Vite / Rspack）的一切入口都经 ensureSynced /
generateRoutes / writeContentModules，插件因此**天然双路可用，不感知后端**。

## 2. 钩子清单（v0 接口）

```ts
export interface MarkoPressPlugin {
  name: string;

  // —— 注册面（装配期求值一次，纯声明）——
  entryTypes?: Array<EntryType>;        // 并入 ContentSyncer 的 entryTypes（content.ts:70 现硬编码处）
  markdown?: Partial<MarkdownOptions>;  // remarkPlugins/rehypePlugins 按声明序拼接；标量后声明者赢

  // —— 读路径（store 就绪后；dev 后台执行，不阻塞 ready）——
  contentSynced?(ctx: PluginCtx, changed?: ContentChange): Promise<void>;

  // —— 产出面（生成期一次；产物 = 路由声明）——
  routes?(ctx: PluginCtx): Array<HandlerRoute>;

  // —— 页面级（内容模块渲染时；按 entry digest 缓存）——
  transformBody?(body: string, entry: DataEntry, ctx: PluginCtx): Promise<string>;
  pageData?(entry: DataEntry, ctx: PluginCtx): Promise<Record<string, unknown>>;
}

export interface PluginCtx {
  store: MutableStore;                                  // 只读消费（values / get）
  config: ContentConfig;
  render(entry: DataEntry): Promise<RenderedMarkdown>;  // 共享渲染实例 ⇒ digest 缓存复用
  urlOf(collection: string, id: string): string;        // 从 gen-routes 的 routeFor 抽出共用
  setData(name: string, value: unknown): Promise<void>; // → plugin-data + virtual:mp/plugin/<name>
}

export interface ContentChange {
  changed: Array<{ collection: string; id: string }>;
  removed: Array<{ collection: string; id: string }>;
} // undefined = 全量（启动 / config 变更后）

export interface HandlerRoute {
  path: string;           // 如 "/sitemap.xml"；v0 须为无参数路由
  handlerModule: string;  // 插件包内模块说明符；其导出须含 verbs 列出的全部动词
  verbs: Array<"GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS">;
  // spike 定稿：显式声明并由生成器逐动词发射包装（§3），确定性地不依赖
  // 打包器的动词自动发现（spike 时两路机制曾分歧：Vite=AST、markopack=源码
  // 正则；markopack 后续 f99ddb6 已统一为 AST，§8 #2——分歧消除，设计不变）
}
```

各钩子的调用点与时机：

| 钩子 | 调用点（锚文件） | 时机 | 缓存 / 失效 |
|---|---|---|---|
| 注册面 | `content.ts setup()` | sync 前 | 装配期一次；config 变更 → resetSynced 重建 |
| contentSynced | setup() 全量；applyContentChange 增量 | sync 完成后 | 插件自管（变更集驱动）；同插件串行排队 |
| routes | `gen-routes.ts generateRoutes()` | 生成期一次 | write-if-changed；进 expected 集参与差集清理 |
| transformBody / pageData | `content-modules.ts renderContentModule()` | 模块渲染时 | 按 entry digest × 插件链缓存 |

## 3. 插件产出物（两种，都走模块图）

1. **路由声明**（spike 定稿规则，§8 #1/#2）：
   - 文件名 = 路径段把 `.` 编码为 `%2E`：`/sitemap.xml` → `sitemap%2Exml+handler.mjs`
     （marko-run / markopack 的 `normalizeSegment` 里有 `decodeURIComponent`，段名解码回字面 `sitemap.xml`）。
     反引号整段包裹同样有效但被 Vite/rolldown 拒绝解析，不采用。
   - 包装文件内容固定为两路动词发现的交集形式：
     ```js
     import * as handler from "<handlerModule>";
     export const GET = handler.GET;   // 逐 verbs 声明发射
     ```
   - Vite 路需要 markopress 插件的 `resolveId` 垫片（rolldown 对 `%2E` 路径的相对导入解析失败 →
     映射绝对路径；已在 `markopress-plugin.ts` 落地并验证，属双路纪律允许的打包器特定代码）。
   - 死锁审计：路由文件只在生成期出现 / 消失（内容编辑零事件），动词是静态导出。
2. **数据模块**：`setData(name, value)` 落 `.markopress/plugin-data/<name>.js`（default export JSON，
   write-if-changed）。消费端统一写 `import x from "virtual:mp/plugin/<name>"`：
   - Vite：markopress-plugin.ts 的虚拟模块解析多认一个前缀；
   - Rspack：NormalModuleReplacementPlugin 的 `^virtual:mp/` 重写加一条映射（content→vcontent、
     plugin→plugin-data），落盘文件在编译图内 ⇒ 原生 watcher 失效（spike 已验证此失效路径）。
   handler 模块与主题组件都以此说明符取数——**插件包不感知 app 目录结构**，双后端同源。
   组件发现的前提见 §8 #4：包须声明为依赖 + marko.json 显式 `"tags-dir"`。

## 4. 管线时序（钩子触发点）

启动 / build（两路共用 prepare 形态）：

```
ensureSynced:
  load markopress.config.ts → 实例化 plugins（工厂重跑）
  ContentSyncer({ entryTypes: [markdownEntryType, …pluginEntryTypes] })
  sync() 全量
  contentSynced(ctx) 全量 —— build：await（产物必须齐）；dev：后台（不阻塞 ready，完成后失效产物模块）
  typegen
generateRoutes(): pages ∪ plugins.routes() → 写 +page.marko / +handler.mjs / 差集清理
writeContentModules()（Rspack 落盘；Vite 走 load 惰性）
```

dev 单文件编辑（新增共享函数 `applyContentChange(event)`，两路 watcher 只做转发 + 失效执行）：

```
1. syncer.syncFile(event)                  // store O(1) 更新
2. contentSynced(ctx, change)              // 插件增量；同插件串行，后台
3. 失效（最后做）：virtual:mp/content/<c>/<id> + 本轮 setData 写过的 virtual:mp/plugin/<name>
   Vite → 模块图 + full-reload；Rspack → plugin-data 落盘即原生失效
4. slug 增/删 → generateRoutes()（差集 = 单路由文件事件，既有机制不变）
```

config 变更（content.config.ts / markopress.config.ts 任一）：resetSynced → 全部重来
（配置指纹不同 ⇒ store clearAll，既有机制不变）。

失败语义：build 中插件抛错 = 硬失败（报错带插件名）；dev = 日志降级、该插件本轮跳过。

## 5. 三个试金石走查

### 5.1 sitemap（+ robots.txt 同型）

```ts
export function sitemap(opts: { site: string }): MarkoPressPlugin {
  return {
    name: "sitemap",
    routes: () => [{ path: "/sitemap.xml", handlerModule: "markopress-plugin-sitemap/handler" }],
    async contentSynced(ctx) {
      const urls = Object.keys(ctx.config.collections).flatMap((c) =>
        ctx.store.values(c).map((e) => ctx.urlOf(c, e.id)));
      await ctx.setData("sitemap", { site: opts.site, urls }); // 无 lastmod ⇒ 普通编辑不触发重写
    },
  };
}
```

- 用到的面：routes / config / store / urlOf / setData。handler（包内）import
  `virtual:mp/plugin/sitemap` 拼 XML。
- 增量性：URL 集只在 slug 增删时变；普通编辑下 urls 不变 → write-if-changed 吸收，O(事件) 成立。
- API 诚实性检查：若实现中发现它还需要更多东西，是钩子面设计错了。
- 走查结论：**✅ 跑通，零修改**。

### 5.2 rss

```ts
export function rss(opts: { collection: string; site: string; limit?: number }): MarkoPressPlugin {
  return {
    name: "rss",
    routes: () => [{ path: "/rss.xml", handlerModule: "markopress-plugin-rss/handler" }],
    async contentSynced(ctx, changed) {
      const items = await renderItems(ctx, opts, changed); // 排序/date 取自 entry.data（zod schema 约束）
      await ctx.setData("rss", items);
    },
  };
}
```

- 额外用到的面：**render(entry)**——excerpt 取渲染后首段。关键在 render 是共享实例，与页面渲染
  共用 digest 缓存，不产生第二份渲染。
- 增量性：changed 给出受影响 ids → 只重算对应 item（插件内 Map 缓存），再整体序列化一次。
  每次编辑都改 rss 数据是语义正确的（正文 / 时间变了），走模块图失效，/rss.xml 在 dev 即时更新。
- 走查结论：**✅ 跑通；逼出「render 必须共享实例」入契约（§9 #3）**。

### 5.3 local-search（MiniSearch）

- 无 routes——索引是**数据模块**，由随附的搜索组件（插件包 taglib）消费：
  `import docs from "virtual:mp/plugin/search"`。
- 全量轮：逐 entry `ctx.render(entry)` → `segments[0].html` 按 headings 切节 → MiniSearch 文档；
  增量轮（changed）：O(变更) 更新内存索引，debounce 后 setData 序列化。
- **本次走查的核心产出（逼出的编排规则）**：
  1. dev 启动的全量索引是 O(N) 渲染——**contentSynced 不得阻塞 dev ready**（后台执行，完成后失效
     模块）。build 无此问题（prepare 本就 await 全量，且渲染缓存与页面渲染共享）。
  2. v0 接受 VitePress 同款取舍：dev 全量后台索引（Vite 路径仅此场景牺牲惰性）；v1 的门 =
     setData 支持拉取式（thunk，首请求才计算），v0 不做，记开放问题。
  3. 大站点分块（per-collection 多个 setData name + 客户端逐块搜索、合并 top-k）是插件内部策略，
     契约不感知。
- 走查结论：**✅ 跑通（带上述两条编排规则）**。

## 6. 四纪律的落点（审计清单）

| 纪律 | 落点 |
|---|---|
| 确定性 | 声明序 = 一切顺序（注册合并、钩子调用、transform 链）；无优先级、无事件总线；transformBody / pageData 必须是 (body, entry) 的纯函数——要时间戳走 pageData 的 store 数据（如 git mtime），不准在 transform 里塞 |
| 死锁 | routes 钩子只在生成期产出静态文件；插件数据一律走 plugin-data（routes 目录外）；布局不可被插件触碰（layout 钩子 v0 不开） |
| 双路 | 钩子调用点全在共享层（content.ts / gen-routes.ts / content-modules.ts / applyContentChange）；Vite / Rspack 的 watcher 层只转发事件与执行失效 |
| 增量 | contentSynced 带变更集；pageData / transformBody 按 digest 缓存；transformBody 后必须重算有效 digest（否则毒化渲染缓存）；setData write-if-changed |

transformBody 缓存键推导：变换是纯函数 ⇒ 有效 digest = `generateDigest(entry.digest + 变换链插件名)`，
renderer 以有效 digest 为键——原始 digest 与变换后的缓存互不污染。

## 7. v0 明确不做的面（及理由）

| 裁掉 | 理由 | 重开条件 |
|---|---|---|
| layout 钩子 | 布局选择已是 frontmatter `layout:`（D5）；布局触碰直连死锁红线 | 主题系统落地 |
| renderers 注册面 | 只有 md 一个渲染器（YAGNI；content AGENTS 红线「ctx 按需加」） | 第二个渲染器（mdx / 纯 html）出现 |
| injectScript / head 面 | seo / analytics 需求真实但量小；先看 R2 三插件是否真撞上 | R3 做 og / seo 时定 |
| 拉取式惰性数据模块 | 当前只有 search 一个消费者 | search 的 dev 启动成本实测不可接受时 |
| pageData 的 typegen | content.d.ts 不知插件字段；模板内可用但弱类型 | 首个 dogfood 痛点出现 |

## 8. spike 验证结果（2026-10-15，双路实测：markopack/Rspack + @marko/run/Vite，dev + build）

| # | 验证项 | 结果 |
|---|---|---|
| 1 | 含 `.` 路由段的命名 | ✅ `sitemap%2Exml+handler.mjs` → `/sitemap.xml`（两路 build 产物 + dev 均验证）。**根因**：`parseFlatRoute` 把 `.`（charCode 46=Directory）当扁平路由分隔符，字面点段必须转义；反引号（charCode 96=Escape）须**包住整个段**（``sitemap.`xml` `` 无效），且反引号路径被 Vite/rolldown 解析拒绝 ⇒ `%2E` 编码是唯一双路解 |
| 2 | 包装文件的动词发现 | ✅ 但两路机制**分歧**（spike 时）：Vite 路走 AST（`export { GET } from` 可见），markopack 路对源码跑正则（`routes.ts:139-160`，只认 `export (async )?function/const GET=`，re-export 形式不可见）⇒ 统一 `import * as h; export const GET = h.GET`；HandlerRoute 的 `verbs` 声明由 fallback 转正。**更新（2026-10-16）**：markopack `f99ddb6` 已把动词发现改为 AST export identifiers，分歧消除——显式 `verbs` 声明仍保留（确定性不依赖发现机制） |
| 3 | XML handler 的预渲染 | ✅ 两路都产出 `dist/*/sitemap.xml`。机制：static adapter 把**所有无参路由**（含 handler）列为爬取起点；非 HTML 200 且路径带扩展名 → 原样写盘。**边界**：无扩展名路径被爬虫跳过（`/sitemap` 不落盘）⇒ dot-path 命名是功能硬需求，非装饰 |
| 4 | 插件包 taglib 组件 | ✅ 两路（`<spike-search-box/>` 与直接导入都渲染）。两个前提：包必须出现在根 package.json 依赖里（发现机制 = 逐个**探测声明依赖**的 `<name>/marko.json`，不扫 node_modules 目录）；marko.json 必须显式 `"tags-dir": "./tags"`（`{}` 不触发目录扫描）。taglib 有进程内缓存，改 marko.json 需重启 dev |
| 5 | plugin-data 热更新 | ✅ 两路：编辑 `.markopress/plugin-data/*.js` → Rspack 原生 watcher / Vite 模块图，`/sitemap.xml` 即时反映新数据，routes 目录零文件事件（死锁纪律保持） |

**spike 逼出的两处修复（已落地）**：

1. **markopack `rspack/src/dev.ts`**：原先带扩展名的 URL 一律 sirv 静态优先、未命中直接 404——dev 下
   `/sitemap.xml` 永远到不了 router。改为 sirv 未命中落回 router（sirv 中间件的 next 回调）。已改 + 重建。
2. **markopress `markopress-plugin.ts` resolveId 垫片**：rolldown 对 routes 目录内 `+handler.*` 的
   （`%2E`/反引号）相对导入解析失败（页面能过是因为 `.marko` 走 @marko/vite 自有解析器）→ 插件把
   这类导入映射为绝对路径。build:vite 由必挂转全过。

**spike 遗物（R2 实现的种子，勿当垃圾清掉）**：`gen-routes.ts` 的 SPIKE 块（= routes 钩子生成器的雏形）、
`packages/mp-spike-search`（workspace 假包 = 插件包样例，`"tags-dir"` 写法参考）、
`.markopress/spike-plugins/` + `.markopress/plugin-data/`（= handlerModule 与 setData 产物样例）。

## 9. 契约对照清单（走查逼出的要求 → 实现义务）

| # | 要求 | 条款 |
|---|---|---|
| 1 | search 全量索引不能拖慢 dev 启动 | contentSynced：build await、dev 后台，完成后失效产物模块 |
| 2 | 插件产出不得扰动 routes 目录 | 只准 plugin-data + 虚拟模块；路由文件仅生成期出现 |
| 3 | search / rss 的 render 不得双份渲染 | ctx.render = 共享渲染实例（digest 缓存复用） |
| 4 | 增量不可能没有变更集 | contentSynced 第二参数 ContentChange（undefined = 全量） |
| 5 | transform 后缓存不得毒化 | 有效 digest = digest(entry.digest + 变换链标识) |
| 6 | watcher 抖动 | setData / plugin-data 一律 write-if-changed |
| 7 | sitemap URL 与实际路由不得漂移 | urlOf 从 gen-routes 的 routeFor 抽出共用 |
| 8 | 含扩展名路由双路可用 | 路径段 `%2E` 编码点号；包装 = `import * as h` + 逐动词 `export const GET = h.GET`（§8 #1/#2） |
| 9 | Vite 路插件路由可 build | markopress-plugin 的 resolveId 垫片常驻（§8 修复 2） |
| 10 | 插件包组件可被消费 | 包声明为依赖 + marko.json `"tags-dir"`（§8 #4）——插件文档的安装说明义务 |

---

推进顺序（对齐 plugin-plan R2）：本文件已定稿（含 spike 验证）→ 实现装配（scripts/ 共享层，
吸收 gen-routes SPIKE 块）→ sitemap / rss / search 三插件各一 PR → dogfood 本站 → 冻结 v0。

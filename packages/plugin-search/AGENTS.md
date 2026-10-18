# plugin-search

`@markopress/plugin-search` —— 本地全文搜索（MiniSearch）+ `<mp-search>` 保留槽位实现。
R3 试金石 #3，契约走查 = `docs/plugin-design.md` §5.3。

## 三层分工（换搜索方案 = 换插件包，槽位不变）

- **索引生产**（`src/index.ts`，服务端）：`contentSynced` → store 直建 MiniSearch →
  `setData("search", { index })`。渲染走 `ctx.render`（共享 digest 缓存，与页面渲染零重复）。
  增量轮 O(变更)：变更/删除页 discard 节文档，变更页重渲染 add。
- **索引交付**：`virtual:mp/plugin/search` 数据模块——本插件内部形状，**非公共 API**
  （换 lunr/flexsearch 可变形状，框架不感知）。
- **UI**（`tags/mp-search.marko`）：实现 `<mp-search>` 槽位。theme-docs 顶栏预留该 tag。

## 硬纪律

1. **MiniSearch options 双端同源**：`loadJSON` 不序列化函数（tokenize），服务端建索引与
   浏览器 loadJSON 必须共用 `src/search-options.ts`——改配置只改这一个文件（往返测试覆盖）。
2. **索引实例不进组件 state**（resume 只序列化 UI 态）：模块级 `static const cache`。
   懒加载：首次打开才动态 import（minisearch + 数据模块），不进首屏包。
3. **CSS 零自带色值**：全部 `--mp-*` 令牌（主题属主），自动适配暗色与风格预设。
   类名前缀 `.mp-search-*`。
4. **槽位声明**：注册面 `slots: ["mp-search"]`（装配期撞名 fail fast，`mp-*` 保留命名空间）。
5. **CJK 分词**：`tokenize` 中文逐字（unigram）——MiniSearch 默认按标点/空白切，
   无空格语言整句变单 token 等于不可搜。动它先跑往返测试。
6. 发现机制前提：包必须在 app 的 package.json 依赖里（marko.json tags-dir 探测）；
   **taglib 有进程内缓存，改 marko.json 需重启 dev**（spike §8 #4）。

## 已知边界（v0，刻意不做）

- dev 增量后**已加载**的索引可能滞后一轮 full-reload（contentSynced 是批次末后台任务，
  与虚拟模块失效的 reload 有竞态）——刷新即新。v1 可在数据模块带版本号驱动 UI 失效。
- 大站点索引全量下发（per-collection 分块 + 客户端 top-k 合并是插件内部升级路径，
  plugin-design.md §5.3）；perf 夹具这类万页集合应 `collections` 显式排除。
- 搜索结果排序质量低于 Algolia（typo 容错/同义词）——文档站场景接受。

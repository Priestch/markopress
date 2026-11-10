# 自定义页面设计（非集合路由的一等支持）

> 状态：**已落地**（2026-11-09 实现 + rspack/vite 双路径验收：build 10/10 爬取、dev 增删页
> 不死锁、水合穿过薄包装实证（计数器单份监听）、引擎测试 95/95。v1 边界 = §4.3 禁动态段、
> §4.4-b 禁用户组 layout）。来源：pai-websites 复刻项目
> （paoding-officialweb Gatsby 官网群 → markopress/markopack）首站 pdflux 的能力面实测——
> 9 条路由中 6 条为非内容页，当前框架无法表达。依据：`packages/engine/src/gen-routes.ts`
> 源码核实（行号以 2026-11-09 工作区为准）。
> 关联：`docs/wp-loader-design.md` 是内容侧的镜像问题（"没有文件系统的内容源"），
> 本提案是页面侧（"不是内容的页面"）；槽位契约见 `docs/research/themes.md` §9。
> 评审修订：外壳所有权重排（§4.2，marko-run layout 嵌套语义核实，修正原稿假设
> 错误）、薄包装替代拷贝/symlink（§4.1）、watch 增量路径补全（§4.1）、路由撞车
> 检测（§4.6）；§7 三项开放问题拍板。

## 0. 一句话结论

路由表是 store 的纯投影（差集清理）+ 每页外壳焊死主题槽位 ⇒「内容页 + 营销页混住」
的站无法表达。修法：给**非派生路由**一等概念——用户 `pages/` 目录 gen 期以**薄包装**
并入 `_pages/` 组、清理收窄为按来源差集、主题外壳迁入 `_content/` 组（外壳所有权从
焊死变可选）——同时不触碰死锁防线（硬约束 #1）的语义。

## 1. 场景：pdflux 的形状（实测）

| 路由 | 来源 | 当前框架表达 |
|---|---|---|
| `/guide/*` | 本地 md（`content/operations/`） | ✅ collection（现成） |
| `/log` | Strapi API（构建期） | ⏳ HTTP loader（wp-loader-design 同族，另案） |
| `/blog` | 运行时 HTTP API（客户端拉取） | ❌ 需自定义页 + 客户端组件 |
| `/`、`/en` | 全自定义着陆（营销页） | ❌ 无处安放 |
| `/apidocs`、`/plugin`、`/charge` | 静态自定义页 | ❌ 无处安放 |

真实公司官网的主流形状是**混合站**：VitePress 式「页面皆内容」覆盖不了。Astro 的
「任意文件即页面 + collections 可选」可以——本提案即向那半步挪，但不放弃我们换来
dev 稳定性的生成器所有权。

## 2. 根因（代码级，2026-11-09 核实）

1. **路由表是 store 的纯投影**：`gen-routes.ts:158`
   `const expected = new Set(["+layout.marko", ...pages.map((p) => p.file)])`，
   `:189` 对目录做差集清理（`:193` `(removed)`）。routes 目录是纯生成区——
   手写页面文件下个同步周期被当失效物删除。
2. **每页是主题委托**：生成的 `+page.marko` 只 import
   `virtual:mp/content/<collection>/<id>` 并渲染主题的 `<mp-page>`；外层
   `+layout.marko` 由生成器写死且「必须保持静态」（硬约束 #1）。营销页要的是
   另一种外壳，而外壳恰恰是用户不可触碰的那层。
3. **entry 类型是 md 形状**：`markdownEntryType` 产出 `data + segments +
   headings`。页面是组件不是数据——content layer 没有「原生 .marko 页面」这种
   entry type / loader。

## 3. 为什么不能简单放开 routes 目录（取舍的由来）

marko-run 0.11.13 dev server 的竞态死锁（新增 page + 修改 layout 同一 watcher
批次 → 所有请求永久挂起，见 spike-notes）是靠两条纪律规避的：**routes 纯派生**
（md 编辑 ⇒ 模板不变 ⇒ routes 目录零文件事件）+ **layout 永不变化**。
「让用户随便往 routes 丢文件」等于把死锁面直接交给用户——所以修法必须是
**受控的非派生通道**，不是放开所有权。

## 4. 提案

### 4.1 用户页目录：app 根 `pages/`（评审拍板）

- 命名弃 `routes/`（与 marko-run 生成区心智撞车；用户页确实是「页」）与
  `.markopress/user-routes/`（配置区塞页面代码，gitignore 反排除再翻一轮）；
  `pages/` 与生成区 `.markopress/routes/` 区分度最高，Astro `src/pages` 先例。
- **merge 形态：薄包装 + 显式 import**（原「拷贝 vs symlink」开放问题，双弃）。
  生成器为每个用户页写一个包装，与 `pageTemplate` 显式 import 主题组件同一模式：

  ```marko
  // 生成的 _pages/about+page.marko（相对路径由生成器计算）
  import Page from "../../../pages/about.marko"

  <Page ...input/>
  ```

  三个理由：① 用户文件原地不动，页内相对 import 按真实位置解析——拷贝会改变
  引用深度、symlink 在 Windows/容器/各 watcher 上兼容性三重坑；② 改页面**内容**
  = 模块图失效，routes 目录零文件事件（比拷贝/直通更小的死锁面）；③ taglib 发现
  按模板真实位置就近（app 根），用户页可直接用 `.markopress/components/` 的组件；
  包装是 `.marko → .marko` 闭包，markopack hydrate 发射（clientHydrateImports）
  语义不变。
- 文件名映射（marko-run 扁平路由约定，与派生页同款）：

  | 用户写（pages/） | 生成（.markopress/routes/） | URL |
  |---|---|---|
  | `index.marko` | `_pages/+page.marko` | `/` |
  | `about.marko` | `_pages/about+page.marko` | `/about` |
  | `pricing/team.marko` | `_pages/pricing.team+page.marko` | `/pricing/team` |
  | `guide/index.marko` | `_pages/guide+page.marko` | `/guide` |

  嵌套 index 尾段折叠（2026-11-11 补，blockers #8）：与集合通道 `routeIdFor`
  同语义——目录 index = 目录着陆页。不折叠会落 `guide.index+page.marko`，
  marko-run 只按字面段服务 `/guide/index`（pdflux `/guide` 重定向页实测踩中）。
  折叠把「目录 index」与「显式同名页」（`guide.marko`）收进同一 URL——merge 期
  taken 占用表 fail fast，不静默遮蔽。

- **watch 增量路径（评审补全，原稿缺口）**：gen 期 merge 只在 store/config 变化时
  跑，用户改 `pages/foo.marko` 需要独立事件路：`pages/` 加进 watcher 监听 → 文件
  事件做**单文件包装增删**（非 resetSynced 全量）→ routes 目录文件事件 →
  markopack `watchRoutes` 进程内增量 re-walk。rspack 侧落 `rspack-dev.ts`、vite 侧
  落 `markopress-plugin.ts`（watcher 层 = 双路纪律允许的打包器特定区），包装逻辑
  本体在共享层。
- **清理契约收窄（本提案两条语义变更之一，另一是 §4.2 树重排）**：从「routes
  目录里的一切」改为**按来源差集**——`_content/` 按派生清单（store 投影 + 插件
  路由），`_pages/` 按用户目录镜像。用户删除源文件 ⇒ 镜像失配 ⇒ 包装被清理，
  自洽。实现注意：现清理是顶层浅 `readdirSync`（派生页平铺时够用），子树化后
  各自下放一层——改动局部但非零。

### 4.2 外壳归属：树重排（评审修正——原稿假设错误）

- **原稿「`_pages/` 缺省无外壳」不成立**：marko-run 的 root `+layout.marko` 包住
  其下**所有**页面与嵌套 layout（README:115 "wrap all nested layouts and
  pages"、:309 "Layouts from root-most to leaf-most"），pathless group 隔离不了
  外层 layout。主题外壳现在就在 routes 根——用户页并进任何组都会被包住。
- 修法 = 外壳所有权下放进组，**根目录不放 layout**：

  ```
  .markopress/routes/
    +404.marko             ← 根特例（必须无路径前缀）；根无 layout 后，其生成
    │                          包装内显式 import 主题 Layout 包一层（调用形状
    │                          同 layoutTemplate）
    rss%2Exml+handler.mjs  ← 插件 handler（无渲染，不涉 layout）
    _content/
      +layout.marko         ← 主题外壳从根迁入——只包集合派生页
      <id>+page.marko …     ← 全部派生内容页（平铺命名不变；相对 import 深度 +1）
    _pages/
      <user>+page.marko     ← 用户页，默认裸；要外壳 = 页内显式 import 主题
                              Layout（opt-in，与显式 import mp-page 同规则）
  ```

- 效果：外壳从「焊死」变「按页可选」——派生页默认有，用户页默认无、显式 opt-in。
  theme-blog 的 frontmatter 分流（post/home/list/page）是「一站多外壳」的主题级
  先例；本提案补齐框架级的另一半。
- 迁移：一次性树搬移由 gen 在 **dev 启动期**（serve 前）完成，无在线请求可死锁；
  markopack 路径进程内增量 re-walk；顶层旧派生页经差集清理自愈消失（生成期自愈，
  sidebar.json → site.json 改名同款）。布局文件字节不变（仅路径与相对 import
  深度变），「layout 永不变化」纪律的语义不受影响。
- 弃案记录：root layout 按 route meta 运行期分流（layout 确实收到 request/
  params/route metadata，README:117）——依赖 pre-1.0 的 meta API 形状（硬约束
  #5），且外壳决策藏在壳内部不如树所有权清晰，弃。
- 用户页天然不进 sidebar / prev-next / site.json tree（它们是 store 的投影）。
  若将来要 opt-in，走约定 frontmatter，不在本期。
- **用户 404（2026-11-10 补）**：`pages/404.marko` 是根特例——`userPageFileFor`
  映射到 `+404.marko`（marko-run NotFound 身位，与集合通道 `pageFileFor` 的 404
  特例同款语义：未知路由渲染 + 404 状态），包装落 **routes 根**而非 `_pages/`
  （带组前缀会失去 special 身位）；路由仍占 `/404`（与集合 404 共存经 taken
  fail fast）。撤走清理走根级差集：`MergeResult.hasNotFoundPage` → gen-routes
  并入 expectedRoot。marko-run 侧注意：+404 只对 `Accept: text/html` 的请求渲染
  （非 HTML 协商请求回空 body 404，`curl` 裸测会误判）。

### 4.3 SSG

自定义页是无参数路由 ⇒ adapter-static 爬虫自动覆盖，不产 `urls.json` 条目，
不触发「每页爬两次」路径。**v1 禁动态段**（`[` 开头的文件名 fail fast）：带参数
路由爬虫不覆盖，显式 urls 清单是其配套——留待真实需要时开，先保住「SSG 自动
覆盖」承诺无例外。

### 4.4 死锁边界（关键设计点）

- 用户页**改内容**零 routes 目录事件（包装不变，模块图直连——薄包装的额外
  红利）；**增/删/改名** = 单个包装文件事件 ⇒ markopack `watchRoutes` 进程内
  增量 re-walk（rspack 路径已验证机制），无 marko-run 全量 re-walk 风暴。
- **残余风险**：用户「新增页 + 同批次改组 layout」理论重现原死锁——但只残留在
  仓库内 vite 对照路径（用户面只有 markopress bin = rspack 主路径，进程内增量
  无此死锁）。缓解：
  - b) **v1 禁用户组 layout**（`pages/` 下 `+layout` 命名 fail fast，要外壳用
    页内显式 import）——零成本挡掉最险场景，**起步只做这条**；
  - a) merge 顺序保证（组 layout 先落盘「拆批次」）——同一次 gen run 的写入
    大概率仍落同一 watcher 批次，**不作为防线**，仅留 vite 路径实验性缓解；
  - c) 长期给 marko-run 上游提死锁修复。

### 4.5 命名空间治理

用户页文件名不注册 tag（无用户组件目录那类撞名面），`validateNamespace` 的 mp-*
禁令针对用户**组件目录**（`.markopress/components/`），本提案不新增扫描面。用户
页引用主题组件一律显式 import（与生成器写 `<mp-page>` 的 import 同规则）；页内
写未知 tag 是 Marko 编译硬错误——天然 fence，无需前置 lint。

### 4.6 路由撞车检测（评审补全，原稿缺口）

三路来源共用一个 URL 空间，gen 期对最终路由表做唯一性校验：用户页 vs 集合投影
vs 插件路由，撞车 fail fast 并指明冲突双方（如 `pages/index.marko` 与集合 `index`
entry 都出 `/`——pdflux 恰恰要自定义 `/`，这是必经场景不是边缘 case）。解法
二选一：改用户页名或移除集合 entry；**不做优先级遮蔽**（隐式遮蔽的站行为不可
推理）。

## 5. 明确不做（scope 控制）

- 不做「任意数据 → 任意路由」通用投影（collections 职责；动态营销页 =
  loader 出数据 + 自定义页消费）。
- 不给自定义页做搜索 / sidebar 集成。
- i18n 联动另案——但注意顺序依赖：pdflux 的运行时切语言模型（单构建、客户端
  切）会影响自定义页形态，**i18n 设计定稿前先落地本提案**，避免返工。

## 6. 试金石（验收）

pdflux 全站：`guide` = collection（现成路径）、`log` = Strapi loader（另案）、
其余 6 条路由 = 自定义页（本提案）。

- dev：改用户页热更（模块图直连，routes 目录零事件）；增/删用户页增量 re-walk
  不死锁、全量测试不回退；
- build：SSG 产物含全部用户页，爬虫覆盖无重爬；
- 回归：content 审计测试与引擎 86 测试全绿；gen-routes 新增五条：「用户文件不被
  清理」、「用户删除源文件后生成物被清理」、「路由撞车 fail fast」、「包装幂等
  （二次 gen 零写入）」、「树迁移自愈（顶层旧派生页搬入 `_content/`，旧物
  清失）」。

## 7. 开放问题（2026-11-09 评审后）

已拍板：

- 目录命名 → app 根 `pages/`（§4.1）；
- merge 形态 → 薄包装 + 显式 import，拷贝/symlink 双弃（§4.1）；
- 4.4 缓解 → v1 只做 b（禁用户组 layout），a 降级为 vite 路径实验性缓解（§4.4）。

仍开放：

- 用户页与未来 i18n 的交互（每 locale 一份路由树，还是单份页内切）——留给
  i18n 设计定稿，但本提案必须先落地（§5 顺序依赖）；
- c（marko-run 上游死锁修复提报）的时机；
- wrapper 输入透传形状：`<Page ...input/>` 的 spread 是否无损转发 marko-run 给
  页面的 params/query 输入——spike 第一件事，若 spread 有损改具名转发。

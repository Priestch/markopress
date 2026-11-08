# 自定义页面设计（非集合路由的一等支持）

> 状态：**提案 / 纸上设计**，未实现。来源：pai-websites 复刻项目（paoding-officialweb
> Gatsby 官网群 → markopress/markopack）首站 pdflux 的能力面实测——9 条路由中 6 条为
> 非内容页，当前框架无法表达。依据：`packages/engine/src/gen-routes.ts` 源码核实
>（行号以 2026-11-09 工作区为准）。
> 关联：`docs/wp-loader-design.md` 是内容侧的镜像问题（"没有文件系统的内容源"），
> 本提案是页面侧（"不是内容的页面"）；槽位契约见 `docs/research/themes.md` §9。

## 0. 一句话结论

路由表是 store 的纯投影（差集清理）+ 每页外壳焊死主题槽位 ⇒「内容页 + 营销页混住」
的站无法表达。修法：给**非派生路由**一等概念——用户路由目录 gen 期 merge 进生成树、
差集清理只扫派生清单、自定义页走 `_group/` 裸 layout——同时不触碰死锁防线
（硬约束 #1）的语义。

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

### 4.1 用户路由目录

- 位置：app 根 `routes/`（与 `.markopress/routes/` 生成区对照；命名待定，见 §7）。
- gen 期 merge：用户文件经 write-if-changed 落入 `.markopress/routes/`
  （拷贝或 symlink，待定）；用户源文件永不改动。
- **清理契约收窄（本提案唯一的语义变更）**：差集清理从「目录里的一切」改为
  「生成器写过的派生清单」。`gen-routes` 已有 `written` 语义，改动局部。
  用户删除源文件 ⇒ merge 自然消失 ⇒ 对应生成物作为「派生清单内的失配项」被清理，
  行为自洽。

### 4.2 外壳归属

- 用户页默认**不进** `<mp-layout>`：merge 进 `_pages/`（marko-run/markopack
  的 pathless group 约定，URL 不带 `_pages` 段）+ 组内可自带 `+layout.marko`
  （缺省 = 无外壳，纯页）。
- theme-blog 的 frontmatter layout 分流（post/home/list/page）已是「一站多外壳」
  的主题级先例；本提案把它补成框架级能力的另一半（组级裸 layout）。
- 用户页天然不进 sidebar / prev-next / site.json tree（它们是 store 的投影）。
  若将来要 opt-in，走约定 frontmatter，不在本期。

### 4.3 SSG

自定义页是无参数路由 ⇒ adapter-static 爬虫自动覆盖，不产 `urls.json` 条目，
不触发「每页爬两次」路径。

### 4.4 死锁边界（关键设计点）

- 用户页增/删 = routes 目录文件事件 ⇒ markopack `watchRoutes` 进程内增量
  re-walk（rspack 路径已验证机制），无 marko-run 全量 re-walk 风暴。
- **残余风险**：用户「新增页 + 同批次改组 layout」理论重现原死锁。缓解按
  侵入性排序：
  - a) merge 阶段保证组 layout 文件先于 page 文件落盘（拆 watcher 批次）；
  - b) 初期禁用户组 layout（文档写明），需要外壳时用页内组件布局；
  - c) 长期给 marko-run 上游提修复。
- 倾向 **a + b 起步**（b 几乎零成本挡掉最险场景，a 兜其余）。

### 4.5 命名空间治理

用户路由目录纳入 `validateNamespace` 扫描面（mp-* 禁令同样适用）；用户页引用
主题组件一律显式 import（与生成器写 `<mp-page>` 的 import 同规则，避开 taglib
全局发现的撞名坑）。

## 5. 明确不做（scope 控制）

- 不做「任意数据 → 任意路由」通用投影（collections 职责；动态营销页 =
  loader 出数据 + 自定义页消费）。
- 不给自定义页做搜索 / sidebar 集成。
- i18n 联动另案——但注意顺序依赖：pdflux 的运行时切语言模型（单构建、客户端
  切）会影响自定义页形态，**i18n 设计定稿前先落地本提案**，避免返工。

## 6. 试金石（验收）

pdflux 全站：`guide` = collection（现成路径）、`log` = Strapi loader（另案）、
其余 6 条路由 = 自定义页（本提案）。

- dev：改用户页热更；增/删用户页增量 re-walk 不死锁、全量测试不回退；
- build：SSG 产物含全部用户页，爬虫覆盖无重爬；
- 回归：content 审计测试与引擎 86 测试全绿；gen-routes 新增
  「用户文件不被清理」与「用户删除源文件后生成物被清理」两条测试。

## 7. 开放问题

- 用户目录命名：`routes/` vs `pages/` vs `.markopress/user-routes/`；
- 4.4 缓解选型（a/b/c 的组合与时机）；
- merge 落地形态：拷贝 vs symlink（Windows / 容器 / watch 兼容性）；
- 用户页与未来 i18n 的交互（每 locale 一份路由树，还是单份页内切）。

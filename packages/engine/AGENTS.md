# @markopress（引擎）— Agent 指南

> 引擎 = CLI + 装配层 + 路由生成 + 双后端集成 + 资产管线 + 内置件。子树细则：
> 进 `src/content/` 前先读 **AGENTS-content.md**，进 `src/markdown/` 前先读
> **AGENTS-markdown.md**；资产管线设计定稿在 `docs/images-v2-design.md`
> （叶子层纪律 / SSRF 授权面 / 缓存语义都在那，不在此重复）。

## 职责地图（root 只做编排）

- `src/content.ts`：ensureSynced 单例（装载 store/meta → sync → typegen → 插件注册/通知）
- `src/plugins.ts`：MarkoPressConfig 类型 + 插件机制（setData / routes / slots / contentSynced / pageData / transformBody）
- `src/gen-routes.ts` + `user-pages.ts`：三源路由表（store 投影 + app 根 pages/ 用户页 + 插件 handler；三源 URL 撞车 gen 期 fail fast）+ sidebar 派生（并入 site.json）
- `src/markopress-plugin.ts`（Vite）/ `src/rspack-*.ts`（Rspack 双胞胎）：虚拟模块解析 + watcher 失效 + build
- `src/content-modules.ts`：虚拟模块源码唯一来源（两后端共用，别在一侧另写）
- `src/ssg.ts`：config.ssg.urls → adapter-static Options.urls（参数路由枚举）
- `src/builtins/`：rss / sitemap / search（与第三方 markopress-plugin-* 同形）
- `tags/`：`<mp-image>` 两条路——服务端数据驱动（server import + await）与
  编译期字面量 transform（tag transform → `virtual:mp/image/…`，详见 images 设计文档）

## mp-* 命名空间治理（装配期 validateNamespace，fail fast）

① 主题组件**显式 import**（生成器经 resolveTheme 包路径写 import）——taglib 是
全局发现、探测从模板**就近 package.json** 出发，多主题共存时撞名（theme-blog
曾顶包 theme-docs）；② 插件槽位必须 mp-* 且唯一；③ 插件槽位不得与 ACTIVE
主题 tag 同名；④ 用户组件目录（.markopress/components）禁 mp-* 前缀（撞插件
tag + 遮蔽管线 `<mp-image>`）。同款机制推论：**只有生成物能解析插件包
taglib**——插件 UI 槽位接线（如 `<@search><mp-search/></@search>`）因此生成在
`routes/_content/+layout.marko`，位置归主题（`<if=input.search>`），实现归插件。

## 生成器纪律（改 gen-routes / 包装模板前必读）

- `_content/+layout.marko` 必须**静态**：站点数据走 `site.json` 模块 import，
  运行期绝不改布局文件（「新增 page + 改 layout 同一 watcher 批次」触发
  marko-run 0.11.13 dev server 竞态死锁，`docs/spike-notes.md`）
- 根目录不放 layout（root layout 包住一切，用户页默认裸就无处安放）；主题外壳
  只住 `_content/`，+404 在包装内显式包主题 Layout（marko-run 约定：根目录 +
  无路径前缀 + `+404` 后缀 = NotFound 页，加前缀会被当路径段失去特殊身份）
- 用户页包装只显式 import app 根 pages/ 真身（.marko→.marko 闭包，水合语义
  不变）；默认无外壳，要外壳 = 页内显式 import 主题 Layout（opt-in）；违禁
  命名：`[` 动态段 / `+` 角色 / `_` pathless / 文件名点号——gen 期 fail fast
- 写文件前比对内容（write-if-changed），避免无效 watcher 抖动
- `$!{html}` 等插值不得出现在模板根级的裸行（concise mode 解析成 custom tag），
  必须包在显式开闭标签内
- per-page `<title>` = postbuild HTML 补写（`src/patch-titles.ts`；marko-run 无
  head 通道）：rspack 在 rspack-build.ts 收尾，vite 走 build:vite 串联脚本
  （adapter 爬取晚于一切 Vite 钩子）；dev 期显示站名 = 已知边界

## 双路并行纪律（同树双命令，不用 git 分支）

新功能落共享层（content/store/gen-routes/content-modules/images）；打包器特定
代码只允许出现在虚拟模块解析与 watcher 层（Vite = markopress-plugin.ts，
Rspack = rspack-*.ts）。

**失效不变量**（死锁纪律的落地点，细节与历史坑见 `docs/spike-notes.md`）：
md 编辑 → O(1) `syncer.syncFile`（fileToId 映射定位）→ 只失效该 entry 虚拟模块
→ full-reload，**routes 目录零写入**；slug 增/删才产生单个 `+page.marko` 事件
（「再生成 × re-walk」是核心机制）；config 变更 → resetSynced 全量重建；插件
`contentSynced(changed)` 批末后台入队（进程级单飞链），plugin-data 落盘走模块
图/原生 watcher 失效，同样不碰 routes 目录；watcher 监听所有 loader 声明的
`watchDirs`。

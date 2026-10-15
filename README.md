# markopress

基于 Marko 6 + `@marko/run` 的内容框架 —— 目标形态介于 VitePress（文件即页面的文档 SSG）与 WordPress（动态内容、后台发布）之间，对标 Astro 在 Marko 生态中的位置。

核心差异化：Marko 6 的 resumability 让「内容里嵌交互组件」几乎零客户端成本 —— 没有 islands 核算、没有 hydration 运行时、静态页面近零 JS。

## 状态

- [x] 调研（2026-10-14）：结论见 [docs/background.md](docs/background.md)
- [x] Phase 0 spike（2026-10-14）：方案成立（Go），结论与踩坑见 [docs/spike-notes.md](docs/spike-notes.md)
- [ ] Phase 1 文档 MVP（pages 模式 + unified 管线 + 默认 docs 主题 + SSG）
- [ ] Phase 2 collections / 博客（内容层 + 动态路由 + 搜索）
- [ ] Phase 3 WordPress 方向（DB loader + 后台 + 按需重验）

## 文档

| 文档 | 内容 |
|---|---|
| [docs/background.md](docs/background.md) | 调研结论、总体架构、关键技术决策（D1–D6）、分阶段路线图、风险 |
| [docs/research/marko-internals.md](docs/research/marko-internals.md) | Marko 仓库：编译器公开 API、流式 SSR、resumability 机制、taglib 扩展点、公开/内部红线 |
| [docs/research/marko-run.md](docs/research/marko-run.md) | `@marko/run`：Vite 插件架构、路由约定与代码生成、适配器、以及在它之上建框架的扩展点排序 |
| [docs/research/astro.md](docs/research/astro.md) | Astro：Content Layer（最值得抄的部分）、Markdown 管线、islands 与 client 指令、三环境构建 |
| [docs/research/vitepress.md](docs/research/vitepress.md) | VitePress：md→页面、主题契约、SSG 管线、数据加载；以及 WordPress 方向的分层判断 |

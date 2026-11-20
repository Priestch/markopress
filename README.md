# markopress

[English](#english-1) · [中文](#中文-1)

A Markdown-driven content framework built on **Marko 6**. This repo is the monorepo; the npm package you install is [`markopress`](./packages/engine) — see its README for quick start.

## English

### Repository layout

| Path | What |
|---|---|
| `packages/engine` | npm package `markopress` — engine CLI, content layer, markdown renderer, image pipeline, built-in rss/sitemap/search, built-in themes (`themes/{docs,blog}`) |
| `packages/site` | Dogfood site (docs) in scaffold-template form — the dev surface mirrors the user surface |

### Development

```sh
pnpm install
pnpm dev          # Rspack dev server (docs site)
pnpm build        # SSG build → dist/server/public
pnpm dev:vite     # Vite comparison path
pnpm --filter markopress test
```

Requires Node ≥ 22.18 (workspace packages ship as TS source, no build step) and pnpm 12. The npm package publishes compiled `dist/` via `prepack` — the workspace dev loop never builds.

Deep docs live in `CLAUDE.md`, `packages/engine/AGENTS*.md`, and `docs/`.

### License

[MIT](./LICENSE)

---

## 中文

基于 **Marko 6** 的内容框架 monorepo；用户安装的 npm 包是 [`markopress`](./packages/engine)（快速开始见其 README）。

### 仓库结构

| 路径 | 内容 |
|---|---|
| `packages/engine` | npm 包 `markopress` —— 引擎 CLI、内容层、markdown 渲染、图片管线、内置 rss/sitemap/search、内置主题（`themes/{docs,blog}`） |
| `packages/site` | dogfood 文档站（scaffold 模板形态）——开发面即用户面 |

### 开发

```sh
pnpm install
pnpm dev          # Rspack dev 服务器（docs 站）
pnpm build        # SSG 构建 → dist/server/public
pnpm dev:vite     # Vite 对照路径
pnpm --filter markopress test
```

需要 Node ≥ 22.18（workspace 包以 TS 源码分发，零构建步骤）与 pnpm 12。npm 包经 `prepack` 编译出 `dist/` 再发布——workspace 开发循环不构建。

深度文档见 `CLAUDE.md`、`packages/engine/AGENTS*.md` 与 `docs/`。

### 许可

[MIT](./LICENSE)

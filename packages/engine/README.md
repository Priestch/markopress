# markopress

[English](#english) · [中文](#中文)

A Markdown-driven content framework built on **Marko 6** — VitePress/Astro shaped: `.md` files are pages, typed collections, one command for dev / build / preview. Ships with two built-in themes (docs & blog), an image pipeline (AVIF/WebP), and RSS / sitemap / full-text search out of the box.

## English

### Requirements

- Node.js **≥ 22.18** (native type stripping)
- pnpm / npm (any)

### Quick start

```sh
mkdir my-site && cd my-site && pnpm init && pnpm add markopress zod
mkdir -p content .markopress
```

Create `.markopress/config.ts`:

```ts
import { defineCollection, defineMarkoPressConfig, glob } from "markopress";
import { z } from "zod";

export default defineMarkoPressConfig({
  collections: {
    docs: defineCollection({
      loader: glob({ pattern: "**/*.md", base: "./content" }),
      schema: z.object({
        title: z.string(),
        date: z.coerce.date().optional(),
        description: z.string().optional(),
      }),
    }),
  },
  theme: { name: "docs", options: { site: "My Site" } },
});
```

Update `package.json` (add `"type": "module"` — required, the config is ESM) and add scripts:

```json
{
  "type": "module",
  "scripts": {
    "dev": "markopress dev",
    "build": "markopress build",
    "preview": "markopress preview"
  }
}
```

Drop Markdown files into `content/`, run `pnpm dev`, done. `markopress build` emits a self-contained static site (`dist/server/public/`).

### Themes

Two built-in themes, switched with one line — no extra packages to install:

```ts
theme: { name: "docs" }   // or { name: "blog", options: { ... } }
```

- **docs** — top bar + sidebar + dark mode + style presets (`default` / `vitepress` / `starlight` / `nextra` / `docusaurus`)
- **blog** — nav-bar + time-ordered post flow, frontmatter `layout: post | home | list | page`

Light customization needs no theme at all — every theme reads the `--mp-*` CSS variables, and `options.css` links your own stylesheet (put it under `public/`, edits are live):

```ts
theme: { name: "docs", options: { css: "./public/theme-overrides.css" } }
```

External themes are npm packages (or local paths) implementing the `<mp-layout>` / `<mp-page>` slot contract — see the repo's `AGENTS-themes.md`.

### What's inside

- **Content layer** — typed collections (zod schemas), `glob` / `strapi` loaders plus custom loader API, content store with O(1) incremental sync
- **Markdown pipeline** — GFM, shiki dual-theme highlighting, Marko component segments inside prose
- **Image pipeline** — local & authorized remote images, AVIF/WebP formats, `![]()` takeover, SSRF protection
- **Built-ins** — RSS, sitemap, MiniSearch full-text search (CJK-aware)
- **Bundler** — markopack (Rspack) primary path with full-reload dev; Vite comparison path via `markopress/vite`

### License

[MIT](./LICENSE)

---

## 中文

基于 **Marko 6** 的内容框架，VitePress/Astro 形态：`.md` 即页面、类型化集合、dev / build / preview 一命令。内置 docs / blog 两个主题、图片管线（AVIF/WebP）、RSS / sitemap / 全文搜索。

### 环境要求

- Node.js **≥ 22.18**（原生 type stripping）
- pnpm / npm 均可

### 快速开始

```sh
mkdir my-site && cd my-site && pnpm init && pnpm add markopress zod
mkdir -p content .markopress
```

新建 `.markopress/config.ts`：

```ts
import { defineCollection, defineMarkoPressConfig, glob } from "markopress";
import { z } from "zod";

export default defineMarkoPressConfig({
  collections: {
    docs: defineCollection({
      loader: glob({ pattern: "**/*.md", base: "./content" }),
      schema: z.object({
        title: z.string(),
        date: z.coerce.date().optional(),
        description: z.string().optional(),
      }),
    }),
  },
  theme: { name: "docs", options: { site: "我的站点" } },
});
```

`package.json` 更新（加 `"type": "module"`——必需，config 是 ESM）并加脚本：

```json
{
  "type": "module",
  "scripts": {
    "dev": "markopress dev",
    "build": "markopress build",
    "preview": "markopress preview"
  }
}
```

把 Markdown 放进 `content/`，`pnpm dev` 即可。`markopress build` 产出自包含静态站点（`dist/server/public/`）。

### 主题

两个内置主题，一行切换，无需额外安装：

```ts
theme: { name: "docs" }   // 或 { name: "blog", options: { ... } }
```

- **docs** —— 顶栏 + 侧边栏 + 暗色模式 + 风格预设（`default` / `vitepress` / `starlight` / `nextra` / `docusaurus`）
- **blog** —— 无侧边栏顶栏 + 时间序文章流，frontmatter `layout: post | home | list | page`

轻度定制不需要写主题——所有主题都吃 `--mp-*` CSS 变量，`options.css` 链接你自己的样式文件（放在 `public/` 下，改即生效）：

```ts
theme: { name: "docs", options: { css: "./public/theme-overrides.css" } }
```

外部主题 = 实现 `<mp-layout>` / `<mp-page>` 槽位契约的 npm 包（或本地路径），详见仓库 `AGENTS-themes.md`。

### 内置能力

- **内容层** —— 类型化集合（zod schema）、`glob` / `strapi` loader + 自定义 loader API、O(1) 增量同步的内容 store
- **Markdown 管线** —— GFM、shiki 双主题高亮、正文中嵌 Marko 组件段
- **图片管线** —— 本地图与授权远程图、AVIF/WebP、`![]()` 接管、SSRF 防线
- **内置三件** —— RSS、sitemap、MiniSearch 全文搜索（CJK 感知分词）
- **构建** —— markopack（Rspack）主路径 + dev full-reload；Vite 对照路径走 `markopress/vite`

### 许可

[MIT](./LICENSE)

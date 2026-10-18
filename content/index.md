---
title: Home
date: 2026-10-15
description: markopress 文档站 —— .md 即页面的内容框架（Rspack 主链路）。
---

# markopress

This page is `content/index.md`, rendered through a **generated** Marko route.
The page body comes from a virtual module (imported by a minimal `+page.marko`
wrapper), and the surrounding chrome — sidebar, TOC, dark toggle — is the
`@markopress/theme-docs` theme package.

## What this proves

- `.md` files become routes without patching `@marko/run` internals
- frontmatter (`title`, `order`) and the markdown body both make it to the page
- the theme is a swappable npm package implementing the `mp-layout` /
  `mp-page` slot contract (`docs/research/themes.md`)
- prev/next and the sidebar are derived from the file tree at generation time

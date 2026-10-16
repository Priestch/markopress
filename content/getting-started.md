---
title: Getting Started
---

## Create a page

Drop a `.md` file in `content/`. It becomes a route named after the file.
Nested files nest: `content/guide/install.md` would serve at
`/guide/install`.

:::tip
Code blocks are highlighted with [shiki](https://shiki.style) — dual
theme, languages loaded on demand. No configuration needed.
:::

```js
// highlighted by shiki (github-light / github-dark)
console.log("hello from markdown");
```

```ts
import { defineMarkoPressConfig } from "./scripts/plugins.ts";

export default defineMarkoPressConfig({
  markdown: {
    shiki: { themes: { light: "github-light", dark: "github-dark" } },
  },
});
```

```sh
pnpm dev        # docs site (markopack/Rspack)
pnpm dev:vite   # Vite comparison path
```

:::warn
Containers are `:::name` blocks (remark-directive): `tip`, `info`,
`warn`, `danger` ship with theme styles.
:::

## Editing while dev runs

Save the file and reload the browser — the content watcher syncs that
one entry (O(1)) and only its virtual module is invalidated. Routes
directory stays untouched.

> Adding and *deleting* files in `content/` is the core thing this spike
> exists to validate.

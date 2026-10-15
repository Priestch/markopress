# 调研：Astro 架构

> 调研日期：2026-10-14 · 方法：GitHub 浅克隆失败（代理中断），改为从 cdn.jsdelivr.net 逐文件镜像 ~100 个关键源码文件（路径与上游仓库完全一致），加上 astro@7.3.8 / @astrojs/mdx@8.0.3 的 npm 包产物与官方文档。全部只读，未安装未执行。
> 镜像位于 `/tmp/research/astro-mirror/`、`/tmp/research/dist-full/`、`/tmp/research/mdx-pkg/`（临时目录，可能已清理）。研究版本：Astro 7（main，2026-10）。

## 0. How this was researched (clone status)

`git clone --depth 1` of withastro/astro failed: the network proxy killed the long GitHub transfer twice (pack stalled ~10MB). Instead ~100 source files were mirrored one-by-one from cdn.jsdelivr.net/gh/withastro/astro@main/ into /tmp/research/astro-mirror/ (paths identical to the real repo layout, Astro 7 main branch), plus two npm tarballs for publish-time generated artifacts. Docs were read via webReader. Nothing was installed, built, or executed — read only. All file paths below are relative to /tmp/research/astro-mirror/ and match the real repo.

## 1. Content collections / Content Layer + loaders (highest-value pattern)

### Core design
The Content Layer completely decouples **where content comes from** from **how it's stored, validated, typed, and rendered**. Content sources are `Loader`s; storage is a data store; the rest of the system only ever sees the store.

**Key files:**
- `packages/astro/src/content/content-layer.ts` — the sync orchestrator
- `packages/astro/src/content/data-store.ts` — DataEntry shape, serialization, global store
- `packages/astro/src/content/mutable-data-store.ts` — debounced persistence
- `packages/astro/src/content/loaders/glob.ts`, `loaders/file.ts` — built-in loaders
- `packages/astro/src/content/runtime.ts` — `getCollection`/`getEntry`/`render` runtime
- `packages/astro/src/content/config.ts` — `defineCollection` user API
- `packages/astro/src/content/types-generator.ts` — `.astro/types.d.ts` generation
- `packages/astro/src/content/utils.ts` — zod validation (`getEntryData`), frontmatter parse
- `packages/astro/src/content/vite-plugin-content-virtual-mod.ts` — virtual modules bridging store→app

### The user API
```ts
// src/content.config.ts
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/blog' }),  // or file(), fetch(), custom
  schema: ({ image }) => z.object({ title: z.string(), cover: image() }),
});
```
Collection types: `content_layer` (has a loader), `data`, legacy `content`, `live`. Schema is a zod v4 type or a function of `{image}` (so frontmatter image strings become validated imports). `createReference()` makes a zod union (`string|number|{id,collection}|{slug,collection}`) that normalizes to `{id, collection}` — cross-collection foreign keys validated after sync (content-layer.ts walks all entries for `{id, collection}` objects and checks `store.has`).

### Loader contract (the portable idea)
A loader is `({ collection, store, meta, logger, config, parseData, renderMarkdown, generateDigest, watcher, entryTypes, refreshContextData }) => Promise<void>`. Everything a loader needs is handed to it; it writes entries into a **collection-scoped** store view. Function-style loaders are wrapped by `simpleLoader` with a zod schema (must return `Array<{id}>` or a record). This contract is framework-generic — nothing in it knows about Astro components.

### Store design
`DataEntry = { id, data, filePath, body, digest, rendered: { html, metadata: { imagePaths, headings, frontmatter } }, deferredRender, assetImports, imageImports }`. Two faces: `MutableDataStore` (dev, debounced disk writes with dirty flags + write queue; `onFileWritten` listeners drive deterministic virtual-module invalidation) and `ImmutableDataStore` (build/dev-read). Serialization is **devalue** NDJSON, chunked per collection — the build emits content as lazy per-collection code chunks via a manifest of dynamically-imported parts (`ImmutableDataStore.fromModule` accepts a Map, a devalue-flattened array, or the chunked manifest). Net effect: unused collections cost zero bundle.

### Caching / invalidation (the clever part)
- Per-entry **xxhash digest** of file contents: unchanged digest ⇒ skip re-parse/re-render entirely.
- Config-digest keys in a per-collection **metaStore** (`content-config-digest`, `astro-config-digest`, `astro-version`): changed ⇒ `clearAll()`. This is how schema edits invalidate everything.
- glob loader keeps an `untouchedEntries` set (Set-difference of before/after) and deletes untouched entries at the end — incremental sync without full clears.
- Sync is serialized through a PQueue(1); parse/render inside runs at pLimit(10).

### Runtime
`getCollection(name, filter)`, `getEntry`, `getEntries` read the global store imported through the virtual module `astro:data-layer-content`. `render(entry)` either returns pre-rendered HTML (wrapped via `createComponent(() => serverRender\`${unescapeHTML(html)}\`)`) or, for `deferRender` entries (glob's memory optimization for huge sites), dynamically imports a per-file module. Image fields resolve lazily through an `astro:asset-imports` virtual module with copy-on-write along just the accessed path.

### Type generation
`types-generator.ts` writes `.astro/types.d.ts` from a template with marker replacement (`// @@DATA_ENTRY_MAP@@`, `@@CONTENT_CONFIG_TYPE@@` → `typeof import('./src/content.config.ts')`), mapping each collection to `InferEntrySchema<'blog'>` from the zod schema. Loaders can expose `createSchema()` for dynamic `{schema, types}`; per-collection JSON Schemas + a `collections.json` manifest (file→collection) power editor intellisense. Integrations can `injectTypes` from the `astro:config:done` hook.

### Live collections
`defineCollection({ type: 'live', loader })` — LiveLoader exposes `loadCollection`/`loadEntry` with `cacheHint {tags, lastModified}`; fetched at request time, cache hints merged. WordPress-shaped by design.

## 2. Markdown → page pipeline

### .md as a first-class module (framework-generic, Vite-native)
`packages/astro/src/vite-plugin-markdown/index.ts` turns `.md` into a TS component in the Vite **load** hook (not transform — a comment in the file explains transform loses raw `import.meta.env`). The generated module exports `frontmatter, file, url, rawContent(), compiledContent(), getHeadings(), Content` where `Content = createComponent(...)` renders pre-compiled HTML. `frontmatter.layout` wraps output through that layout component. Markdown files under `src/pages/` are therefore just page modules — routing needs no special case beyond "collect .md pages too". Collection entries skip the layout wrap via a `MARKDOWN_CONTENT_ENTRY_FLAG`.

### Processor pipeline
`packages/markdown/remark/src/index.ts` — `createMarkdownProcessor` builds a unified pipeline: `remarkParse → remarkGfm/remarkSmartypants → user remarkPlugins → remarkCollectImages → remarkRehype({allowDangerousHtml}) → shiki|prism → user rehypePlugins → rehypeImages → rehypeHeadingIds → rehypeRaw → remarkStringify`. Metadata (headings, local/remote image paths, frontmatter) flows out via `vfile.data.astro`, returned as `{code, metadata}`. Astro 7 makes the processor itself pluggable (`markdown.processor`): the new Rust-based **Sätteri** is the default, unified/remark optional — but both implement the same tiny contract: `render(content, {fileURL, frontmatter}) → {code, metadata}`. That contract (not unified itself) is the portable piece. Images referenced in MD body become hashed safe imports (`vite-plugin-markdown/images.ts`).

### MDX (integration-shaped, not core)
@astrojs/mdx 8.0.3 adds MDX entirely through the integration API: `addRenderer({name:'astro:jsx', serverEntrypoint})` + `addPageExtension('.mdx')` + `addContentEntryType({extensions:['.mdx'], getEntryInfo, contentModuleTypes, handlePropagation:true})` + `updateConfig({vite:{plugins:[mdxVitePlugin, postprocess]}})`, inheriting the markdown config (shared remark/rehype plugin lists). This is the model for "add a content format without touching core."

### Content entry types
`addContentEntryType({extensions, getEntryInfo(entryInfo→{data, body, slug, rawData}), contentModuleTypes, handlePropagation})` is the general mechanism (hidden, non-enumerable hook arg): any extension can become a content-entry format with its own frontmatter parser and generated `.d.ts`. Data-only formats use `addDataEntryType`.

## 3. Islands + client directives

### End-to-end flow
1. **Compiler** (`packages/astro/src/vite-plugin-astro/index.ts`): compiling a `.astro` file returns `{code, css[], scripts[], hydratedComponents, clientOnlyComponents, ...}` — the hydrated-component list feeds the client build's input discovery. A `client:` directive becomes plain props: `client:<directive>` (value), `client:component-path`, `client:component-export`, and `client:component-hydration` — a marker prop proving hydration was added statically.
2. **SSR** (`packages/astro/src/runtime/server/render/component.ts` + `hydration.ts`): `extractDirectives` pulls those props out (throwing on unknown directives, validated against the registered directive map), picks a renderer, renders framework HTML via `renderer.ssr.renderToStaticMarkup`, then `generateHydrateScript` emits `<astro-island component-url component-export renderer-url props ssr client opts>` with props serialized as **type-tagged tuples** and HTML-escaped. Children = SSR HTML + `<template data-astro-template>` for slots the framework didn't render + `await-children` attr + `<!--astro:end-->` streaming marker. `astroId = shorthash(export:url + html + serializedProps)` dedupes identical islands.
3. **Prescripts** (npm dist `runtime/server/scripts.js`): the page embeds the directive + island runtime as **classic IIFE scripts** (not modules) so they execute before the parser reaches the island; deduped per render via `result._metadata.hasDirectives`.
4. **Client runtime** (`packages/astro/src/runtime/server/astro-island.ts`, published prebuilt): a custom element. Waits for children (MutationObserver on the `<!--astro:end-->` comment; DOMContentLoaded fallback), then `Astro[directive](load, opts, this)`. `load` = `Promise.all([import(component-url), import(renderer-url)])` with a query-cache-buster retry after 1s. Props revived **top-down** (not JSON.parse reviver) from tuples `[typeId, value]` (object/array/RegExp/Date/Map/Set/BigInt/URL/typed arrays/±Infinity). Hydration order enforced parent-first via `closest('astro-island[ssr]')` + `astro:hydrate` event. Slots gathered from `astro-slot` elements + templates. `__proto__/constructor/prototype` export keys rejected.

### Directives themselves
`packages/astro/src/runtime/client/{load,idle,visible,only,media}.ts` — the whole contract is `(load: () => Promise<() => void>, options, element) => void`; each is a few lines (idle = requestIdleCallback w/ 200ms fallback; visible = IntersectionObserver on children because `astro-island` is display:contents; media = matchMedia once). They're **prebuilt to IIFE strings** at publish; custom directives (integrations call `addClientDirective`) get the same treatment at build time via rolldown → IIFE registering `self.Astro[name]` and dispatching `astro:<name>` — the island element waits for that event if the directive isn't registered yet. Directive *strategies* are therefore a tiny, fully generic extension point.

### The framework-coupled seam
Everything framework-specific lives in **renderers**: `{name, serverEntrypoint: {renderToStaticMarkup, check}, clientEntrypoint: hydrator}` added via `addRenderer`. `check()` claims a component; the client entry is a `hydrator(element)(Component, props, slots, {client})`. React/Vue/Svelte adapters are just renderer packages. `client:only` skips SSR and must name a renderer. (Server islands — `server:` directive → deferred placeholder fetched at request time — are renderer-free and generic; `runtime/server/render/server-islands.ts`.)

## 4. SSG build pipeline + adapter interface

### Three environments
`packages/astro/src/core/build/static-build.ts` builds with Vite's builder API in order: **prerender env → SSR env → client env**. The crucial trick: the client env's input is **discovered during the SSR/prerender passes** (`internals.clientInput` = hydratedComponents + clientOnlyComponents + rendererClientEntrypoints + scripts, sorted for determinism). Asset/manifest URLs aren't known until after bundling, so chunks are emitted with **placeholders** (SERIALIZED_MANIFEST, LINKS, server-island map) rewritten post-build by `plugins/plugin-manifest.ts`; `ssrMoveAssets` then consolidates assets into the client dir.

### Page generation is getStaticPaths, not crawling
`packages/astro/src/core/build/generate.ts`: paths come from `prerenderer.getStaticPaths()` — NOT a link crawl. The **prerenderer is pluggable** (`astro:build:start` → `setPrerenderer`), so adapters can replace generation. Concurrency via PLimit(config.build.concurrency), batched at 100k; duplicate-path conflict detection; fallback routes as a second pass; experimental incremental build cache (configHash + lockfileHash + per-entry render hashes + orphan pruning); post-pass image optimization with PQueue(cpuCount).

### Hybrid rendering (per-route prerender)
`packages/astro/src/core/routing/create-manifest.ts` walks `src/pages` (`[param]`, `[...spread]`, regex segments; `_`-prefixed ignored; endpoints by extension), merges injected + redirect routes, sorts with `routeComparator` (priority.ts), and — the hybrid mechanism — reads each route component's source to set a per-route `prerender` flag (pLimit(10)); `astro:route:setup` lets integrations flip it per route. Route collision detection included.

### SSR runtime + manifest
`packages/astro/src/manifest/serialized.ts`: `virtual:astro:manifest` is a SerializedSSRManifest (dirs, base, assets, entryModules, routes, clientDirectives as IIFE code, renderers, i18n, image config...) with lazy wiring for renderers/routes/pageMap/middleware/actions. Dev inlines the JSON; build ships the placeholder, rewritten post-bundle. `packages/astro/src/core/app/base.ts` — BaseApp: `match(request)` → route match; `render(request, {routeData, locals, clientAddress, ...})` → Response, with prerendered 404/500 handling and i18n domain routing. **Middleware** (`core/middleware/index.ts`): `context` object (request, params, cookies, locals, clientAddress, i18n, actions) + `sequence()` composition; integrations add pre/post arrays (`addMiddleware`).

### Adapter interface
An adapter is just an integration that calls `setAdapter` (`packages/integrations/node/src/index.ts` + `standalone.ts`): `{ name, serverEntrypoint, previewEntrypoint?, adapterFeatures: {buildOutput: 'server', middlewareMode, staticHeaders}, supportedAstroFeatures: {hybridOutput, ..., each flagged stable/experimental/unsupported}, entrypointResolution }`. The node adapter's standalone server chains static-file handler → app handler and exposes `{stop, closed}`. The contract is "give me an app entry that turns a Request into a Response" — generic over any runtime (cloudflare/netlify/vercel adapters mirror this).

## 5. Integrations API

`packages/astro/src/integrations/hooks.ts` is the whole surface:
- **astro:config:setup** — `addRenderer`, `injectScript`, `injectRoute`, `addWatchFile`, `addClientDirective`, `addMiddleware`, `addDevToolbarApp`, `updateConfig` (deep-merged), and the hidden non-enumerable `addPageExtension` / `addContentEntryType` / `addDataEntryType` + `createCodegenDir`.
- **astro:config:done** — `setAdapter` (+ feature-flag validation so adapters declare what they support), `injectTypes`.
- **astro:server:{setup,start,done}** — dev server (`refreshContent` for live content sync), `astro:build:{start (setPrerenderer), setup (vite config merge), ssr (manifest), generated, done}`, **astro:route:setup** (per-route prerender), **astro:routes:resolved**.

Adapters are unshifted to the front of the integration list — an adapter is an integration, not a separate concept. MDX is the canonical proof the API is sufficient to add a whole content format.

Config itself: `astro.config.mjs` validated by zod schemas (`core/config/schemas/`), flattened to an immutable `AstroSettings`; `defineConfig` + `mergeConfig` semantics.

## 6. Framework-generic vs framework-coupled

**Generic (portable to any Vite meta-framework, incl. Marko):**
- The entire Content Layer: loader contract, per-collection scoped stores, digest-based invalidation, metaStore config digests, devalue chunked serialization as lazy chunks, zod schemas + `createReference`, type generation via template markers, virtual modules exposing the store.
- Markdown-as-module via a Vite load hook; the `{code, metadata}` processor contract; content entry types.
- File-based routing manifest + route comparator + per-route prerender flag; placeholder-then-rewrite manifest injection; client-input discovery from SSR pass; pluggable prerenderer; getStaticPaths-style generation; incremental build cache hashing.
- Integration hook system; adapter-as-integration with `Request→Response` contract; middleware `sequence()`; SerializedSSRManifest.
- Directive *strategies* (the tiny `(load, opts, el) => void` IIFEs).

**Coupled to React/Vue/etc (NOT portable as-is):**
- The renderer abstraction (`check`/`renderToStaticMarkup`/client hydrator) exists solely to host foreign framework components — Marko needs none of it.
- Prop type-tagged tuple serialization/revival — exists because serialized React/Vue props must round-trip; Marko 6's resumability makes this unnecessary.
- `<astro-island>`'s hydrate choreography (top-down ordering, slot templates, `<!--astro:end-->`) — again a hydration problem Marko doesn't have.
- `guessRenderers`/`client:only` renderer resolution heuristics.

## 7. Not / lightly covered
- **Theming/starters**: only lightly covered. Themes are npm-installable starters or integration packages; layouts (`src/layouts/*.astro`) are plain components pages opt into via `frontmatter.layout` — no theme slot mechanism in core. Static assets: `public/` is copied verbatim; optimized images go through `astro:assets` + sharp (`packages/astro/src/assets/services/sharp.ts`) with service-based image endpoints injected per adapter.
- **Dev-server internals** (vite-plugin-astro-server) and ClientRouter/view transitions: skimmed only.

## 8. What to borrow for a Marko content framework

1. **Copy the Content Layer shape wholesale** — it's Astro's best architecture and Marko needs no changes to benefit: loaders (glob/file/fetch/custom/live) → per-collection store → zod schema → generated types → `getCollection`/`render`. For a WordPress-like system, the **live collection + cacheHint{tags, lastModified}** design and the **metaStore digest invalidation** are exactly the right primitives.
2. **Digest-keyed incremental sync** (xxhash per entry, untouched-set deletion, config digest → clearAll) — directly answers "re-validate 10k posts without rebuilding."
3. **Markdown in a Vite load hook exporting a component + frontmatter + metadata**, with a pluggable processor behind a `{render → {code, metadata:{headings, imagePaths, frontmatter}}}` contract; a Marko `Content` export can be a compiled Marko template rather than an HTML string — strictly better than Astro's escaped-HTML wrap.
4. **Content data as lazy per-collection chunks** (devalue NDJSON chunk manifest) so bundle cost scales with what's actually queried.
5. **Integration hooks with adapters-as-integrations**, hidden `addContentEntryType`-style extension points, `injectTypes` for typegen — cheap to adopt, proven sufficient (MDX).
6. **Skip the islands machinery.** Marko 6 is resumable: `client:` directives, renderers, prop-tuple serialization, and astro-island's hydrate ordering solve problems Marko doesn't have. Borrow only the *directive strategy* shape if you want lazy-activation semantics; the natural Marko equivalent is compiled resume boundaries, not a hydration runtime.
7. **Build pipeline**: adopt per-route prerender flags + sorted route manifest + placeholder-rewrite for the manifest, and client-input discovery from the SSR pass (Marko's translator already tells you every client bundle a page needs). Prefer `getStaticPaths`/loader-driven generation over link crawling for a content site; keep the pluggable prerenderer seam.

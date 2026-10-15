# 调研：@marko/run（Marko 官方应用框架）

> 调研日期：2026-10-14 · 方法：官方文档（markojs.com，`.md` 后缀取 markdown）+ 源码浅克隆只读研究。
> 版本时点：`@marko/run` v0.11.13。克隆位于 `/tmp/research/marko-run`（临时目录，可能已清理）；下文文件路径均相对该克隆根目录，与上游仓库布局一致。

Sources: docs downloaded to `/tmp/research/docs/*.md` (9 pages, enumerated from https://markojs.com/llms.txt); source clone read-only, nothing installed/executed.

## 1. What it is; maturity

- `@marko/run` v0.11.13 ("The Marko application framework") — Vite-powered, zero-config, file-based routing + streaming SSR + adapters. Pre-1.0 but actively published (0.11.7→0.11.13 between 2026-07-30 and 2026-09-23; last commit 2026-10-04). `peerDependencies: marko "5 - 6"`, so it already runs on Marko 6 / runtime-tags.
- Modern toolchain: Vite ^8 + rolldown ^1 (rolldown-vite), `@marko/vite` ^6, `@marko/compiler` ^5.39. TS-source-shipped (`exports` point at `src/`, built to `dist/` on publish).
- Workspace layout: `packages/run` (core), `packages/adapters/{node,static,netlify}`, `packages/explorer` (`@marko/run-explorer` v2.0.5 — dev-only routes/code explorer UI on a side port, gated by `MR_EXPLORER=1`). `examples/{zero-config,node-express,static,netlify}`.

## 2. Vite plugin architecture (`packages/run/src/vite/`)

`markoRun(opts)` (`plugin.ts:92`) returns a plugin **array**:

1. `defaultConfigPlugin` — port defaults (3000).
2. `marko-run-vite:pre` (`enforce: "pre"`) — does everything: adapter resolution, config massaging, virtual-module `resolveId`/`load`, dev watcher, SSR/client build coordination.
3. `markoVitePlugin(markoVitePluginOptions)` — `@marko/vite`, which actually compiles `.marko` (via `@marko/compiler`) in both SSR and client builds. marko-run forwards **all** `@marko/vite` options plus three of its own: `runtimeId`, `basePathVar`, and `isEntry(importee, importer)` — a callback telling @marko/vite which `.marko` files are page entries (the generated layout+page combos, and files that import handlers/middleware) (`plugin.ts:475-482`). `Options = MarkoRunOptions & MarkoViteOptions` (`vite/types.ts:85`).
4. `marko-run-vite:post` — rewrites static `Run.href(...)` calls in client builds to tagged templates/helpers (`utils/href-replace.ts`, tiers 0-2 down to string literals), cleans sourcemaps, persists route data between builds, logs the routes table (per-route JS size/GZip).

**Virtual modules** (`vite/constants.ts`): prefix `virtual:marko-run/` maps to files inside the package (`resolveId` `plugin.ts:767-789`); generated route code lives under absolute paths in a `virtualFiles: Map<string,string>` keyed by `<root>/__marko-run__<route-key>.js`, `<root>/__marko-run__middleware.js`, `<root>/__marko-run__router.js`, served by `resolveId`/`load`. The specifier `@marko/run/router` is aliased to the generated router file (in dev, module imports instead get `runtime/router.ts`, a facade deferring to `globalThis.__marko_run__` to avoid an eval cycle). Build order: SSR build first, then client build reconstitutes route data via `ReadOncePersistedStore` (`utils/read-once-persisted-store.ts`); client build errors if SSR build didn't run (`plugin.ts:713-739`).

Zero config: the CLI falls back to `src/cli/default.config.mjs` (`plugins: [marko()]`) when no `vite.config.*` exists; adapters are auto-discovered by package-name pattern `@marko/run-adapter*` or `*marko-run-adapter*` in package.json deps (`resolveAdapter`, `plugin.ts:942-980`).

## 3. Routing (`vite/routes/`, `vite/codegen/`)

**File conventions** (docs: file-based-routing.md; regex in `routes/builder.ts:16-22`):
- `+page.marko`, `+layout.marko`, `+404.marko`, `+500.marko` — page-ish files are **hard-locked to the `.marko` extension** (`(page|layout|404|500)\.(?:.*\.)?marko`, where `(?:.*\.)?` allows locale variants like `+page.fr.marko`).
- `+handler.*`, `+middleware.*`, `+meta.*` — **any extension**.
- Directory types: static, pathless (`_name`), dynamic (`$param`), catch-all (`$$param`); flat routes via `.` separators, multi-path via `,`, groups via `(a,b)`, optional segments, backtick escaping (parser: `routes/parse.ts`, ~220 lines, produces `Path[]` with segment types).
- Execution order per request: middleware root→leaf, handler, layouts root→leaf, page. **Layouts+page are fused at build time into one generated `.marko` entry template** (`codegen/index.ts:33-68`, written to `<outDir>/.marko-run/<key>.marko` as nested `<Layout1><Page/></Layout1>`), so nested layouts cost nothing at runtime.

**Route tree generation**: `buildRoutes({ walker, basePath }, outDir)` (`routes/builder.ts:38`) walks a `Walker` (`routes/walk.ts:16` — `Walker = (options: WalkOptions) => Promise<void>` with `onEnter/onFile/onDir`; `createFSWalker` is the fs impl, `createTestWalker` for tests) feeding a virtual-dir tree (`routes/vdir.ts`). Output `BuiltRoutes = { list: Route[], special: {404,500}, middleware }` (`vite/types.ts:87-124`; `Route` carries `key, index, path: PathInfo, layouts, middleware, meta, handler, page, templateFilePath`).

**Generated code** (`codegen/index.ts`): per route, a virtual entry `__marko-run__<key>.js` exporting `get5(context)`, `get5_options` (normalized validation opts), `get5_meta`; middleware composed via `normalizeHandler`/`compose` (arrays composed in order, options merged verb-aware). One router file: `globalThis.__marko_run__ = { match, fetch, invoke }`; `match` is a **compile-time-generated trie of switch statements per HTTP verb** (no regex/path-to-regexp at runtime — `writeRouterVerb`, `codegen/index.ts:838+`); `invoke` applies the trailing-slash policy, creates the context, runs handler chains, renders 404/500 pages when `Accept: text/html`. Generated types at `.marko-run/routes.d.ts` (only when a tsconfig exists): `declare module "@marko/run"` with an `App` route map and per-file `Run` namespaces (`$.ContextForFile<id>`), so `ctx.params/search/body/data` and `Run.href` paths are typed per file (`renderRouteTypeInfo`, `codegen/index.ts:368-568`; docs typescript.md).

Dev-mode re-walk: the `:pre` plugin's `configureServer` watches the routes dir for add/unlink/change of routable files and invalidates the virtual files (`plugin.ts:656-712`).

## 4. Server runtime (`runtime/`)

- **WHATWG-fetch based.** The whole server model is `fetch(request, platform) -> Response`. `runtime/internal.ts` is the meat: `createContext` (ctx: `route, request, method, url, params, search, body, data, meta, platform, parent, serializedGlobals` + `fetch/render/redirect/back`; `$global.params`/`$global.url` auto-serialized for hydration), `call()` (handler/next chain with dev-mode diagnostics), `compose`, `normalizeHandler`, `normalizeOptions` (params/search/json/form validation, Standard Schema + function validators, body size/part limits via `@remix-run/form-data-parser`), and the global `Run` namespace (`Run.GET/POST/.../ALL` verb helpers + `Run.href`).
- **SSR streaming**: `ctx.render` calls `template.render({...input, $global: context})` and wraps the async-iterable render in a lazy `ReadableStream` Response (`content-type: text/html`, status 200). A `Symbol.for("@marko/run.render")` stash on the Response lets the Node adapter write raw HTML strings straight to the socket. Docs data-loading.md push the "pass promises through `next()`, `<await>` in template" streaming pattern.
- **Handlers/middleware**: `+handler.*` exports uppercase verb names; `+middleware.*` default-exports handler(s) or options-only `Run.ALL({search})`. `next(data)` shallow-merges into `ctx.data` and renders the page for GET/POST/QUERY (200 for HEAD, 204 otherwise). `+meta.*` attaches per-route metadata with verb overrides (`utils/meta-data.ts`).
- Dev server (`adapter/dev-server.ts`): Vite in middleware mode (`appType: "custom"`), `ssrLoadModule("@marko/run/router")` on first request, then `createMiddleware` (Node↔WHATWG conversion, `adapter/middleware.ts`) — includes abort-on-disconnect, origin/trustProxy handling, error overlay over Vite's WS.
- Default Node entry (`adapter/default-entry.mjs`): http server + compression + serve-static (`public/` 10-min cache, `public/assets/` immutable 1y) + router middleware. That's the whole prod server.

## 5. Adapters & deployment (docs adapters.md)

`Adapter` interface (`vite/types.ts:35-68`) — the main programmatic extension surface: `plugins({root, command})` (inject Vite plugins), `configure(config)`, `pluginOptions(options)` (mutate marko-run options), `viteConfig(config)`, `getEntryFile()`, `startDev({entry, config, options})`, `startPreview`, `buildEnd({routes, config, builtEntries, sourceEntries})`, `typeInfo(writer)` (add `Platform` types into routes.d.ts), `runtimeInclude()`, `routesGenerated({routes, virtualFiles, meta})`, `isEntryTemplate({template, importer})`.

- **node** (`adapters/node`): default-equivalent; exports `routerMiddleware()` / `matchMiddleware()` + `invokeMiddleware()` for mounting in Express/Connect.
- **static** = SSG (`adapters/static`): `buildEnd` imports the built SSR entry's `fetch` directly (or boots it over HTTP for custom entries), crawls from all parameterless routes + `urls` option (array or `async (routes) => string[]`), follows relative anchors via htmlparser2, writes `<path>.html` / `<path>/index.html` into `dist/public/`, honors a crawled 404 page, then deletes the server entries. Preview = sirv with `.html` extension fallback.
- **netlify**: functions or edge (`ssr.target: "webworker"`).
- Adapter selection order: plugin `adapter` option → package.json dep name match → bundled default (`plugin.ts:942`).

## 6. Client side

- **MPA, not SPA**: no client router, no prefetching, no navigation interception anywhere in the runtime (only match for "prefetch" is the static crawler honoring link rels). Each navigation is a full page load; interactivity is Marko's fine-grained hydration per component, managed by `@marko/vite` linked mode.
- marko-run's own client runtime is ~5 lines (`runtime/client.ts`: `window.Run ||= { href }`). Static `Run.href(...)` calls in client bundles are rewritten at compile time (tier 0 = string literal; tiers import tiny helpers `href_path/href_values/href_keys` from `virtual:marko-run/runtime/url-builder`); a fully static page with no interactive components ships essentially zero framework JS. The build logs a per-route Size/GZip table.
- `+404.marko`/`+500.marko` served for `Accept: text/html` requests; `HEAD` auto-served by GET with body stripped; `QUERY` is a marko-run-specific verb.

## 7. Extension points for a framework built ON TOP (the key section)

Ranked by cleanliness:

1. **Wrap the Vite config / compose plugins** — `markoRun()` is an ordinary plugin factory; a meta-framework ships its own `defineConfig` helper that inserts plugins before/after it, passes through `Options` (all `@marko/vite` opts incl. `babelConfig`), and sets `routesDir`/`adapter`/`trailingSlashes`. Additional Vite plugins compose normally (multi-environment caveats are handled internally, `plugin.ts:583-623`). This is the intended path and costs nothing.
2. **`getApi(resolvedConfig).addExternalRoutes({ name, routes: [{ path, entryFile, verbs }] })`** — public API on the `:pre` plugin (exported from `@marko/run/vite`; `plugin.ts:433-439,986-992`). Reference use: `packages/run/src/__tests__/fixtures/external-routes/vite.config.ts`. Caveat: it registers extra entry files with the bundler/explorer/size table and entry detection, but does **not** add paths to the generated router — routing for those stays the embedding app's job (custom server entry + `@marko/run/router`'s `match`/`invoke`).
3. **`emitRoutes(routes)` option** — async callback with the final `Route[]` after generation (dev, and on SSR `writeBundle`) — good for a content framework to mirror its manifest, feed a sitemap, etc.
4. **Custom `Adapter`** — implement any subset of the hooks above; the official node/static/netlify adapters are small reference implementations (26-228 lines). A content framework can use `buildEnd` for post-processing (static adapter does its whole SSG there), `plugins` to inject vite plugins, `viteConfig` to reshape the build, `typeInfo` to extend `Platform`.
5. **Programmatic embedding** — `@marko/run/router` exports `fetch/match/invoke` for an existing server (docs runtime.md#embedding); `@marko/run/adapter/middleware` exports `createMiddleware(fetch, opts)` for Connect-style servers. The CLI itself just calls Vite's `build`/`resolveConfig` programmatically (`cli/commands.ts`), so a framework can replicate dev/build/preview with its own orchestration.
6. **Options injection via config key** — `__MARKO_RUN_PLUGIN_CONFIG__` / `__MARKO_RUN_ADAPTER_CONFIG__` on the Vite config (`vite/utils/config.ts`) is how out-of-band tools pass options in; internal but stable within the package.

**Adding a new route file extension (`.md` pages) — what the source says:**

- You cannot make `+page.md` routable: the routable-file regex (`routes/builder.ts:16-22`) hard-codes `.marko` for page/layout/404/500, and the option surface exposes no way to extend `RoutableFileTypes` or the regex. The walker (`Walker` interface) is pluggable and `buildRoutes` accepts arbitrary sources, but neither is exported through the package `exports` map — deep imports are blocked.
- The workable patterns for a content framework:
  - a. **Generate a routes dir**: compile content → Marko (or thin `+page.marko` wrappers importing md-derived components) into a generated directory and point `routesDir` at it (docs discourage moving off `src/routes`, but the option works and is relative to the vite config). The dev watcher re-walks on add/unlink/change of routable files in that dir, so regeneration is hot. Handlers/middleware/meta already accept any extension, so `+handler.ts` files can stay handwritten while pages are generated.
  - b. **`addExternalRoutes` + custom entry**: for content that lives outside the routes dir, register entry files and do matching yourself around `match`/`invoke`.
  - c. A Vite `transform` can compile `.md` → Marko-compatible JS for anything *imported from* real `.marko` pages (normal Vite plugin territory), which pairs cleanly with (a).
- Useful primitives already present for content: `+meta.*` (any ext; JSON or any module's default export; verb overrides) → `ctx.meta`; layouts fused at build time (theme chrome is free); `<await>` streaming; static adapter crawl+`urls` for SSG; typed `Run.href` for internal links.

## 8. Caveats / gotchas

- Pre-1.0 (0.11.x): APIs here are moving — e.g. the `MarkoRun` global namespace is already deprecated in favor of `Run`. CHANGELOG shows steady patch-flow, no breaking-change cadence yet.
- `routesDir` divergence from `src/routes` is explicitly discouraged in docs (ecosystem convention).
- Handler verb discovery parses actual module exports (via `transformWithOxc` in dev, `context.load` in build) — generated handler files must really export `GET`/`POST` etc. (`plugin.ts:140-158`).
- Client `Run.href` optimization only supports direct `Run.href(...)` calls (aliasing `Run` breaks it; falls back to shipping the url-builder).
- The repo ships an agent-facing `cheatsheet.md` and wires route-build errors to point at it — generated `routes.d.ts` tells coding agents to read it.
- Marko peer range "5 - 6" means a Marko-6-based content framework can depend on it today.

Doc page refs (all under https://markojs.com/docs/marko-run/, `.md` for markdown): getting-started, file-based-routing, typescript, validation, data-loading, runtime, cli, vite-plugin, adapters.

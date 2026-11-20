# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. Keep it lean — subsystem depth lives in the docs indexed at the bottom.

## What this project is

markopress: a content framework built on Marko 6 + `@marko/run` (VitePress/Astro-shaped — `.md` files are pages). Pilot/status tracking: `docs/pdflux-pilot-blockers.md`. Technical decisions D1–D6 are finalized in `docs/background.md` — do not reopen them; research reports live in `docs/research/` (when they disagree with reality, the installed source in `node_modules/@marko/run` is authoritative; `rspack-watcher.md` is the basis for the markopack/Rspack migration).

**Before working in `packages/engine/src/content/` or `src/markdown/`, read AGENTS-content.md / AGENTS-markdown.md in that package first.**

## Packages

- `packages/engine` (= npm package `markopress`): engine CLI + content layer + markdown renderer + asset pipeline + built-in rss/sitemap/search + **built-in themes** (`themes/{docs,blog}` slots + `tags/` engine taglib incl. mp-content-styles). Engine-wide ops manual: `packages/engine/AGENTS.md`.
- `packages/site`: dogfood site = scaffold-template form; all scripts go through the `markopress` bin — the dogfood surface is the user surface.
- npm publish surface = **single `markopress` package** (themes built in; v0.1.0 decision). External themes are npm packages or local paths — contract: `packages/engine/AGENTS-themes.md`. Root only orchestrates.

## Common commands

```sh
pnpm dev       # Main path = markopack (Rspack) dev; defaults to the docs site (content/, dogfooding features)
                #   PORT sets the port; includes dev full-reload (SSE + /__markopack_reload.js injection)
pnpm build     # Docs-site SSG: dist/server/public/ is the self-contained static root (build clears dist automatically)
pnpm dev:perf  # Perf-test mode (.markopress/perf.config.ts = docs + 5000-page fixtures in content-perf/)
pnpm build:perf# Perf SSG; generate fixtures: node scripts/perf-test.mjs 5000
pnpm dev:vite  # Vite comparison path (@marko/run + vite.config.ts + markopress-plugin.ts)
pnpm build:vite# Vite SSG: dist/public/*.html (shares dist/ with the rspack output — clean before comparing)
pnpm preview   # Preview the Rspack output (sirv dist/server/public, /404 fallback); preview:vite previews the Vite output
pnpm gen       # Run the route generator manually (dev/build run it automatically; usually unneeded)
                #   site's public/ = site-source static assets (robots.txt etc.; rspack dev sirv chain +
                #   adapter build copy — markopack 0.4.0 convention)
pnpm --filter markopress test  # All engine tests (content / markdown / search / images / root-level)
```

**Perf is decoupled from the default path**: the default `.markopress/config.ts` has only the docs collection; perf runs `MP_CONTENT_CONFIG=.markopress/perf.config.ts` (dev:perf/build:perf already set it). The two configs' digests differ ⇒ switching triggers a full store rebuild + generated-dir shrink/regrow (write-if-changed + set-difference cleanup, self-healing).

## Environment gotchas

- Node ≥ 22.18 (native type stripping; workspace packages ship as TS source, no build step), pnpm 12 (esbuild build approval in `pnpm-workspace.yaml` `allowBuilds` — package.json's `pnpm` field is no longer read).
- **pnpm 12 can hang** at "Verifying lockfile against supply-chain policies" after lockfile changes — run `node_modules/.bin/markopress dev|build` directly under site/ to bypass.
- **markopack is temporarily a local `link:`** — two engine deps point at `/home/gp/Enter/markopack/packages/*` via absolute paths (pnpm 12 mangles relative `link:` to @scope packages). After changing markopack, run `pnpm build` inside it first (dist emits a single-file index.js); no reinstall needed here. Switch back to the npm version once it ships one containing proxy.
- **Any package containing `.marko` tags must declare `@marko/runtime-tags`** — compiled output imports it; under pnpm's strict layout it won't resolve otherwise. Engine declares it as a real **dependency** (published packages need it installable; devDep only fixes the workspace). External theme packages must do the same.
- **markopress npm package shape**: `publishConfig` swaps exports/bin to compiled `dist/` (`prepack` = tsc + copy image-module-loader.cjs). The workspace still consumes `src/*.ts` directly — engine changes need no build during dev; only publishing builds.
- No app-level linter — acceptance is manual browser testing (Playwright MCP) plus `pnpm build`.
- **Dual-path discipline**: the content layer / store / `gen-routes.ts` / `content-modules.ts` are shared by the vite and rspack paths — new features land in the shared layer; bundler-specific code lives only in virtual-module resolution and the watcher layers (Vite = markopress-plugin.ts, Rspack = rspack-*.ts). Comparison data: `docs/perf-rspack-vs-vite.md`.

## Architecture (data flow)

```
.markopress/config.ts — the single user config: collections (loader + zod schema;
  optional route.prefix decouples physical dir from URL) + theme{name,options}/
  markdown/plugins + head[] (site-level head entries)
  → engine/src/content.ts (ensureSynced singleton: load store/meta → sync →
    typegen → plugin registration)
content*/ + loaders (glob/strapi/custom via defineLoader)
  → .markopress/store/<collection>.json (devalue)
  → engine/src/gen-routes.ts (three-source route table: store projection +
    app-root pages/ user pages + plugin handlers; URL collisions fail fast;
    sidebar derived into site.json)
.markopress/ generated area (user area = config.ts + components/, git-tracked;
  app-root pages/ = user page sources):
  routes/_content/+layout.marko      theme shell (static; plugin UI slots wired here)
  routes/_content/<name>+page.marko  minimal <mp-page> wrapper
  routes/_pages/<user>+page.marko    thin wrapper importing the app-root page file
  routes/+404.marko                  root special case, wraps the theme Layout itself
  routes/<seg%2E…>+handler.mjs       plugin route wrappers
  plugin-data/ · site.json · page-nav.js · urls.json
  vcontent/ vmeta/ vseg/ vcollection/ vcollection-content/ · content.d.ts /
  virtual.d.ts / entry.ts
  → markopress-plugin.ts (vite) / rspack-*.ts (rspack twin: virtual modules land
    on disk; NormalModuleReplacement rewrites virtual:mp/… requests)
virtual:mp/content/<c>/<id> → { data, segments, headings } (lazy render + digest cache)
virtual:mp/collection/<name>     metadata-only aggregate (vmeta; client-safe)
virtual:mp/collection-content/<name>  opt-in body aggregation — Marko `server import` only
md Marko component segments (engine/src/segments.ts) and the asset pipeline v2
  (engine/src/images.ts) plug in here — see AGENTS-markdown.md / images-v2-design.md
themes render the shell, <mp-content-styles/>, and the head-injection chain
  (contract details in packages/engine/AGENTS-themes.md)
```

Invalidations: md edit → O(1) syncFile → only that entry's virtual module invalidates → full-reload; slug add/remove → a single `+page.marko` appears ("regenerate × re-walk"); config change → resetSynced full rebuild. The routes directory gets zero writes outside slug changes.

## Hard constraints (lessons from real bites — read before touching the generator/templates)

1. **The generated `_content/+layout.marko` must stay static**: site data like nav goes through `site.json` (module import); never mutate the layout file at runtime. "New page + layout modification in the same watcher batch" deadlocks the marko-run 0.11.13 dev server (all requests hang forever; `docs/spike-notes.md`). No layout in the routes root — a root layout wraps everything including user pages; the theme shell lives only under `_content/`, and 404 explicitly wraps Layout inside its wrapper.
2. **Interpolation like `$!{html}` must never sit on a bare line at template top level** — concise mode parses it as a custom tag; wrap it in explicit open/close tags (e.g. `<article>…</article>`).
3. **Never hand `staticAdapter()` a literal `urls` array** — the adapter already crawls all parameterless routes, and an explicit manifest makes every page crawled twice (concurrency ×2, OOM on large sites; `docs/spike-notes.md`). Param-route enumeration goes through `config.ssg.urls` (wired in rspack-build via `src/ssg.ts`; function form receives `{ routes, collections }` with a post-sync snapshot). If ever passing urls directly, `staticAdapter({ urls })` accepts only an async function — the factory is invoked eagerly when vite.config is evaluated.
4. `/home/gp/Enter/marko` (the marko monorepo) is a **read-only reference**: syntax in `packages/runtime-tags/cheatsheet.md`, resume mechanics in `RESUMABILITY.md`. Never modify it.
5. `@marko/run` is pre-1.0 (0.11.x); the API will move. This repo pins `^0.11.13`.
6. **Commit messages are English-only.** Subject and body follow the repo's conventional-commit style entirely in English — Chinese has crept in twice before. Applies to every commit type, docs/chore included. Chinese in docs and code comments is fine.

## Marko 6 syntax cheat sheet (forms used in this repo)

State `<let/count=0>` (updates are plain assignments, `count++`); events `onClick() { … }`; loops `<for|item| of=nav>`; dynamic tag / layout body `<${input.content}/>`; raw HTML `$!{html}` (fragment must be balanced); module-level constants `static const`; per-render constants at template level use the `<const/x=…>` tag (bare `const x = …` parses as a `<const>` tag and errors, unless prefixed `static`); inside `.marko` you can `import nav from "../nav.json"`; **an inline `<script>` is compiled into the browser bundle (deferred execution)** — for literal inline HTML (pre-paint anti-flash scripts) use `<html-script>`.

## Generated directories & git

`.markopress/` = user directory (config.ts / perf.config.ts / components/, git-tracked) + generated subdirectories (store/routes/vcontent/vmeta/vseg/vcollection/vcollection-content/plugin-data + site.json/page-nav.js/urls.json/content.d.ts/virtual.d.ts/entry.ts, selectively gitignored). **Clearing the cache = delete the generated subdirectories; never `rm -rf .markopress`** (it would wipe user config). Also gitignored: `.marko-run/`, `dist/`, `packages/site/marko.json` (generated). App-root `pages/` is user page sources (git-tracked; dogfood example: packages/site/pages/showcase.marko). `content-perf/` holds perf fixtures (`node scripts/perf-test.mjs [N]`).

## Where deep detail lives

| Topic | Read |
|---|---|
| Content-layer contract, store, vmeta red line | `packages/engine/AGENTS-content.md`, `packages/engine/CONTRACT.md` |
| Markdown renderer, segments / vseg mechanism | `packages/engine/AGENTS-markdown.md` |
| Images & asset pipeline (leaf-layer discipline, SSRF, caches) | `docs/images-v2-design.md` |
| Engine assembly, generators, mp-* governance, title patching, invalidation detail | `packages/engine/AGENTS.md` |
| Themes (built-in docs/blog, slots, tokens contract, external packages) | `packages/engine/AGENTS-themes.md` |
| Custom loader authoring | `docs/custom-loaders.md` |
| Plugin contract | `docs/plugin-design.md` |
| Pitfall archaeology (dev deadlock, re-walk storm, build OOM) | `docs/spike-notes.md` |
| Decisions & research | `docs/background.md`, `docs/research/` |
| Strapi loader / collection modules design | `docs/strapi-loader-design.md` |

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

markopress: a content framework built on Marko 6 + `@marko/run` (VitePress/Astro-shaped — `.md` files are pages). Currently in **Phase 1 (content layer), in progress: markdown is wired into the content layer and single-file incremental sync has landed**. Technical decisions (D1–D6) are finalized in `docs/background.md` — do not reopen them; the five research reports live in `docs/research/` (when they disagree with reality, the installed source in `node_modules/@marko/run` is authoritative; `rspack-watcher.md` is the basis for the markopack/Rspack migration evaluation).

The repo is a pnpm workspace: **`packages/engine` (= npm package `markopress`: engine CLI + content layer `src/content/` (contract copied wholesale from Astro Content Layer; red line = directory-level audit tests lock down the import surface) + markdown renderer `src/markdown/` + built-in rss/sitemap/search in `src/builtins/`)**, `packages/theme-base` (the mechanical parts of content styling, shared by both themes), `packages/theme-docs` / `theme-blog` (mutually exclusive themes), and **`packages/site` (dogfood site = scaffold-template form; all scripts go through the `markopress` bin — the dogfood surface is the user surface)**. 2026-10-29 package consolidation: 9 → 6 packages (1 engine + 3 themes + site + …; npm publish surface = markopress + theme-base + theme-docs + theme-blog, four packages; a user's package.json only ever sees markopress + one theme). Layering unchanged (D4: the content-subtree red line is enforced by engine/tests/content/audit.test.ts); the plugin contract unchanged (built-ins and third-party markopress-plugin-* share the same shape). **Before working in engine's content/markdown subtrees, read their AGENTS-content/AGENTS-markdown first**. The root only orchestrates.

## Common commands

```sh
pnpm dev       # Main path = markopack (Rspack) dev; **defaults to the docs site (content/, dogfooding features)**
                #   PORT sets the port; includes dev full-reload (SSE + /__markopack_reload.js injection)
pnpm build     # Docs-site SSG: dist/server/public/ is the self-contained static root (build clears dist automatically)
pnpm dev:perf  # Perf-test mode (.markopress/perf.config.ts = docs + 5000-page fixtures in content-perf/)
pnpm build:perf# Perf SSG; generate fixtures: node scripts/perf-test.mjs 5000
pnpm dev:vite  # Vite comparison path (@marko/run + vite.config.ts + markopress-plugin.ts)
pnpm build:vite# Vite SSG: dist/public/*.html (shares dist/ with the rspack output — clean before comparing)
pnpm preview   # Preview the Rspack output (sirv dist/server/public, /404 fallback); preview:vite previews the Vite output
pnpm gen       # Run the route generator manually (dev/build run it automatically; usually unneeded)
                #   site's public/ = site-source static assets (robots.txt etc.; served by the rspack dev
                #   sirv chain + copied by adapter build — markopack 0.4.0 convention)
```

**Perf is decoupled from the default path**: the default `.markopress/config.ts` has only the docs collection; perf runs `MP_CONTENT_CONFIG=.markopress/perf.config.ts` (dev:perf/build:perf already set it). The two configs' digests differ ⇒ switching triggers a full store rebuild + generated-dir shrink/regrow (write-if-changed + set-difference cleanup, self-healing; switching is a low-frequency operation).

```sh
pnpm --filter markopress test  # Full engine vitest suite: content 63 + markdown 21 + search 12 + images 23 + root-level 25 (route-prefix/user-pages/collection-module)
```

**Dual-path parallel discipline (two command paths on one tree, no git branches)**: content layer/store/`gen-routes.ts`/`content-modules.ts` are shared by both paths — new features land in the shared layer; bundler-specific code is allowed only in `virtual:mp/content/` resolution and the watcher layer (Vite = markopress-plugin.ts, Rspack = rspack-*.ts). Comparison data: `docs/perf-rspack-vs-vite.md`.

Node ≥ 22.18 (native type stripping; workspace packages ship as TS source, no build step), pnpm 12 (esbuild build approval lives in `pnpm-workspace.yaml`'s `allowBuilds` — package.json's `pnpm` field is no longer read). No app-level linter — acceptance is manual browser testing (Playwright MCP) plus `pnpm build`; all tests live in the engine package (86). **Any package containing `.marko` tags (engine / theme-docs / theme-blog) must declare `@marko/runtime-tags` as a devDep** (compiled output imports it; under pnpm's strict layout it won't resolve without the declaration — bitten three times since 2026-10-25: theme-docs first, then engine). **markopack is temporarily a local `link:`** (two deps in `packages/engine/package.json` point at `/home/gp/Enter/markopack/packages/*` via **absolute paths** — pnpm 12 drops a directory level on relative `link:` to @scope packages, leaving the link dangling; the npm version stops at 0.4.0, dev.proxy passes through to local unpublished changes; switch back once markopack ships a version containing proxy). The local workspace `../markopack` is the upstream dev spot: after changing it, run `pnpm build` inside it first (dist emits a single-file index.js); no reinstall needed on the markopress side. **pnpm 12 gotcha**: after lockfile changes, `pnpm run` (dev/build) can hang at "Verifying lockfile against supply-chain policies" — run `node_modules/.bin/markopress dev|build` directly under site/ to bypass.

## Architecture (data flow)

```
.markopress/config.ts: the single user config (VitePress .vitepress/config.ts form) — collections
     (content layer: loader + zod schema; **optional route: { prefix } collection route prefix** —
     decouples physical directory from URL (content/operations/* → /guide/*); the prefix is joined
     onto the entry id inside routeFor/pageFileFor and takes effect across the whole chain
     (filenames/URLs/sidebar/prev-next/urls.json/ctx.urlOf + the three built-ins); a collection's
     index → /<prefix> landing page (trailing index segment folded); entry "404" is banned from
     prefixed collections, fail fast at gen time)
     + theme/themeOptions/markdown/plugins (the pipeline) in one place;
     the assembly layer dispatches per key (the collections subtree gets its own store digest).
     Perf mode = perf.config.ts (pointed to by MP_CONTENT_CONFIG). Changes → resetSynced + full
     rebuild on both watcher paths. marko.json / .markopress/entry.ts are generated by
     writeConventions (users never hand-write them; marko.json's tags-dir →
     .markopress/components — not generated when the directory doesn't exist)
     │
     ▼  engine/src/content.ts (ensureSynced singleton: load store/meta → sync → typegen → plugin registration/notification)
content*/ ──glob loader(markdownEntryType)──▶ .markopress/store/<collection>.json (devalue)
     │
     ▼  engine/src/gen-routes.ts (three-source route table: store.values() projection + thin
        wrappers over app-root pages/ user pages (user-pages.ts) + plugin routes-hook handlers;
        URL collisions across the three sources fail fast at gen time; sidebar.ts is a pure
        function deriving the sidebar tree + flat order (output merged into site.json))
.markopress/ generated-artifacts area (gitignored; the user area = config.ts/components/ in the
  same directory; **app-root pages/ = user custom page sources (components never enter the
  store; custom-pages-design.md)**)
  ├─ routes/_content/+layout.marko   theme shell: wraps only derived content pages — **no layout
  │                              in the routes root** (a root layout wraps everything; a pathless
  │                              group can't isolate the outer level, and user pages must stay
  │                              bare by default, §4.2). Plugin UI slot wiring
  │                              <@search><mp-search/></@search> is generated here, gated by the
  │                              plugin's slots declaration — Marko hard-errors on unknown tags,
  │                              and taglib discovery starts from the package.json nearest the
  │                              template, so only generated files can resolve plugin packages'
  │                              taglibs; placement belongs to the theme (<if=input.search>),
  │                              implementation to the plugin)
  ├─ routes/_content/<name>+page.marko  minimal wrapper: the <mp-page> slot (virtual module +
  │                              page-nav; explicitly imports theme components — taglib discovery
  │                              would collide if multiple themes coexist; see mp-* governance)
  ├─ routes/_pages/<user>+page.marko    thin wrapper for user pages (user-pages.ts): explicitly
  │                              imports the real file from app-root pages/ (.marko→.marko closure,
  │                              hydration semantics unchanged); no shell by default — a shell
  │                              requires explicitly importing the theme Layout inside the page
  │                              (opt-in); forbidden naming `[` dynamic segments / `+` roles /
  │                              `_` pathless / dots in filenames — fail fast at gen time
  ├─ routes/+404.marko         content-driven 404 (root special case: by marko-run convention,
  │                              root directory + no path prefix + +404 suffix = the NotFound
  │                              page; a prefix would parse as a path segment and lose the
  │                              special identity — 404+404.marko was bitten. No root layout ⇒
  │                              the wrapper explicitly wraps the theme Layout).
  │                              dev unknown routes with text/html → rendered as the 404
  │                              response; build lands on 404.html via adapter notFoundPath;
  │                              404 never enters the sidebar/prev-next
  ├─ routes/<seg%2E…>+handler.mjs  plugin-route wrapper (path segments containing `.` must use
  │                              %2E; each HTTP verb exported as its own export const)
  ├─ plugin-data/<name>.js     plugin data modules (setData output; consumed via
  │                              virtual:mp/plugin/<name>)
  ├─ site.json                 site data module (site/style/nav/head/tree/flat; imported as a
  │                              module, rewrites invalidate via the module graph — prev/next
  │                              share this source. Renamed from sidebar.json; the old file is
  │                              self-heal cleaned at generation time)
  ├─ page-nav.js / urls.json   static neighbor helpers (never change) / explicit SSG manifest
     │
     ▼  engine/src/markopress-plugin.ts (the markopress() Vite plugin)
virtual module virtual:mp/content/<collection>/<id> → { data, segments, headings }
  (lazy rendering + in-memory digest cache; transformBody/pageData hooks sit on the render path,
   cached by effective digest — engine/src/content-modules.ts. The render digest carries a
   ::extracted namespace: pluginCtx.render (search and other plugins) caches the raw body under
   the bare digest; without isolation, un-extracted html pollutes module rendering. prev/next
   never enter virtual modules: cross-file data — a per-entry digest cache would go stale after
   reordering — served via site.json (sidebar.json before the rename))
Marko component segments inside md (engine/src/segments.ts): the tag library under
  .markopress/components/ (discovered via the generated marko.json tags-dir) can be used
  directly at md block level as <tag/>. Extract → placeholder comment → post-render splitting
  (html|component) → component segments written to .markopress/vseg/<c>/<id>/<n>.marko → module
  import of virtual:mp/segment/… (rspack NormalModuleReplacementPlugin / vite resolveId — both
  sides resolve to the real file; compilation belongs to the bundler) → mp-page
  <${seg.component}/> dynamic rendering + Marko hydration. **markopack counterpart**: the
  translator's hydrate emission only follows .marko→.marko closures; components relayed through
  .js need MarkoRspackPlugin to add the browser-entry import (clientHydrateImports — must run
  before ?browser-entry, or registration lands after init). Known edge: a component file added
  mid-dev-session needs a restart (taglib process cache); safe inside fenced code blocks.
Asset pipeline v2 (engine/src/images.ts = the leaf pipeline + images-owners.ts = the
  ensureSynced ownership trio, shared app layer, finalized in docs/images-v2-design.md): md
  block-level <mp-image …/> + **md ![]() takeover (config.images.markdown, off by default —
  only standalone paragraphs are taken over, never inline)** + **page-side <mp-image> Marko
  component** (engine tags/, usable from user pages/.markopress/components; `server import` +
  `<await>` with no placeholder = zero client JS) → pre-extract placeholder → sharp variants
  (formats defaults to ["webp"]; adding "avif" yields multi-format <picture>) + blur/color/none
  placeholders + a copy of the original → content-addressed on disk under
  public/_markopress/image/<first 8 hex of source-content sha1>/. **Remote images**
  (authorization surface config.images.domains/remotePatterns, the SSRF line of defense;
  unauthorized = pass-through <img>) fetch through .markopress/cache/images/, an HTTP-semantics
  cache (max-age/24h heuristic freshness + etag/last-modified conditional revalidation +
  stale-on-failure degradation; hard-fail in build, soft degradation in dev = MARKOPRESS_PHASE).
  v2 attribute additions: formats/densities/title/class/placeholder=color.
  **Leaf-layer discipline (bitten)**: server imports in tags/*.marko may only point at leaf
  modules — the ensureSynced edge would drag the content-layer/CLI cluster into the server
  bundle (cli.ts TLA + markopack sirv resolution all blow up); settings travel via
  .markopress/images-settings.json (written at setup, read through an mtime cache during
  rendering); sharp is externalized on the rspack server side via externals with absolute paths
  (vite SSR externalizes by default — nothing to do). Assets never enter the store or the core
  package (content AGENTS.md red line); the asset digest folds into the entry's effective
  digest (render/transform/pageData caches all cascade); watcher asset events → assetOwners
  (recursive over the entry's directory subtree — deeply nested side dirs like img/ cascade
  too, blockers #7) → re-render the owning entry. v1 attribute surface:
  src/alt/layout/width|height/quality/sizes/placeholder/fetchpriority (per-tag quality goes
  into the variant filename to prevent clobbering). Remaining gate (not done): the frontmatter
  `image()` helper. Resolution cache keys must include the source-content digest — if the same
  path with new bytes doesn't fold the key, vcontent stays byte-identical and the invalidation
  chain breaks (bitten).
  **mp-* namespace governance (validateNamespace at assembly time, fail fast)**: ① theme
  components are explicitly imported (the generator writes imports via resolveTheme package
  paths — global taglib discovery collides when multiple themes coexist; theme-blog once
  shadowed theme-docs, bitten); ② plugin slots must be mp-* and unique (pre-existing rule);
  ③ plugin slots must not share a name with the ACTIVE theme's tags; ④ the user component
  directory bans the mp-* prefix (would collide with plugin tags + shadow the pipeline's
  <mp-image>). Plugin feature slots (mp-search) still ride taglib discovery (nearest the app
  root; unique names guaranteed by this governance).
packages/theme-docs / theme-blog: theme packages (mutually exclusive via the same slot
  contract; theme-blog dispatches post/home/list/page by frontmatter layout, with the flat
  order passed in by the generator — themes must never import site.json themselves; resolving
  app files from another package is the taglib trap all over again). Mechanical content styles
  (mp-image/containers/shiki switching) are shared in theme-base (<mp-content-styles/>, rendered
  once per theme); themeOptions.nav/titleTemplate/sidebar.sortBy pass through via site.json/the
  generator. Site-level head injection (GA/Clarity/fonts/verification meta): top-level config
  `head: [{tag, attrs?, content?}]` (a site concern, not themeOptions — analytics survive a
  theme switch) → site.json.head → the generator passes it to mp-layout → the theme's <head>
  renders <mp-head-entries/> (theme-base, bare HTML construction — inline scripts must land
  literally in the first frame; going through Marko compilation pushes them into the bundle,
  deferred). Custom CSS = a public/ file + a head link entry; note markopack injects theme CSS
  at the end of head, so site CSS needs a specificity boost (an html prefix) to reliably win.
  Per-page <title> = postbuild HTML patching (engine/src/patch-titles.ts; marko-run has no head
  channel; rspack finalizes it in rspack-build.ts, vite in the build:vite chained script —
  adapter crawling runs after every Vite hook; dev showing the site name = known boundary).
  Dark mode = data-theme attribute + an <html-script> inline pre-paint script; contract details
  in each package's AGENTS.md
vite.config.ts: markopressPlugin() wraps markoRun({ routesDir, adapter: staticAdapter() })
  (no urls passed — the adapter auto-crawls parameterless routes; an explicit manifest makes
  every page crawled twice; see hard constraint 3)
```

- **Invalidation path (where the deadlock discipline lands)**: md edit → `syncer.syncFile` (O(1): reads only the event file, located via the fileToId map built at load) → invalidates only that entry's virtual module (Vite module graph) → full-reload; zero writes to the routes directory. Only slug add/remove produce a single `+page.marko` file event, which the marko-run dev watcher re-walks — "regenerate × re-walk" is the core mechanism (`docs/spike-notes.md`). Config file changes (.markopress/config.ts; on the rspack side the .markopress directory is watched non-recursively) → resetSynced full rebuild. Plugin `contentSynced(changed)` is enqueued in the background at batch end (a process-level single-flight chain); plugin-data writes invalidate via the module graph / native watcher, likewise never touching the routes directory.
- **User custom page invalidation path (custom-pages §4.1)**: editing `pages/*.marko` content → direct module-graph link (the wrapper imports the real file; Rspack native watcher / Vite module graph invalidation, **zero events in the routes directory**); add/delete/rename → at batch end generateRoutes writes/deletes the single `_pages/` wrapper → markopack watchRoutes does an in-process incremental re-walk. pages/ events are routed apart in both watchers (isUserPageFile), never going through syncFile/assetOwners; pure-user-page batches skip plugin increments.
- The watcher listens to `watchDirs` declared by every collection's loader (multiple collections with multiple base dirs — all covered).
- **Rspack twin path** (`engine/src/rspack-*.ts`): same sync/gen prelude; virtual modules instead land on disk in `.markopress/vcontent/` (`NormalModuleReplacementPlugin` rewrites `virtual:mp/content/`); invalidation goes through Rspack's native watcher; slug add/remove are re-walked by markopack's built-in watchRoutes (in-process incremental, no marko-run-style full re-walk storm). The single source of module code is `engine/src/content-modules.ts` (shared by both backends).
- Known boundaries: store flush rewrites the whole collection JSON (write amplification; chunked persistence from deltas #3 is the upgrade path); if dev startup adds thousands of route files, the marko-run watcher re-walk storm stalls the first request for ~1min (a route-scale problem, unrelated to content increments).
- Layouts are marko-run's build-time fusion (`<Layout><Page/></Layout>` nested into a single entry template); the layout renders the page via `<${input.content}/>`.

## Hard constraints (lessons from real bites — read before touching the generator/templates)

1. **The generated `_content/+layout.marko` must stay static**: site data like nav goes through `site.json` (module import); never mutate the layout file at runtime. "New page + layout modification in the same watcher batch" triggers a race-condition deadlock in the marko-run 0.11.13 dev server (all requests hang forever); see `docs/spike-notes.md`. Tree constraint (custom-pages §4.2): **no layout in the routes root** — a root layout wraps everything including `_pages/`, leaving nowhere for user pages to stay bare by default; the theme shell lives only under `_content/`, and 404 explicitly wraps Layout inside its wrapper.
2. **Interpolation like `$!{html}` must never sit on a bare line at template top level**: concise mode parses it as a custom tag; it must be wrapped in explicit open/close tags (e.g. `<article>…</article>`).
3. **The static adapter is passed no `urls`**: the adapter already crawls all parameterless routes in the route table; an explicit manifest makes every page crawled twice (concurrency ×2, OOM on large sites — see spike-notes "build OOM"). `urls.json` generation is kept (for a future explicit manifest for parameterized routes); if it must be passed someday, `staticAdapter({ urls })` accepts only an async function — the factory is invoked eagerly when vite.config is evaluated, so passing an array would evaluate before the generator runs (spike pitfall record).
4. `/home/gp/Enter/marko` (the marko monorepo) is a **read-only reference**: syntax in `packages/runtime-tags/cheatsheet.md`, resume mechanics in `RESUMABILITY.md`. Never modify it.
5. `@marko/run` is pre-1.0 (0.11.x); the API will move. This repo pins `^0.11.13`.
6. **Commit messages are English-only.** Subject and body follow the repo's conventional-commit style (`feat(scope): …` / `fix` / `docs` / `chore`, matching `git log`) entirely in English — Chinese has crept into subjects twice before; do not let it happen again. Applies to every commit type, docs/chore included. Docs files and code comments in Chinese are fine; commit messages are not.

## Marko 6 syntax cheat sheet (forms used in this repo)

State `<let/count=0>` (updates are plain assignments, `count++`); events `onClick() { … }`; loops `<for|item| of=nav>`; dynamic tag / layout body `<${input.content}/>`; raw HTML `$!{html}` (fragment must be balanced); module-level constants `static const`; **per-render constants at template level use the `<const/x=…>` tag** (a bare `const x = …` parses as a `<const>` tag and errors, unless prefixed `static`); inside `.marko` you can `import nav from "../nav.json"` (goes through the bundling pipeline); **an inline `<script>` is compiled into the browser bundle (deferred execution)** — for literal inline HTML (e.g. pre-paint anti-flash scripts) you must use `<html-script>`.

## Generated directories & git

`.markopress/` semantics have flipped: **user directory** (config.ts/perf.config.ts/components/, git-tracked) + generated subdirectories (store/routes/vcontent/vmeta/vseg/vcollection/plugin-data/site.json/page-nav.js/urls.json/content.d.ts/entry.ts, selectively gitignored — `*` exclude + explicit re-includes). **vmeta = per-entry metadata (data/headings, client-safe); collection modules `virtual:mp/collection/<name>` aggregate only vmeta — html bodies (segments) live only in the vcontent SSR render chain; aggregating them into collection modules bakes the whole collection's bodies into a shared browser chunk (pdflux 585.js feedback; pure dead weight under resumability)**. **Clearing the cache = delete the generated subdirectories; never `rm -rf .markopress`** (it would wipe user config). `.marko-run/`, `dist/`, `packages/site/marko.json` (generated) remain gitignored; **app-root `pages/` = user custom page sources (git-tracked; dogfood example at packages/site/pages/showcase.marko)**. Engine side: `packages/engine/src/gen-routes.ts` is the route generator (three sources: store projection + pages/ user pages + plugin handlers); `user-pages.ts` handles user-page thin wrappers/collisions/stale-mirror cleanup; `markopress-plugin.ts` is the Vite plugin proper; `content.ts` is the content-layer assembly singleton; files are compared before writing (write-if-changed) to avoid pointless watcher churn. `content-perf/` holds perf-test fixtures (generated via `node scripts/perf-test.mjs [N]`).

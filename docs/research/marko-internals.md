# 调研：Marko 仓库底层能力

> 调研日期：2026-10-14 · 方法：只读探索本地仓库 `/home/gp/Enter/marko`（marko monorepo，pnpm workspace）。
> 目的：盘点构建内容框架（VitePress/WordPress/Astro 形态）可依赖的公开能力与不可依赖的内部件。

Repo: marko monorepo (pnpm workspace, Node >= 22.18, changesets releases on push to main). Root `CLAUDE.md` confirms: "Primary development happens in `packages/runtime-tags`"; Marko 6 = runtime-tags version while `@marko/compiler` stays 5.x.

## 1. Repo layout

Only three packages (no other packages/ entries):

| Package | npm name / version | One-liner |
|---|---|---|
| `packages/compiler` | `@marko/compiler` **5.42.11** | Translator-agnostic `.marko` → Babel AST → JS compiler (parse, migrate/transform passes, taglib registry); hands codegen to a "translator". |
| `packages/runtime-tags` | `@marko/runtime-tags` **6.4.5** — also published as **`marko@6` (`latest` dist-tag)** via `scripts/publish-alias.mts` | Marko 6: fine-grained DOM runtime, streaming SSR runtime, AND its Babel translator (`src/translator/`). |
| `packages/runtime-class` | `marko` **5.39.46** (private in-repo; published as `marko` under **`m5`** dist-tag) | Marko 5 class-API runtime (vdom/morphdom) + translator, in maintenance; its translator wraps runtime-tags' interop layer so Marko 5 apps can embed Marko 6 components. |

Key docs read:
- `packages/runtime-tags/CONTEXT.md` — canonical glossary (Section, Binding, Signal, Scope, Resume, Walk string, Resume comment, Output mode...). States the core model: "Marko 6 compiles `.marko` templates into one dependency graph, then lowers it to streaming HTML and resume state or fine-grained DOM code."
- `packages/runtime-tags/AGENTS.md` — translator phase contract (parse → migrate → transform → pre-analyze → analyze → translate), runtime conventions (`_name` exports are "public to codegen, not to app authors"; `MARKO_DEBUG` gating; `.feat.ts` tree-shakable feature modules; size idioms).
- `packages/compiler/AGENTS.md` — compiler map + translator contract (see §2).
- `packages/runtime-class/AGENTS.md` — Marko 5 layering (html/SSR, vdom/CSR, translator), `___name` mangling, maintenance status.
- `packages/runtime-tags/RESUMABILITY.md` — the end-to-end resume architecture guide (best single doc for question 4).
- Also useful: `CONTEXT-MAP.md` (root), `packages/runtime-tags/cheatsheet.md` (235-line Marko 6 syntax reference shipped in the published package and surfaced to coding agents on compile errors).

## 2. Compiler public API (`@marko/compiler`)

Entry: `packages/compiler/src/index.js`, types at `packages/compiler/index.d.ts`.

- **Compile**: `compile(src, filename, config?)`, `compileSync`, `compileFile`, `compileFileSync` → `CompileResult { ast, code, map, meta: MarkoMeta }`. `MarkoMeta` (index.d.ts:24) = `{ id, component?, watchFiles, tags?, deps, analyzedTags?, diagnostics, api }` — `file.metadata.marko` is explicitly public compiler output (per compiler AGENTS.md).
- **Config**: `configure(config)`, `globalConfig` (re-exported from `src/config.js`). Key options: `output` (`"html" | "dom" | "source" | "migrate" | "hydrate"`), `entry` (page/load), `translator`, `modules` (esm/cjs), `optimize`, `optimizeKnownTemplates`, `sourceMaps`, `stripTypes`, `errorRecovery`, `cache` (Map), `fileSystem` (pluggable FS — "eg webpacks CachedInputFileSystem"), `hot`, `linkAssets` (bundler hook for "browser asset resolution and runtime hooks for lazy loading and server entries" — the integration point @marko/vite uses), `hydrateIncludeImports` (regex of client-asset extensions), `resolveVirtualDependency`, `runtimeId`, `applyFixes`, `babelConfig`. `output: "source"/"migrate"` re-prints Marko source — a codemod/migration tool API for framework authors.
- **taglib API** (`src/taglib/index.js`, typed in index.d.ts:89): `taglib.register(id[, props])`, `taglib.buildLookup(dirname, translator?, onError?)` → `TaglibLookup`, `taglib.resolveOptionalTaglibs`, `excludeDir`, `excludePackage`, `clearCaches`.
- **Other exports**: `types` (patched Babel types incl. `MarkoTag`, `MarkoAttribute`), `getRuntimeEntryFiles(output, translator?)`, `getRuntimeVersion`, `version`.
- **Subpath exports**: `@marko/compiler/babel-utils` (the helper API for tag/translator authors: `assertNoArgs`, `diagnosticError/Warn/Deprecate/Suggest`, `importNamed/importDefault`, `parseExpression/parseParams/...`, `getTagDef`, `isNativeTag`, `resolveTagImport`, `loadFileForTag`, `getTemplateId`, `registerMacro`, `defineTag`, ...) — `packages/compiler/src/babel-utils/index.js`; `@marko/compiler/config`; `@marko/compiler/register` (Node require hook, `src/register.cjs`); `@marko/compiler/internal/babel` (the single controlled Babel entry — all Babel access must go through it); `@marko/compiler/modules`.

**Translator plug-in contract** (compiler AGENTS.md + `src/util/try-load-translator.js`): a translator module exports `translate` (required visitor), `taglibs` (required `[[id, props]]`), optional `transform`/`analyze` visitors, `tagDiscoveryDirs`, `optionalTaglibs`, `preferAPI` (`"tags"|"class"`), `getRuntimeEntryFiles(output, optimize)`, `version`, `cheatsheet`. It is resolved from `config.translator` or **auto-detected from the app's package.json deps** matching `/^(?:@marko\/|marko-)runtime-/` (`src/config.js:75`); default fallback is `marko/translator`. Pipeline lives in `src/babel-plugin/index.js`: parse → migrate → transform → analyze (cached per template, reused across outputs) → translate on a clone; taglib visitors run in migrate/transform/translate; `analyze` is translator-only (a taglib-level `analyze` prop is a hard load error; taglib `analyzer` is reserved for editor tooling).

**Custom tag discovery** (`src/taglib/finder/index.js`, `src/taglib/loader/*`):
1. Built-in HTML/SVG/MathML JSON taglibs (`src/taglib/marko-html.json`, `marko-svg.json`, `marko-mathml.json`).
2. Walk up from the template dir for `marko.json` and for the translator's `tagDiscoveryDirs` (Marko 6: `["tags"]`, set in `src/translator/index.ts:45`); a `marko.json` `tags-dir` overrides.
3. Every dependency of the root package (deps/peer/dev) is probed for `<name>/marko.json` (node_modules discovery).
4. Programmatic `taglib.register(id, props)`; `taglib-imports` chains taglibs.

Per-tag `marko-tag.json` / `marko.json` `"tags"` entries support (schema in `packages/compiler/babel-utils.d.ts:31` `TagDefinition` / :116 `Tag`): `template` (a `.marko` file), `renderer`/`code`, `types`, `attributes` (+`pattern-attributes`, `attribute-groups`), `nested-tags`, `deprecated`, `open-tag-only`, and compile-time hooks `parse`, `migrate`, `transform` (a.k.a. `transformer`), `translate`, plus `parseOptions` (e.g. `text`, `statement`, `controlFlow`, `rootOnly`). Working example fixture: `packages/runtime-tags/src/__tests__/fixtures/custom-tag-child-analyze/tags/hello/{marko-tag.json,index.marko,transformer.ts}` (a transformer that reads sibling tag files and rewrites the AST — exactly the hook a markdown-to-marko tag would use).

## 3. Server rendering (Marko 6, `packages/runtime-tags`)

There is **no `createOut`/`Stream` class in Marko 6** — those are Marko 5 (`packages/runtime-class/src/runtime/createOut.js`, `src/runtime/html/AsyncStream.js`, `BufferedWriter.js`, `StringWriter.js`). Marko 6's SSR writer is a different architecture:

- **Template API** (`src/html/template.ts`): `_template(templateId, renderer, page?)` attaches `.render(input)`. `render` returns a `RenderedTemplate` (public type in `packages/runtime-tags/index.d.ts`): `Promise<string> & AsyncIterable<string>` with **`.pipe(nodeWritable)`** (writes + flushes per chunk), **`.toReadable()`** (Web `ReadableStream<Uint8Array>`, lazy until first pull — drop-in for `Response`), **`.toString()`** (sync-only renders). `$global` carries `signal` (AbortSignal that stops streamed content), `cspNonce`, `renderId`, `runtimeId`, `serializedGlobals`.
- **Streaming internals** (`src/html/writer.ts`, 1000+ lines): `Chunk` (node in the writer's tree of buffered output), `Boundary` (per-render coordinator: tracks async work, flushes, aborts), `State`, `FlushStatus` (`src/html/constants/flush-status.ts`), `withContext` (per-chunk context), `_id`/`_scope_id` id allocation. Flushing: `ServerRendered.#read()` (template.ts:340) pumps `boundary.flush()` → `head.consume(boundary)` → `head.flushHTML(boundary)` → `onWrite(html)`, with microtask `queueTick` batching and re-entrancy guards; `pipe` calls `stream.flush?.()` after each chunk so compression transforms stream.
- **Compiled server output** imports helpers from `@marko/runtime-tags/html` (dev: `/debug` variants; module name from `src/translator/util/runtime-info.ts` + `runtime.ts:154`). Example (`fixtures/title-counter/__snapshots__/html.bundle.js`): `_template("a", (input) => { _scope_reason(); const $scope0_id = _scope_id(); ... _html(...); _script($scope0_id, "a0"); _scope($scope0_id, { d: count }); }, 1)`. Export surface in `src/html.ts`: `_attr*`, `_escape*`, control flow (`_if`, `_for_of`, `_await`, `_try`), `_template`, and writer functions (`_scope`, `_resume`, `_script`, `_write_guard`, `_flush_head`, ...). All `_name` exports are for generated code, not app authors.
- **Async/streaming tags**: `<await|result|=promise>` core tag (`src/translator/core/await.ts`) — in-order content (holds the stream) vs reorder behind `<try>` + `<@placeholder>`/`<@catch|err|>` attribute tags; error boundaries via `<try>`. Asset placement for site frameworks: `src/html/assets.ts` (`withPageAssets`, `withLoadAssets`, `_flush_head`) + entry modes (`page`/`load`, `entry` config; `src/translator/util/entry-builder.ts`) give head-flushing of styles/scripts and lazy-chunk wiring.

## 4. Resumability (no hydration)

Architecture doc: `packages/runtime-tags/RESUMABILITY.md`. Mechanism, verified in `fixtures/title-counter/__snapshots__/writes.html`:

- SSR HTML contains **resume comments** (`<!--M_$1 a-->`) associating DOM nodes/ranges with scopes, and a trailing inline `<script>`: `WALKER_RUNTIME("M")("_"); M._.r = [_ => [1, { d: 0 }], "a0 1 a1 1"]; M._.w()` — the **resume payload**: serialized scope flushes + registrations of executable ids (the serializer emits JavaScript expressions, not JSON — preserves identity/cycles/typed values; `src/html/serializer.ts`).
- The client "resumes": applies scope flushes, adopts server-rendered nodes (walk strings in `src/dom/walker.ts`; adoption in `src/dom/resume.ts`), rebuilds branches, runs effects with `isResuming = 1` — **no initial client rerender, no vdom, no hydration diff** (CONTEXT.md: Resume — "Avoid: hydrate, hydration, replay").
- **Cost model**: fine-grained signals. Only state/effect/handler bindings that analysis proves the client can read after resume are serialized ("reasons" → "write reasons"; `translator/util/reasons.ts`, `solve-reasons.ts`, `write-guard.ts`, `slots.ts`). Client code (`dom.bundle.js` snapshot) is small `/*@__PURE__*/` constructors (`_let`, `_script`, `_on`, `_text_content`) that tree-shake per-feature; runtime features are `.feat.ts` side-effect modules (`src/dom/catch.feat.ts`, `controllable*.feat.ts`, `lazy.feat.ts`...) that fold out entirely when unused. SSR registers code by stable `_resume` id instead of serializing source. Bundle size is tracked as a feature (`.sizes.json`, `pnpm run build:sizes`, pre-commit hook).

## 5. Extensions

- **Custom translators**: first-class. The translator contract above is the whole plug-in surface; `marko/translator` (runtime-class) and `@marko/runtime-tags/translator` are themselves just translators, and `createInteropTranslator` (`src/translator/interop/`, re-exported from `src/translator/index.ts:71`) shows how to wrap one translator in another.
- **Custom tags**: via `marko.json`/`marko-tag.json` with `parse`/`migrate`/`transform`/`translate` hooks (schema in `packages/compiler/babel-utils.d.ts` `Tag`), or the `tags/` directory convention. Unrecognized tags resolve as native HTML unless a taglib defines them.
- **Macro mechanism**: Marko 5 has `<macro>` (`packages/runtime-class/src/translator/taglib/core/macro/translate.js`) with compiler support via `registerMacro`/`hasMacro`/`isMacroTag` (`packages/compiler/src/babel-utils/tags.js:55-125`). **Marko 6 drops `<macro>`**; the equivalents are `<define>` (reusable content renderer, `src/translator/core/define.ts`) and tag variables (`<let/count=0>`). Marko 6 core tags (registry `src/translator/core/index.ts`): `attrs, await, class (compat), client, const, debug, define, effect, else/else-if/if, export, for, html-comment, html-script, html-style, id, import, let, lifecycle, log, return, script, server, show, static, style, try`. Core tags are one-file-per-tag and the AGENTS.md documents adding new ones — i.e., the core tag set is extensible in-repo, and userland tags get the same hook API.
- **HMR**: compiler config `hot: true` ("bring in the hot module replacement runtime", `src/config.js:172`) is consumed **only by the Marko 5 translator** (`packages/runtime-class/src/translator/index.js:450,680,700`; runtimes `src/runtime/html/hot-reload.js`, `src/runtime/vdom/hot-reload.js`; server-side reload via `src/node-require/hot-reload.js` + browser-refresh). **Marko 6 has no HMR runtime in this repo** (no `hot`/`import.meta.hot` references in `src/translator` or `src/dom|html`) — dev-mode HMR for Marko 6 lives in the external `@marko/vite` plugin, which drives the compiler API.
- `<await>` + `<try>`/`@placeholder`/`@catch` are the extensible async core tags (see §3).

## 6. Markdown / docs handling

**No markdown compilation pipeline exists anywhere in the repo** (searched all three packages for markdown/`.md` handling in src — nothing). What exists:

- `packages/runtime-class/docs/*.md` (~35 files: syntax.md, core-tags.md, custom-tags.md, marko-json.md, rendering.md, vite.md, express.md/fastify.md/koa.md, troubleshooting-streaming.md...) — static Marko 5 docs shipped in the npm package (`files` array); content, not code.
- `packages/runtime-tags/cheatsheet.md` — Marko 6 LLM/agent syntax reference shipped in the package (`exports["./cheatsheet.md"]`); `packages/compiler/src/util/agent-fix-guide.js` appends "Fix guide: READ <cheatsheet> before writing a fix" to compile errors when a terminal coding agent is detected (`AI_AGENT=1` generic opt-in, `MARKO_AGENT_FIX_GUIDE` override).
- Implication for a framework author: markdown support must be built by you — the natural hook is a custom tag (e.g. `<markdown>`/content tag) with a `transformer` in a `marko-tag.json` that converts md to Marko AST/text at compile time, or compiling md → `.marko`/HTML strings before invoking `compile()`.

## 7. Maturity signals

- Versions: `@marko/compiler` **5.42.11** (mature, long-lived 5.x line; deliberately stays 5.x — "language changes belong in the translators"); `@marko/runtime-tags` **6.4.5** — marko 6 is **published and on `latest`**, not pre-release: `scripts/publish-alias.mts` re-publishes runtime-tags as `marko` with dist-tag `latest` (and runtime-class as `marko` under `m5`). Active patch cadence (CHANGELOG.md shows frequent 6.4.x patches; `.changeset/` has pending entries).
- Dependency graph: runtime-tags → `@marko/compiler ^5.42.11`; runtime-class (marko 5) → `@marko/compiler ^5.42.8` + `@marko/runtime-tags ^6.4.5` (interop). All engines node >= 22. Compiler is bundled to `dist/` at publish via `exports:override`; runtime-tags ships TS source-mapped src until publish.
- Ecosystem integration points outside this repo (referenced in code/config): `@marko/vite` (bundling, HMR, style import handling — CONTEXT.md notes "`@marko/vite` keeps them" for style module paths), `@marko/language-tools` (editor; owns taglib `analyzer`/`types` fields), `@marko/translator-interop-class-tags`.

## Public vs internal — what a framework author can build on

**Build on (public/stable)**
- `@marko/compiler`: `compile[Sync]/compileFile[Sync]`, `configure`, full `Config` (notably `output`, `entry`, `translator`, `modules`, `optimize`, `fileSystem`, `cache`, `linkAssets`, `resolveVirtualDependency`, `hydrateIncludeImports`, `errorRecovery`, `source`/`migrate` codemod modes), `taglib.register/buildLookup`, `CompileResult.meta` (`watchFiles`, `deps`, `tags`, `diagnostics` — enough to drive a bundler plugin), `@marko/compiler/babel-utils` + `defineTag` for writing custom tags/transformers, `@marko/compiler/register` for Node SSR.
- Taglib JSON schema (`marko.json`/`marko-tag.json`) with per-tag `parse`/`migrate`/`transform`/`translate` hooks and node_modules auto-discovery — the WordPress-"shortcode"/Astro-"component library" distribution mechanism.
- `@marko/runtime-tags` (=`marko@6`) template API: `template.render(input)` → promise/async-iterable/`pipe`/`toReadable`, `template.mount`, `$global` (`signal`, `cspNonce`, `serializedGlobals`); core tags (`if/for/await/try/let/const/effect/lifecycle/script/style/server/client/define/...`); `tags/*.d.marko` type stubs; entry modes (`page`, `load`) + asset flushing (`_flush_head`, `withPageAssets`) for head management and code splitting.
- The translator contract itself, if you want a different output target.

**Internal — do not build on**
- `packages/runtime-tags/src/translator/util/*` analysis machinery (sections, bindings, references, signals, reasons, write-guard), `src/html/writer.ts` Chunk/Boundary/State, `src/html/serializer.ts` wire format, `src/dom/queue.ts` scheduling, accessor `.debug.ts` constant pairs, `.feat.ts` modules — all explicitly codegen-facing or optimization-internal (`_name` exports are "public to codegen, not to app authors").
- Marko 5 (`runtime-class`) internals (`___`-prefixed APIs, vdom/morphdom) — maintenance mode.
- HMR runtime (Marko 5 only, in-repo); Marko 6 HMR belongs to `@marko/vite`.

**Gaps you'd fill yourself**: markdown compilation, routing, data loading conventions, bundler plugin glue (model: `@marko/vite` using `linkAssets`/`resolveVirtualDependency`/`getRuntimeEntryFiles`), and dev-server HMR for Marko 6 output.

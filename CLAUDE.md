# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MarkoPress is a **static site generator** built on Marko.js v6, designed as a drop-in alternative to VitePress and Docusaurus. It uses **@marko/run** as the build tool and is organized as a **pnpm workspace monorepo**.

## Commands

```bash
# Website (docs/demo site) - run from repo root
pnpm docs:dev          # Dev server on localhost:4173
pnpm docs:build        # Production build
pnpm docs:preview      # Preview production build

# Core package - run from packages/markopress/
pnpm build             # TypeScript compile + terser minify → dist/
pnpm dev               # TypeScript watch mode
pnpm typecheck         # Type checking only (tsc --noEmit)
pnpm test              # Run all tests (vitest run)
pnpm test:watch        # Watch mode
pnpm test -- src/build/index.test.ts  # Run a single test file

# Release
node scripts/release.js                # From repo root
node packages/markopress/scripts/release.js  # Package-level release

# CLI (global usage)
markopress dev [-p 4173]   # Start dev server
markopress build           # Build for production
markopress preview         # Preview build
markopress init [dir]      # Scaffold new site
```

## Marko.js 6 Reference

Complete Marko.js 6 documentation is in `docs/marko6/`. **Read these files when working with Marko components:**

| File | Covers |
|------|--------|
| `language-reference.md` | Template variables (`input`, `$global`, `$signal`), attributes, dynamic tags |
| `custom-tags.md` | Component discovery, tag resolution, file structure |
| `reactivity.md` | Compile-time reactivity, state management, update scheduling |
| `core-tags.md` | Control flow (`<if>`, `<for>`), state (`<let>`, `<const>`), lifecycle |
| `native-tags.md` | Event handlers, change handlers, two-way binding (`:=`) |
| `typescript.md` | Input typing, generic components |
| `template-api.md` | Server-side `render()`, client-side `mount()`, `$global` |
| `styling.md` | CSS Modules (`<style/styles>`), preprocessors |
| `concise-syntax.md` | **NEVER USE** — syntax to avoid |
| `marko5-interop.md` | **NEVER USE** — Marko 5 syntax to avoid |

### Critical Patterns

**Attribute Binding:** Dynamic values must be unquoted: `<meta content=$global.description>` (not `content="${$global.description}"`)

**Layout Rendering:** Use `<${input.content}/>` for @marko/run layouts. Do NOT use `<${input.renderBody}/>` — that's for component composition only.

**State:** `<let/count=0>` (mutable), `<const/doubled=count*2>` (derived), `<input value:=message>` (two-way binding)

**Events:** Method shorthand: `<button onClick() { alert("clicked") }>`

**Always:** HTML mode with angle brackets, Tags API syntax (Marko 6)
**Never:** Concise syntax, Marko 5 Class API

## Architecture

### Monorepo Structure

```
packages/
└── markopress/              # Core framework (all functionality in one package)
website/
└── .markopress/             # Official website workspace package (@markopress/website)
```

The `pnpm-workspace.yaml` defines `packages/*` and `website/.markopress` as workspace members.

### Core Package (`packages/markopress/`)

| Directory | Purpose |
|-----------|---------|
| `src/cli/` | CLI commands: dev, build, preview, init |
| `src/build/` | Content scanning → route generation → @marko/run delegation |
| `src/config/` | Config loading from `.markopress/config.{ts,js,mjs}` |
| `src/markdown/` | markdown-it pipeline with Shiki highlighting |
| `src/plugin/` | Hooks-based plugin API (see `src/plugin/types.ts`) |
| `src/plugins/` | Built-in plugins (SEO, analytics, RSS) |
| `src/theme/` | Default theme + slot-based override system |
| `src/content/` | Content scanning and processing |
| `src/routes/` | Route generation logic |
| `src/search/` | Search indexing (minisearch) |
| `src/image/` | Image optimization (sharp) |

Package exports multiple entry points: `markopress/build`, `markopress/config`, `markopress/markdown`, `markopress/plugin`, `markopress/theme`, `markopress/search`, `markopress/vite`.

### Build Pipeline

1. Scan content directories → process markdown with frontmatter
2. Generate `+page.marko` and `+handler.js` route files in user's `src/routes/`
3. Generate root `+layout.marko` for HTML wrapper
4. Delegate to `@marko/run` for final build

Route files are **generated, not hand-authored**. Content changes require rebuilding routes.

### @marko/run Route Conventions

| File | Purpose |
|------|---------|
| `+page.marko` | Route template, renders HTML for GET |
| `+layout.marko` | Wraps nested pages with `<${input.content}/>` |
| `+handler.js` | HTTP handlers; set `context.*` props, return `undefined` for `next()` |
| `+middleware.js` | Pre-handler middleware for all methods |

Templates access handler context via `$global.*`.

## Testing

**Framework:** Vitest — config at `packages/markopress/vitest.config.ts`
- Test files: `src/**/*.test.ts` (300+ test files)
- Coverage: v8 provider, covers `src/**/*.ts`

```bash
cd packages/markopress
pnpm test                           # Run all
pnpm test -- path/to/file.test.ts   # Single file
pnpm test:watch                     # Watch mode
```

## Conventions

- **Marko file naming:** Husky pre-commit hook enforces kebab-case for `.marko` files (e.g., `my-component.marko`, never `MyComponent.marko`)
- **Workspace linking:** Use `workspace:*` protocol for cross-package dependencies
- **TypeScript:** ESNext target, strict mode, Node16 module resolution
- **User config location:** `src/.markopress/config.{ts,js,mjs}`
- **Generated routes:** `src/routes/` is auto-generated — do not edit manually

## Additional Documentation

For content organization, configuration schema, frontmatter fields, theming, SEO plugin options, and deployment — see `README.md` and `docs/`.

Release process: `scripts/release.js` handles version bumps, git tagging (`<package>-v<version>`), changelog, and GitHub releases. CI: `.github/workflows/deploy.yml` (GitHub Pages), `release.yml` (auto release from tags).

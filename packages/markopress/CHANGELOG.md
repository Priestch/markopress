# Changelog

## [0.0.21] - 2026-05-17

### 🐛 Bug Fixes

- init highlighter with theme before preloading languages ([9aa3238](https://github.com/Priestch/markopress/commit/9aa3238))

### 🔧 Chores

- update changelog ([0c62667](https://github.com/Priestch/markopress/commit/0c62667))


## [0.0.21] - 2026-05-17

### 🐛 Bug Fixes

- init highlighter with theme before preloading languages ([9aa3238](https://github.com/Priestch/markopress/commit/9aa3238))

- fix custom theme ignored when preloadLanguages runs before getMarkdownIt ([9aa3238](https://github.com/Priestch/markopress/commit/9aa3238))

## [0.0.20] - 2026-05-17

### ✨ Features

- configurable syntax highlighting themes and fix line highlighting ([0987bc1](https://github.com/Priestch/markopress/commit/0987bc1))
- preload syntax highlighting languages at build/dev startup ([a01b355](https://github.com/Priestch/markopress/commit/a01b355))

### ♻️ Refactoring

- extract preloadContentLanguages, pass theme to dev renderer ([0edfac4](https://github.com/Priestch/markopress/commit/0edfac4))

### 📝 Documentation

- add changelog for unreleased syntax highlighting changes ([b733f9f](https://github.com/Priestch/markopress/commit/b733f9f))


## [Unreleased]

### ✨ Features

- configurable syntax highlighting themes via `markdown.theme` (defaults to vitesse-light/vitesse-dark)
- configurable language preloading via `markdown.languages` config field
- pass `markdown.theme` and `markdown.languages` to dev server renderer

### 🐛 Bug Fixes

- fix line highlighting (`{1,3}` syntax): override fence renderer to reconstruct meta from `token.attrs` since `markdown-it-attrs` strips `{...}` from info string
- fix `enhanceHastWithLineFeatures` to work with Shiki 1.x native `<span class="line">` structure
- fix `findElement` rejecting `Root` nodes in HAST tree
- use `class` property instead of `className` in HAST to match Shiki's output format

### 📦 Refactor

- extract `preloadContentLanguages()` to deduplicate language scanning between build and dev pipelines

## [0.0.19] - 2026-05-11

### ✨ Features

- add content registry for cross-section content access ([26012eb](https://github.com/Priestch/markopress/commit/26012eb))

### 📝 Documentation

- add changelog entry for v0.0.19 ([f86b4ec](https://github.com/Priestch/markopress/commit/f86b4ec))


## [0.0.19] - 2026-05-11

### ✨ Features

- add content registry for cross-section content access ([26012eb](https://github.com/Priestch/markopress/commit/26012eb))

### 📝 Documentation

- condense CLAUDE.md with references to detailed docs

## [0.0.18] - 2026-03-23

### 🐛 Bug Fixes

- make image respect base_dir ([9a38665](https://github.com/Priestch/markopress/commit/9a38665))


## [0.0.17] - 2026-03-23

### 📝 Documentation

- update docs to reflect the seo plugin ([c05cd9e](https://github.com/Priestch/markopress/commit/c05cd9e))


## [0.0.16] - 2026-03-06

### ✨ Features

- support robots ([83e8fa8](https://github.com/Priestch/markopress/commit/83e8fa8))


## [0.0.15] - 2026-03-03

### 🔧 Chores

- update changelog ([52cb112](https://github.com/Priestch/markopress/commit/52cb112))


All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.13] - 2026-03-02

### Added

- **head-inject plugin**: Built-in plugin for type-safe head tag injection via configuration
  - Automatically enabled and reads from `config.site.head`
  - Supports meta, link, script, and base tags
  - Configurable positioning (top/bottom of head section)
  - Validates tag structure at config load time with helpful error messages
  - Full TypeScript type safety
  - Theme integration via `<theme-head-top/>` and `<theme-head-bottom/>` extension points

- New head tag types for type-safe configuration:
  - `HeadTag` - Union type for all supported head tags
  - `MetaTag`, `LinkTag`, `ScriptTag`, `BaseTag` - Individual tag type definitions
  - Re-exported from config types for user convenience

- Documentation:
  - Comprehensive plugin documentation at `docs/plugins/head-injection.md`
  - Usage examples for common scenarios (Google Analytics, Google Fonts, Open Graph, etc.)
  - Migration guide from old array format

### Changed

- **BREAKING**: `site.head` config format changed from array-of-arrays to typed objects
  - Old: `[['meta', { name: 'viewport' }]]`
  - New: `[{ type: 'meta', name: 'viewport', content: '...' }]`
  - Old format is no longer supported
  - See documentation for migration examples

- Plugin system:
  - Config hook stores head data in `_headInject` for $global access
  - Theme extension points render head tags via $global.headTop and $global.headBottom

### Technical Details

- Plugin architecture:
  - Config hook: Reads, validates, and transforms `config.site.head`
  - Validation: Throws helpful errors for invalid tag configurations
  - Transformation: Converts typed objects to Marko-compatible renderable format
  - $global injection: Head data available as $global.headTop and $global.headBottom

- Implementation files:
  - `src/plugins/head-inject/index.ts` - Plugin entry point
  - `src/plugins/head-inject/types.ts` - Type definitions
  - `src/plugins/head-inject/validator.ts` - Tag validation
  - `src/plugins/head-inject/transformer.ts` - Format transformation
  - `src/theme/default/tags/theme-head-top.marko` - Top extension point
  - `src/theme/default/tags/theme-head-bottom.marko` - Bottom extension point

## [0.0.11] - 2025-02-27

### Added

- Initial release of MarkoPress
- Content plugins (pages, docs, blog)
- SEO plugin with sitemap generation
- Theme system with multiple design systems
- Search functionality with Minisearch
- Markdown support with Shiki syntax highlighting

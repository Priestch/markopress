# Changelog

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

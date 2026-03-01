# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **head-inject plugin**: Built-in plugin for injecting custom head tags via configuration
  - Automatically enabled and reads from `config.site.head`
  - Supports meta, link, script, and base tags
  - Configurable positioning (top/bottom of head section)
  - Validates tag structure at config load time
  - Works with global config and per-page frontmatter
  - Theme integration via `<theme-head-top/>` and `<theme-head-bottom/>` extension points

- New configuration types for head injection:
  - `HeadTag` - Type definition for head-inject plugin tags
  - Re-exported as `HeadInjectPluginTag` from config types for user convenience

- Documentation:
  - Comprehensive plugin documentation at `docs/plugins/head-injection.md`
  - Usage examples for common scenarios (Google Analytics, Google Fonts, Open Graph, etc.)

### Changed

- Enhanced plugin system:
  - `enhanceModules` hook now supports head tag injection
  - Build system includes head metadata in markdown metadata for handler access
  - Theme extension points updated to render injected head tags

### Technical Details

- Plugin architecture:
  - Config hook: Reads and processes `config.site.head`
  - Validation: Ensures tag correctness with helpful error messages
  - Transformation: Converts array format to renderable Marko format
  - Enhancement: Adds head data to file metadata for templates

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

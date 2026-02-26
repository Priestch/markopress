# SEO Plugin Changelog

## Version 0.0.11 - TBD

### Added
- Built-in SEO plugin for sitemap generation
- `plugins: ['seo']` opt-in configuration
- Sitemap generation with `lastmod`, `changefreq`, and `priority` support
- `transformItems` hook for custom sitemap manipulation
- Exclusion patterns for filtering routes
- Full TypeScript type definitions
- Integration tests for sitemap generation

### Changed
- Extended `ResolvedConfig` interface with `seo` field
- Registered 'seo' as built-in plugin in plugin manager
- Updated documentation to reflect sitemap as opt-in feature (not auto-generated)

### Fixed
- Corrected earlier documentation that incorrectly claimed sitemap/robots.txt were automatically generated

### Dependencies
- Added `sitemap@^8.0.0` for XML generation
- Added `@types/sitemap@^7.1.0` for TypeScript support

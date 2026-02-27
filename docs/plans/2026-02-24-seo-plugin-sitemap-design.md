# SEO Plugin (Sitemap) Design

**Date:** 2026-02-24
**Status:** Design approved, pending implementation
**Author:** Claude (via brainstorming session)

## Overview

Add an optional SEO plugin to MarkoPress that generates `sitemap.xml` files. The plugin will be built-in (ships with core) but opt-in via configuration. Initial version includes sitemap generation only, with robots.txt and RSS planned for future iterations.

## Motivation

Current documentation claims sitemap/robots.txt support exists, but these features are not implemented. Adding them as a plugin keeps the core clean while providing essential SEO functionality for users who need it.

## Requirements

- Generate valid sitemap.xml following sitemaps.org protocol
- Support `lastmod`, `changefreq`, and `priority` fields
- Handle base paths correctly
- Allow customization via configuration
- Use proven `sitemap` npm package for XML generation
- Non-failing: sitemap errors should not break builds

## Architecture

### Plugin Structure

```
packages/markopress/src/plugins/seo/
├── index.ts           # Plugin entry point, exports MarkoPressPlugin
├── sitemap.ts         # Sitemap generation logic
└── types.ts           # Plugin-specific types
```

### Build Integration

1. User adds `'seo'` to `plugins` array in config
2. Build completes and generates all static files
3. Plugin's `postBuild` hook fires
4. Plugin collects URLs from `routes` and `allContent`
5. Writes `sitemap.xml` to `outDir`

### Built-in Plugin Registration

The SEO plugin will be added to the `builtInPlugins` array in `packages/markopress/src/plugin/manager.ts`:

```typescript
const builtInPlugins = ['sidenav', 'toc', 'blog-index', 'seo'];
```

This allows users to reference it as `'seo'` instead of a full package path.

## Configuration

### Type Definitions

```typescript
export interface SitemapOptions {
  hostname?: string;
  exclude?: string[];
  transformItems?: (items: SitemapItem[]) => SitemapItem[];
  sitemapOptions?: {
    lastmodDateOnly?: boolean;
  };
}

export interface SitemapItem {
  url: string;
  lastmod?: string | Date;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export interface SeoPluginConfig {
  sitemap?: SitemapOptions;
}
```

### User Configuration

```typescript
import { defineConfig } from 'markopress/config';

export default defineConfig({
  plugins: ['seo'],
  seo: {
    sitemap: {
      hostname: 'https://example.com',
      exclude: ['/api/**', '/private', '/drafts/**'],
      transformItems: (items) => {
        return items
          .filter(item => !item.url.startsWith('/draft'))
          .map(item => ({
            ...item,
            priority: item.url === '/' ? 1.0 : 0.7
          }));
      }
    }
  }
})
```

## Implementation

### Dependencies

```bash
pnpm add sitemap
pnpm add -D @types/sitemap
```

### Data Collection Flow

1. Collect URLs from routes
2. Get file paths from content
3. Read lastmod timestamps via fs.stat()
4. Apply exclusions
5. Apply user transform
6. Generate XML using `sitemap` package
7. Write to outDir/sitemap.xml

## Error Handling

Sitemap generation errors should NOT fail the entire build.

## Future Enhancements

1. Robots.txt generation
2. RSS feeds
3. Image sitemaps
4. Video sitemaps
5. Multilingual sitemaps

## References

- sitemaps.org protocol
- VitePress sitemap generation
- Rspress sitemap plugin
- sitemap npm package

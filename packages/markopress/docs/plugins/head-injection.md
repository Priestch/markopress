# Head Injection Plugin

The head injection plugin allows you to add custom content to the `<head>` section of your pages via configuration. It's automatically enabled and reads from `config.site.head`.

## Overview

The head-inject plugin is a **built-in plugin** that:
- ✅ Is automatically available (no manual installation required)
- ✅ Reads head tags from `config.site.head`
- ✅ Validates tag structure at config load time
- ✅ Supports positioning (top/bottom of head section)
- ✅ Works with global config and per-page frontmatter

## Configuration

Add head tags in your `src/.markopress/config.ts`:

```typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'My Site',
    head: [
      // Meta tags
      ['meta', { name: 'description', content: 'My awesome site' }],
      ['meta', { property: 'og:type', content: 'website' }],

      // Link tags (stylesheets, preconnect, etc.)
      ['link', {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
        position: 'top'  // Inject at <theme-head-top/>
      }],
      ['link', {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter'
      }],

      // Script tags
      ['script', {
        src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX',
        async: true,
        position: 'top'
      }],
      ['script', {
        text: `window.dataLayer = window.dataLayer || [];
               function gtag(){dataLayer.push(arguments);}`,
        position: 'top'
      }]
    ]
  }
});
```

## Tag Format

Head tags use an array format: `[tagName, attributesObject]`

```typescript
head: [
  ['tagName', {
    // attributes
    attribute: 'value',
    position: 'top'  // optional: 'top' | 'bottom' (default: 'bottom')
  }]
]
```

### Supported Tags

#### Meta Tags

```typescript
['meta', {
  name?: string,          // Standard meta tags (description, viewport, etc.)
  property?: string,      // Open Graph (og:*, twitter:card)
  'http-equiv'?: string,  // HTTP equivalent (refresh, etc.)
  content?: string,       // Content value
  charset?: string,       // Character set (UTF-8)
  position?: 'top' | 'bottom'
}]
```

**Examples:**

```typescript
// Description meta tag
['meta', { name: 'description', content: 'My site description' }]

// Viewport
['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }]

// Open Graph
['meta', { property: 'og:title', content: 'My Site' }]
['meta', { property: 'og:image', content: 'https://example.com/og-image.jpg' }]

// Charset
['meta', { charset: 'UTF-8' }]
```

#### Link Tags

```typescript
['link', {
  rel: string,                // Required: relationship type
  href: string,               // Required: URL
  as?: string,                // For preconnect/prefetch (script, style, font)
  type?: string,              // MIME type
  media?: string,             // Media query
  sizes?: string,             // For icons ('180x180', 'any')
  crossorigin?: string,       // 'anonymous' | 'use-credentials'
  integrity?: string,         // SRI hash
  disabled?: boolean,         // For stylesheets
  title?: string,            // For alternate stylesheets
  position?: 'top' | 'bottom'
}]
```

**Examples:**

```typescript
// Favicon
['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]

// Apple touch icon
['link', {
  rel: 'apple-touch-icon',
  sizes: '180x180',
  href: '/apple-touch-icon.png'
}]

// Preconnect (for performance)
['link', {
  rel: 'preconnect',
  href: 'https://fonts.googleapis.com',
  position: 'top'
}]

// Stylesheet
['link', {
  rel: 'stylesheet',
  href: 'https://fonts.googleapis.com/css2?family=Inter'
}]
```

#### Script Tags

```typescript
['script', {
  src?: string,              // External script URL
  text?: string,             // Inline script content (use instead of content)
  async?: boolean,           // Load asynchronously
  defer?: boolean,           // Defer parsing
  type?: string,             // Script type (module, text/javascript)
  crossorigin?: string,      // 'anonymous' | 'use-credentials'
  integrity?: string,        // SRI hash
  nonce?: string,            // CSP nonce
  position?: 'top' | 'bottom'
}]
```

**Examples:**

```typescript
// External script
['script', {
  src: 'https://cdn.example.com/analytics.js',
  async: true
}]

// Inline script
['script', {
  text: `console.log('Hello from MarkoPress!');`,
  position: 'top'
}]

// ES module
['script', {
  type: 'module',
  src: '/app.js'
}]
```

**Note:** Use `text` for inline script content, not `content`.

#### Base Tag

```typescript
['base', {
  href: string,              // Required: base URL
  target?: string,           // '_blank' | '_self' | '_parent' | '_top'
  position?: 'top' | 'bottom'
}]
```

**Example:**

```typescript
['base', { href: 'https://example.com/' }]
```

**Note:** Only one `<base>` tag is allowed per page.

## Positioning

Tags can be positioned in the head section:

- **`position: 'top'`** - Injects at `<theme-head-top/>` (early in head)
- **`position: 'bottom'`** - Injects at `<theme-head-bottom/>` (default)

**Best practices:**
- Use `top` for critical resources:
  - Preconnect hints
  - Early analytics scripts
  - Critical CSS
  - Character set
- Use `bottom` (or omit position) for:
  - Stylesheets
  - Late scripts
  - Most meta tags

## Per-Page Head Tags

You can also add head tags in markdown frontmatter:

```markdown
---
title: "My Page"
head:
  - ['meta', { name: 'description', content: 'Page-specific description' }]
  - ['meta', { property: 'og:image', content: '/page-og.jpg' }]
---
```

**Note:** Per-page tags are **added to** global tags, not replaced.

## Common Use Cases

### Google Analytics

```typescript
head: [
  ['script', {
    src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX',
    async: true,
    position: 'top'
  }],
  ['script', {
    text: `window.dataLayer = window.dataLayer || [];
           function gtag(){dataLayer.push(arguments);}
           gtag('js', new Date());
           gtag('config', 'G-XXXXXXXXXX');`,
    position: 'top'
  }]
]
```

### Google Fonts

```typescript
head: [
  ['link', {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
    position: 'top'
  }],
  ['link', {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossorigin: 'anonymous',
    position: 'top'
  }],
  ['link', {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'
  }]
]
```

### Open Graph Meta Tags

```typescript
head: [
  ['meta', { property: 'og:type', content: 'website' }],
  ['meta', { property: 'og:url', content: 'https://example.com' }],
  ['meta', { property: 'og:title', content: 'My Site' }],
  ['meta', { property: 'og:image', content: 'https://example.com/og-image.jpg' }],
  ['meta', { property: 'og:image:width', content: '1200' }],
  ['meta', { property: 'og:image:height', content: '630' }],
  ['meta', { property: 'og:description', content: 'My awesome site' }]
]
```

### Favicon

```typescript
head: [
  ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  ['link', {
    rel: 'apple-touch-icon',
    sizes: '180x180',
    href: '/apple-touch-icon.png'
  }],
  ['link', { rel: 'manifest', href: '/site.webmanifest' }]
]
```

### Structured Data (JSON-LD)

```typescript
head: [
  ['script', {
    type: 'application/ld+json',
    text: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'My Site',
      url: 'https://example.com'
    })
  }]
]
```

## Validation

The plugin validates head tags at config load time and logs warnings for:

- Missing required attributes (e.g., `link` without `href`)
- Multiple `<base>` tags
- Invalid tag types
- Malformed tag arrays

**Example warnings:**

```
[head-inject] link tag: Missing required attribute: href
[head-inject] Only one <base> tag is allowed per page
```

Invalid tags are **skipped** with a warning (doesn't break the build).

## How It Works

1. **Config Hook:** Plugin reads `config.site.head` during initialization
2. **Validation:** Tags are validated for correctness
3. **Transformation:** Arrays are converted to renderable format
4. **Grouping:** Tags are grouped by position (top/bottom)
5. **Enhancement:** During build, tags are added to each file's metadata
6. **Rendering:** Templates access tags via `$global.headTop` and `$global.headBottom`

## Theme Integration

The plugin uses theme extension points:

```marko
<!-- In theme layout <head> section -->
<head>
  <theme-head-top/>    <!-- Early head tags -->
  <!-- Other meta tags -->
  <theme-head-bottom/> <!-- Late head tags -->
</head>
```

## Plugin Options

The plugin is automatically enabled but can be configured:

```typescript
export default defineConfig({
  plugins: [
    ['head-inject', { enabled: true }]  // Explicit enable (default)
  ]
});
```

To disable:

```typescript
export default defineConfig({
  plugins: [
    ['head-inject', { enabled: false }]
  ]
});
```

## Type Safety

For TypeScript users, the config format uses:

```typescript
type HeadTag = (string | Record<string, string>)[];
```

The plugin internally converts this to a more strongly-typed format for validation and transformation.

## Migration from Static Sites

Coming from other static site generators?

### VitePress

```typescript
// VitePress
head: [['meta', { name: 'description', content: 'My site' }]]

// MarkoPress (same format)
head: [['meta', { name: 'description', content: 'My site' }]]
```

### Docusaurus

```javascript
// Docusaurus
headTags: [
  { tagName: 'meta', attributes: { name: 'description', content: 'My site' } }
]

// MarkoPress
head: [['meta', { name: 'description', content: 'My site' }]]
```

### Next.js

```typescript
// Next.js (in Head component)
<Meta name="description" content="My site" />

// MarkoPress
head: [['meta', { name: 'description', content: 'My site' }]]
```

## Troubleshooting

### Tags not appearing

1. Check browser DevTools for rendered HTML
2. Verify `config.site.head` is set correctly
3. Check build logs for validation warnings
4. Ensure theme includes `<theme-head-top/>` and `<theme-head-bottom/>` tags

### Build warnings

```
[head-inject] Invalid head config: ...
```

Fix the reported issue in your config or frontmatter.

### Per-page tags not working

Ensure frontmatter syntax is correct:

```yaml
---
head:
  - ['meta', { name: 'description', content: '...' }]
---
```

Not:

```yaml
---
head: ['meta', { name: '...' }]  # Wrong: needs array of arrays
---
```

## See Also

- [Configuration Docs](../configuration.md)
- [Theme System](../theming.md)
- [SEO Plugin](./seo.md) - For sitemap generation

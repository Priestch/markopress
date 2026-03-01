# Head Injection Plugin

The head injection plugin allows you to add custom content to the `<head>` section of your pages via declarative configuration.

## Overview

The head-inject plugin is a **built-in plugin** that:
- ✅ Is automatically available (no manual installation required)
- ✅ Reads head tags from `config.site.head`
- ✅ Validates tag structure at config load time
- ✅ Supports positioning (top/bottom of head section)
- ✅ Provides full TypeScript type safety

## Configuration

Add head tags in your `src/.markopress/config.ts`:

```typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'My Site',
    head: [
      // Meta tags
      {
        type: 'meta',
        name: 'description',
        content: 'My awesome site'
      },
      {
        type: 'meta',
        property: 'og:type',
        content: 'website'
      },

      // Link tags (stylesheets, preconnect, etc.)
      {
        type: 'link',
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
        position: 'top'  // Inject at <theme-head-top/>
      },
      {
        type: 'link',
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter'
      },

      // Script tags
      {
        type: 'script',
        src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX',
        async: true,
        position: 'top'
      },
      {
        type: 'script',
        content: `window.dataLayer = window.dataLayer || [];
               function gtag(){dataLayer.push(arguments);}`,
        position: 'top'
      }
    ]
  }
});
```

## Tag Types

### Meta Tags

```typescript
{
  type: 'meta',
  name?: string,          // Standard meta tags (description, viewport, etc.)
  property?: string,      // Open Graph (og:*, twitter:card)
  httpEquiv?: string,     // HTTP equivalent (refresh, etc.)
  content: string,        // Required: content value
  charset?: string,       // Character set (UTF-8)
  position?: 'top' | 'bottom'
}
```

**Examples:**

```typescript
// Description meta tag
{
  type: 'meta',
  name: 'description',
  content: 'My site description'
}

// Viewport
{
  type: 'meta',
  name: 'viewport',
  content: 'width=device-width, initial-scale=1'
}

// Open Graph
{
  type: 'meta',
  property: 'og:title',
  content: 'My Site'
}
{
  type: 'meta',
  property: 'og:image',
  content: 'https://example.com/og-image.jpg'
}

// Charset
{
  type: 'meta',
  charset: 'UTF-8'
}
```

### Link Tags

```typescript
{
  type: 'link',
  rel: string,                // Required: relationship type
  href: string,               // Required: URL
  as?: string,                // For preconnect/prefetch (script, style, font)
  type?: string,              // MIME type
  media?: string,             // Media query
  sizes?: string,             // For icons ('180x180', 'any')
  crossorigin?: 'anonymous' | 'use-credentials',
  integrity?: string,         // SRI hash
  disabled?: boolean,         // For stylesheets
  title?: string,            // For alternate stylesheets
  position?: 'top' | 'bottom'
}
```

**Examples:**

```typescript
// Favicon
{
  type: 'link',
  rel: 'icon',
  type: 'image/svg+xml',
  href: '/favicon.svg'
}

// Apple touch icon
{
  type: 'link',
  rel: 'apple-touch-icon',
  sizes: '180x180',
  href: '/apple-touch-icon.png'
}

// Preconnect (for performance)
{
  type: 'link',
  rel: 'preconnect',
  href: 'https://fonts.googleapis.com',
  position: 'top'
}

// Stylesheet
{
  type: 'link',
  rel: 'stylesheet',
  href: 'https://fonts.googleapis.com/css2?family=Inter'
}
```

### Script Tags

```typescript
{
  type: 'script',
  src?: string,                      // External script URL
  content?: string,                  // Inline script content (mutually exclusive with src)
  async?: boolean,                   // Load asynchronously
  defer?: boolean,                   // Defer parsing
  type?: string,                     // Script type (module, text/javascript)
  crossorigin?: 'anonymous' | 'use-credentials',
  integrity?: string,                // SRI hash
  nonce?: string,                    // CSP nonce
  position?: 'top' | 'bottom'
}
```

**Examples:**

```typescript
// External script
{
  type: 'script',
  src: 'https://cdn.example.com/analytics.js',
  async: true
}

// Inline script
{
  type: 'script',
  content: `console.log('Hello from MarkoPress!');`,
  position: 'top'
}

// ES module
{
  type: 'script',
  type: 'module',
  src: '/app.js'
}
```

**Note:** For inline scripts, use the `content` property (not `text`).

### Base Tag

```typescript
{
  type: 'base',
  href: string,                      // Required: base URL
  target?: '_blank' | '_self' | '_parent' | '_top',
  position?: 'top' | 'bottom'
}
```

**Example:**

```typescript
{
  type: 'base',
  href: 'https://example.com/'
}
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

## Common Use Cases

### Google Analytics

```typescript
head: [
  {
    type: 'script',
    src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX',
    async: true,
    position: 'top'
  },
  {
    type: 'script',
    content: `window.dataLayer = window.dataLayer || [];
           function gtag(){dataLayer.push(arguments);}
           gtag('js', new Date());
           gtag('config', 'G-XXXXXXXXXX');`,
    position: 'top'
  }
]
```

### Google Fonts

```typescript
head: [
  {
    type: 'link',
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
    position: 'top'
  },
  {
    type: 'link',
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossorigin: 'anonymous',
    position: 'top'
  },
  {
    type: 'link',
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'
  }
]
```

### Open Graph Meta Tags

```typescript
head: [
  {
    type: 'meta',
    property: 'og:type',
    content: 'website'
  },
  {
    type: 'meta',
    property: 'og:url',
    content: 'https://example.com'
  },
  {
    type: 'meta',
    property: 'og:title',
    content: 'My Site'
  },
  {
    type: 'meta',
    property: 'og:image',
    content: 'https://example.com/og-image.jpg'
  },
  {
    type: 'meta',
    property: 'og:image:width',
    content: '1200'
  },
  {
    type: 'meta',
    property: 'og:image:height',
    content: '630'
  },
  {
    type: 'meta',
    property: 'og:description',
    content: 'My awesome site'
  }
]
```

### Favicon

```typescript
head: [
  {
    type: 'link',
    rel: 'icon',
    type: 'image/svg+xml',
    href: '/favicon.svg'
  },
  {
    type: 'link',
    rel: 'apple-touch-icon',
    sizes: '180x180',
    href: '/apple-touch-icon.png'
  },
  {
    type: 'link',
    rel: 'manifest',
    href: '/site.webmanifest'
  }
]
```

### Structured Data (JSON-LD)

```typescript
head: [
  {
    type: 'script',
    type: 'application/ld+json',
    content: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'My Site',
      url: 'https://example.com'
    })
  }
]
```

## Validation

The plugin validates head tags at config load time and throws errors for:

- Missing required attributes
- Conflicting attributes (e.g., script with both src and content)
- Multiple `<base>` tags
- Invalid position values

**Example error:**

```
[head-inject] link tag: Missing required attribute: href
[head-inject] Only one <base> tag is allowed per page
```

Invalid config will **cause the build to fail** with a clear error message.

## How It Works

1. **Config Hook:** Plugin reads `config.site.head` during initialization
2. **Validation:** Tags are validated for correctness
3. **Transformation:** Typed objects are converted to renderable format
4. **Grouping:** Tags are grouped by position (top/bottom)
5. **$global Injection:** Data is added to `$global.headTop` and `$global.headBottom`
6. **Rendering:** Templates render tags via `<theme-head-top/>` and `<theme-head-bottom/>`

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

## Type Safety

The plugin exports TypeScript types for full type safety:

```typescript
import type { HeadTag } from 'markopress';

const myHeadTags: HeadTag[] = [
  {
    type: 'meta',
    name: 'description',
    content: 'My site'
  }
];
```

## Migration from Old Format

**⚠️ BREAKING CHANGE:** The old array format is no longer supported.

**Before (no longer works):**

```typescript
head: [
  ['meta', { name: 'viewport', content: 'width=device-width' }]
]
```

**After (required):**

```typescript
head: [
  {
    type: 'meta',
    name: 'viewport',
    content: 'width=device-width'
  }
]
```

## Migration from Other Static Site Generators

### VitePress

```typescript
// VitePress
head: [['meta', { name: 'description', content: 'My site' }]]

// MarkoPress (new format)
head: [{ type: 'meta', name: 'description', content: 'My site' }]
```

### Docusaurus

```javascript
// Docusaurus
headTags: [
  { tagName: 'meta', attributes: { name: 'description', content: 'My site' } }
]

// MarkoPress
head: [{ type: 'meta', name: 'description', content: 'My site' }]
```

### Next.js

```typescript
// Next.js (in Head component)
<Meta name="description" content="My site" />

// MarkoPress
head: [{ type: 'meta', name: 'description', content: 'My site' }]
```

## Troubleshooting

### Build fails with validation error

Check the error message for the specific issue:

```
[head-inject] link tag: Missing required attribute: href
```

Fix by adding the required attribute:

```typescript
{
  type: 'link',
  rel: 'icon',
  href: '/favicon.ico'  // Add this
}
```

### Tags not appearing in rendered HTML

1. Check browser DevTools for rendered HTML
2. Verify `config.site.head` is set correctly
3. Check build logs for validation errors
4. Ensure theme includes `<theme-head-top/>` and `<theme-head-bottom/>` tags

## See Also

- [Configuration Docs](../configuration.md)
- [Theme System](../theming.md)
- [SEO Plugin](./seo.md) - For sitemap generation

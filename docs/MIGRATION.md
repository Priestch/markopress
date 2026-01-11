# Migration Guide

Migrate your existing site from VitePress or Docusaurus to MarkoPress.

## Why Migrate?

- ⚡ **Faster Builds** - Marko.js compilation is significantly faster
- 🔥 **Instant HMR** - See changes immediately without refresh
- 📦 **Smaller Bundles** - Less JavaScript to load
- 🎨 **Easier Theming** - Slot-based overrides vs component replacements
- 💪 **More Control** - Full access to Marko's server-side rendering

## From VitePress

### Step 1: Install MarkoPress

```bash
npm init markopress@latest
```

### Step 2: Copy Content

```bash
# Copy docs
cp -r docs/* content/docs/

# Copy blog posts (if any)
cp -r blog/* content/blog/

# Copy public assets
cp -r public/* public/
```

### Step 3: Convert Config

**VitePress Config (.vitepress/config.ts):**

```typescript
export default defineConfig({
  title: 'My Site',
  description: 'My description',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/docs/intro' },
    ],
    sidebar: {
      '/docs/': [
        { text: 'Guide', items: [
          { text: 'Intro', link: '/docs/intro' },
        ]},
      ],
    },
  },
})
```

**MarkoPress Config (markopress.config.ts):**

```typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'My Site',
    description: 'My description',
  },
  themeConfig: {
    navbar: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/docs/intro' },
    ],
    sidebar: {
      '/docs/': [
        {
          text: 'Guide',
          items: [
            { text: 'Intro', link: '/docs/intro' },
          ],
        },
      ],
    },
  },
})
```

### Step 4: Update Frontmatter

VitePress frontmatter is mostly compatible. Just ensure:

```yaml
---
title: "Page Title"
description: "Page description"
order: 1  # For sidebar ordering
---
```

### Step 5: Custom Components

Replace Vue components with Marko components:

**VitePress (.vitepress/components/MyComponent.vue):**

```vue
<template>
  <div class="my-component">
    {{ message }}
  </div>
</template>

<script>
export default {
  data() {
    return { message: 'Hello' }
  }
}
</script>
```

**MarkoPress (src/tags/MyComponent.marko):**

```marko
class {
  onCreate() {
    this.state = { message: 'Hello' };
  }
}

<div class="my-component">
  ${state.message}
</div>
```

### Step 6: Custom Theme

VitePress theme overrides → MarkoPress slot overrides:

```bash
# Copy theme components
mkdir -p .markopress/theme/components
cp -r .vitepress/theme/components/* .markopress/theme/components/

# Convert .vue files to .marko files
# (see above for conversion)
```

### VitePress → MarkoPress Reference

| VitePress | MarkoPress |
|-----------|-----------|
| `.vitepress/config.ts` | `markopress.config.ts` |
| `docs/` | `content/docs/` |
| `blog/` | `content/blog/` |
| `.vitepress/theme/` | `.markopress/theme/` |
| `.vitepress/components/` | `src/tags/` |
| `frontmatter.title` | Same |
| `frontmatter.head` | Use `<head>` in layout |
| `$frontmatter` | `input.frontmatter` |
| `<ClientOnly>` | Server-side by default |

## From Docusaurus

### Step 1: Install MarkoPress

```bash
npm init markopress@latest
```

### Step 2: Copy Content

```bash
# Copy docs
cp -r docs/* content/docs/

# Copy blog
cp -r blog/* content/blog/

# Copy static assets
cp -r static/* public/
```

### Step 3: Convert Config

**Docusaurus Config (docusaurus.config.js):**

```javascript
module.exports = {
  title: 'My Site',
  tagline: 'My description',
  url: 'https://example.com',
  baseUrl: '/',
  themeConfig: {
    navbar: [
      { to: '/', label: 'Home' },
      { to: '/docs/intro', label: 'Docs' },
    ],
    footer: {
      style: 'dark',
      links: [
        { label: 'GitHub', href: 'https://github.com/user/repo' },
      ],
    },
  },
}
```

**MarkoPress Config (markopress.config.ts):**

```typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'My Site',
    description: 'My description',
    url: 'https://example.com',
    base: '/',
  },
  themeConfig: {
    navbar: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/docs/intro' },
    ],
    footer: {
      copyright: '© {year} My Site',
      links: [
        { text: 'GitHub', link: 'https://github.com/user/repo' },
      ],
    },
  },
})
```

### Step 4: Update Frontmatter

Docusaurus uses slightly different frontmatter:

**Docusaurus:**

```yaml
---
title: "Page Title"
description: "Page description"
sidebar_position: 1
---
```

**MarkoPress:**

```yaml
---
title: "Page Title"
description: "Page description"
order: 1
---
```

### Step 5: MDX Components

Docusaurus MDX → MarkoPress:

```markdown
<!-- Docusaurus -->
import Button from '@site/src/components/Button';

<Button text="Click me" />
```

```marko
<!-- MarkoPress -->
<src.tags.Button text="Click me" />
```

### Step 6: Swizzle Components

Docusaurus swizzling → MarkoPress overrides:

```bash
# Docusaurus
npm run swizzle @docusaurus/theme-classic Footer

# MarkoPress
mkdir -p .markopress/theme/components
cp node_modules/@markopress/theme-default/src/components/Footer.marko .markopress/theme/components/
```

### Docusaurus → MarkoPress Reference

| Docusaurus | MarkoPress |
|------------|-----------|
| `docusaurus.config.js` | `markopress.config.ts` |
| `docs/` | `content/docs/` |
| `blog/` | `content/blog/` |
| `static/` | `public/` |
| `src/components/` | `src/tags/` |
| `src/theme/` | `.markopress/theme/` |
| `sidebar_position` | `order` |
| `slug` | filename determines URL |
| Swizzle | Copy & modify |

## Content Compatibility

MarkoPress is designed to be compatible with existing markdown content. Most markdown files will work without changes:

### ✅ Compatible Features

- ✅ Standard markdown
- ✅ GitHub Flavored Markdown
- ✅ Frontmatter (gray-matter)
- ✅ Code blocks with syntax highlighting
- ✅ Tables
- ✅ Task lists
- ✅ Emoji
- ✅ Custom containers (tip/warning/danger)

### ⚠️ Needs Conversion

- ⚠️ Vue/React components → Marko components
- ⚠️ Framework-specific directives
- ⚠️ Build-time plugins (rewrite as MarkoPress plugins)

## Automated Migration Script

We provide a migration script to help automate the process:

```bash
npx @markopress/migrate@latest from-vitepress
# or
npx @markopress/migrate@latest from-docusaurus
```

The script will:
- ✅ Copy content files
- ✅ Convert configuration
- ✅ Update frontmatter where needed
- ⚠️ Show manual conversion tasks for components

## Manual Checklist

After running the migration script:

- [ ] Review and update configuration
- [ ] Test all pages and links
- [ ] Convert custom components
- [ ] Update theme overrides
- [ ] Verify build works
- [ ] Test production build
- [ ] Update CI/CD pipelines
- [ ] Update deployment configuration

## Troubleshooting

### Build Errors

**Problem:** TypeScript errors during build

**Solution:** Ensure `tsconfig.json` is properly configured

**Problem:** Missing components

**Solution:** Copy component files to `src/tags/` and convert to Marko syntax

### Content Issues

**Problem:** Pages not showing up

**Solution:** Check file paths match content directory structure

**Problem:** Images not loading

**Solution:** Ensure images are in `public/` directory

### Styling Issues

**Problem:** Theme styles not applying

**Solution:** Verify theme package is installed

**Problem:** Custom styles not loading

**Solution:** Place custom CSS in `.markopress/theme/styles.css`

## Getting Help

If you encounter issues during migration:

- 📖 Read [Configuration Guide](./configuration.md)
- 💬 Join our [Discord](https://discord.gg/markopress)
- 🐛 Report [Issues](https://github.com/markopress/markopress/issues)
- 💡 Check [Examples](https://github.com/markopress/examples)

## Next Steps

After migration:

- 🎨 Customize your [Theme](./theme.md)
- 🔌 Build [Plugins](./plugins.md)
- 🚀 Deploy your [Site](./deployment.md)

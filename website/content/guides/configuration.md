---
title: Configuration
description: Learn how to configure MarkoPress
order: 2
prev: /guides/getting-started
next: /guides/theming
---

# Configuration

MarkoPress is configured via `markopress.config.ts` in your project root.

## Site Configuration

```typescript
export default defineConfig({
  site: {
    title: 'My Site',
    description: 'Site description',
    base: '/',
    lang: 'en-US',
    head: [
      ['meta', { name: 'theme-color', content: '#3c8772' }],
      ['link', { rel: 'icon', href: '/favicon.ico' }],
    ],
  },
});
```

## Content Configuration

```typescript
export default defineConfig({
  content: {
    pages: 'content/pages',    // → /route
    docs: 'content/docs',       // → /guides/*
    blog: 'content/blog',       // → /blog/*
  },
});
```

## Theme Configuration

```typescript
export default defineConfig({
  theme: {
    name: '@markopress/theme-default',
    options: {
      navbar: [
        { text: 'Guide', link: '/guides/guide' },
        { text: 'Blog', link: '/blog' },
      ],
      sidebar: {
        '/guides/': [
          {
            text: 'Getting Started',
            items: [
              { text: 'Introduction', link: '/guides/guide/introduction' },
              { text: 'Installation', link: '/guides/guide/installation' },
            ],
          },
        ],
      },
    },
  },
});
```

## Markdown Configuration

```typescript
export default defineConfig({
  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
});
```

## Plugin Configuration

```typescript
export default defineConfig({
  plugins: [
    '@markopress/plugin-content-pages',
    '@markopress/plugin-content-docs',
    '@markopress/plugin-content-blog',
  ],
});
```

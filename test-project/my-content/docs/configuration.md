---
title: Configuration Guide
order: 20
---

# Configuration

MarkoPress uses a `markopress.config.js` file for site configuration.

## Basic Config

```javascript
import { defineConfig } from 'markopress/config';

export default defineConfig({
  site: {
    title: 'My Site',
    description: 'My awesome site',
  },
  theme: {
    name: '@markopress/theme-default',
    options: {
      navbar: [
        { text: 'Home', link: '/' },
        { text: 'Guide', link: '/docs/getting-started' },
      ],
      sidebar: {
        '/docs/': [
          {
            text: 'Getting Started',
            items: [
              { text: 'Installation', link: '/docs/getting-started' },
              { text: 'Configuration', link: '/docs/configuration' },
            ],
          },
        ],
      },
    },
  },
});
```

## Site Config

Configure your site's metadata:

- `title` - Site title
- `description` - Site description
- `base` - Base URL (default: `/`)
- `lang` - Site language (default: `en-US`)

## Content Directories

Customize where your content lives:

```javascript
content: {
  pages: 'my-pages',
  docs: 'my-docs',
  blog: 'my-blog',
}
```

## Theme Options

Configure the default theme:

- `navbar` - Top navigation links
- `sidebar` - Side navigation per route
- `logo` - Site logo path
- `footer` - Footer configuration

See also:
- [Markdown Options](/docs/advanced/markdown)
- [Build Options](/docs/advanced/build)

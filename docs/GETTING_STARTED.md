# Getting Started with MarkoPress

This guide will help you get started with MarkoPress in minutes.

## Installation

### Using npm

```bash
npm create markopress@latest my-site
cd my-site
npm install
```

### Using pnpm

```bash
pnpm create markopress my-site
cd my-site
pnpm install
```

### Using Yarn

```bash
yarn create markopress my-site
cd my-site
yarn install
```

## Project Structure

After installation, your project will look like this:

```
my-site/
├── .markopress/
│   └── config.ts              # Site configuration
├── content/
│   ├── pages/
│   │   ├── index.md           # Homepage → /
│   │   └── about.md           # About page → /about
│   ├── docs/
│   │   └── getting-started.md # Docs → /docs/getting-started
│   └── blog/
│       └── 2024-01-11-first-post.md  # Blog → /blog/2024-01-11-first-post
├── public/
│   └── favicon.ico            # Static assets
├── markopress.config.ts       # Alternative config location
├── package.json
└── tsconfig.json
```

## Development

Start the development server:

```bash
npm run dev
```

Your site will be available at `http://localhost:4173`

The development server features:
- ⚡ Hot Module Replacement (HMR)
- 📝 Instant markdown updates
- 🎨 Style updates without refresh
- 🔍 Error overlay

## Creating Content

### Pages

Create markdown files in `content/pages/`:

```markdown
---
title: "About"
description: "About my site"
---

# About

This is the about page.
```

The filename determines the URL:
- `content/pages/about.md` → `/about`
- `content/pages/contact.md` → `/contact`
- `content/pages/index.md` → `/`

### Documentation

Create docs in `content/docs/`:

```markdown
---
title: "Getting Started"
description: "Get started with MarkoPress"
order: 1
---

## Installation

Install MarkoPress using npm...
```

Documentation pages get:
- 📑 Automatic sidebar navigation
- ⬅️➡️ Prev/next navigation
- 🔍 Table of contents
- 📊 Page metadata

### Blog Posts

Create blog posts in `content/blog/`:

```markdown
---
title: "My First Post"
description: "Hello world!"
date: 2024-01-11
author: "Your Name"
tags: ["announcement"]
categories: ["News"]
---

# My First Post

Welcome to my blog!
```

Blog posts get:
- 📰 RSS feed generation
- 📅 Date-based sorting
- 🏷️ Tag and category support
- 👤 Author attribution

## Configuration

Create `markopress.config.ts`:

```typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'My Site',
    description: 'My awesome site',
    base: '/',
  },
  content: {
    pages: 'content/pages',
    docs: 'content/docs',
    blog: 'content/blog',
  },
  theme: '@markopress/theme-default',
  themeConfig: {
    name: 'My Site',
    description: 'My awesome site',
    navbar: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/docs/getting-started' },
      { text: 'Blog', link: '/blog' },
    ],
    sidebar: {
      '/docs/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/docs/intro' },
            { text: 'Installation', link: '/docs/install' },
            { text: 'Configuration', link: '/docs/config' },
          ],
        },
      ],
    },
    footer: {
      copyright: '© {year} My Site',
      links: [
        { text: 'GitHub', link: 'https://github.com/user/repo' },
        { text: 'Twitter', link: 'https://twitter.com/user' },
      ],
    },
  },
  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
});
```

## Frontmatter

All markdown files support frontmatter:

```yaml
---
title: "Page Title"
description: "Page description"
date: 2024-01-11
author: "Author Name"
tags: ["tag1", "tag2"]
order: 1
---

# Content here
```

### Common Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Page title |
| `description` | string | Page description for SEO |
| `date` | Date | Publication date (blog posts) |
| `author` | string | Author name (blog posts) |
| `tags` | string[] | Tags for categorization |
| `order` | number | Sidebar ordering (docs) |
| `draft` | boolean | Exclude from build |

## Markdown Features

MarkoPress supports GitHub Flavored Markdown plus:

### Syntax Highlighting

\`\`\`javascript
function hello() {
  console.log('Hello, world!');
}
\`\`\`

### Custom Containers

::: tip
This is a tip
:::

::: warning
This is a warning
:::

::: danger
This is dangerous!
:::

### Emoji

:smile: :rocket: :tada:

### Tables

| Feature | Status |
|---------|--------|
| HMR | ✅ |
| TypeScript | ✅ |
| Plugins | ✅ |

### Task Lists

- [x] MarkoPress
- [x] VitePress
- [ ] Docusaurus

## Build for Production

Build your site:

```bash
npm run build
```

This creates a `dist/` directory with:
- Optimized HTML
- Minified CSS
- Bundled JavaScript
- Static assets

## Preview Production Build

```bash
npm run preview
```

Visit `http://localhost:4173` to preview the production build.

## Next Steps

- 📖 Read the [Configuration Guide](./configuration.md)
- 🎨 Learn about [Theming](./theme.md)
- 🔌 Build [Plugins](./plugins.md)
- 🚀 Deploy your [Site](./deployment.md)

## Troubleshooting

### Port Already in Use

If port 4173 is in use:

```bash
# Use a different port
npm run dev -- --port 3000
```

### Build Errors

If you encounter build errors:

```bash
# Clean build
rm -rf dist
npm run build
```

### Module Not Found

Clear node_modules and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

## Getting Help

- 💬 Join our [Discord](https://discord.gg/markopress)
- 🐛 Report [Issues](https://github.com/markopress/markopress/issues)
- 📖 Read [Documentation](https://markopress.dev)

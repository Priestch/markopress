---
title: MarkoPress
description: A modern static site generator built on Marko.js v6
---

# Welcome to MarkoPress

A **general-purpose static site generator** that combines the simplicity of Markdown with the power of Marko.js v6 components. Designed as a drop-in alternative to VitePress and Docusaurus.

## ✨ Highlights

::: tip
MarkoPress now features a **composable plugin architecture** with `enhanceModules` hooks. Build powerful features by combining plugins!
:::

## 🎯 Key Features

### Plugin System

Extend your site with composable plugins:

| Plugin | Description | Status |
|--------|-------------|--------|
| **Blog Index** | Auto-generates blog listing pages | ✅ |
| **Sidenav** | Auto-generates sidebar from docs structure | ✅ |
| **TOC** | Table of contents from headers | ✅ |
| Search | Full-text search capability | 🚧 Coming Soon |
| RSS Feeds | Feed generation for blogs | 🚧 Coming Soon |

### Content Modules

Organize content into logical modules:

- **Pages** - Home, About, Contact, etc.
- **Docs** - Documentation with auto-generated navigation
- **Blog** - Posts with date-based sorting and indexes

### Modern Features

- **Markdown + Frontmatter** - Write content in Markdown with YAML metadata
- **File-based Routing** - Auto-generate routes from content structure
- **Syntax Highlighting** - Beautiful code blocks with Shiki
- **Custom Containers** - Tips, warnings, danger alerts
- **Theme System** - Slot-based component overrides
- **Design Tokens** - CSS variables for easy theming

## 🚀 Quick Start

```bash
# Create a new site
npm init markopress my-site

# Write content
echo '---
title: My First Post
---
# Hello World!' > content/pages/hello.md

# Start development server
npm run dev
```

## 📖 Explore

Check out our documentation and examples:

- **[Features Demo](/features)** - See all features in action
- **[Documentation](/docs/getting-started)** - Get started guide
- **[Blog](/blog)** - Latest updates and tutorials
- **[Plugins](/docs/plugins)** - Create custom plugins

## 🎨 Theming

Customize every aspect of your site:

```javascript
// markopress.config.js
export default {
  theme: {
    options: {
      sidebar: '/docs/**',
      navbar: [
        { text: 'Home', link: '/' },
        { text: 'Docs', link: '/docs/getting-started' },
        { text: 'Blog', link: '/blog' },
      ]
    }
  }
}
```

---

**Built with [Marko.js](https://markojs.com/) v6 • Static Site Generation • Plugin Architecture**

# MarkoPress

> A general-purpose static site generator powered by Marko.js v6

[![Build Status](https://img.shields.io/github/actions/workflow/status/markopress/markopress/build.yml?branch=main)](https://github.com/markopress/markopress/actions)
[![NPM Version](https://img.shields.io/npm/v/markopress.svg)](https://www.npmjs.com/package/markopress)
[![License](https://img.shields.io/npm/l/markopress.svg)](LICENSE)

**MarkoPress** is a fast, modern static site generator that combines the power of Marko.js v6 with the simplicity of markdown. It's designed to be a drop-in alternative to VitePress and Docusaurus with full content compatibility.

## ✨ Features

- ⚡ **Blazing Fast** - Built on Marko.js v6 with instant HMR and optimal performance
- 📝 **Markdown Support** - Full GitHub Flavored Markdown with frontmatter
- 🎨 **Beautiful Themes** - Default theme with dark mode, fully customizable
- 🔌 **Plugin System** - Extend functionality with plugins
- 📦 **File-based Routing** - Automatic route generation from content
- 🔍 **SEO Optimized** - Automatic sitemap, robots.txt, and Open Graph tags
- 📊 **Analytics Ready** - Built-in support for GA4, Plausible, Umami
- 🌐 **Content Compatible** - Works with existing VitePress/Docusaurus content
- 🎯 **TypeScript** - Full TypeScript support with type definitions

## 🚀 Quick Start

### Installation

```bash
npm create markopress@latest my-site
cd my-site
npm install
```

### Development

```bash
npm run dev
```

Visit `http://localhost:4173` to see your site!

### Build

```bash
npm run build
```

Output will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## 📁 Project Structure

```
my-markopress-site/
├── .markopress/
│   └── config.ts          # Site configuration
├── content/
│   ├── pages/             # → /route
│   ├── docs/              # → /docs/*
│   └── blog/              # → /blog/*
├── public/                # Static assets
├── src/
│   ├── routes/            # Custom routes (optional)
│   └── tags/              # Custom Marko components
└── markopress.config.ts   # Alternative config location
```

## 📝 Content Organization

### Pages

Create pages in `content/pages/`:

```markdown
---
title: "About Us"
description: "Learn about our company"
---

# About Us

We are awesome!
```

This creates a route at `/about`.

### Documentation

Create docs in `content/docs/`:

```markdown
---
title: "Getting Started"
description: "Get started with MarkoPress"
order: 1
---

# Getting Started

Welcome to MarkoPress!
```

This creates a route at `/docs/getting-started` with automatic sidebar and prev/next navigation.

### Blog Posts

Create blog posts in `content/blog/`:

```markdown
---
title: "First Post"
description: "Hello world!"
date: 2024-01-11
author: "Your Name"
tags: ["announcement", "first-post"]
---

# First Post

This is my first blog post!
```

This creates a route at `/blog/first-post` with RSS feed support.

## 🏷️ Marko Tags in Markdown

Use Marko components directly in your Markdown files for reusable, dynamic content blocks.

```markdown
<alert-box kind="warning">
  This is a **warning** alert with `code` support!
</alert-box>
```

### Enable Marko Tags

Add to your `markopress.config.ts`:

```typescript
export default defineConfig({
  markdown: {
    markoTags: {
      enabled: true,
      tagsDir: 'tags/',  // Directory for your components
    },
  },
});
```

### Create Components

Create `tags/alert-box.marko`:

```marko
<div class=["alert", input.kind && "alert-" + input.kind]>
  <${input.content}/>
</div>

<style>
  .alert { padding: 1rem; border-radius: 8px; }
  .alert-warning { background: #fff3cd; border: 1px solid #ffc107; }
</style>
```

### Use in Markdown

```markdown
<alert-box kind="warning">
  This is a **warning** alert!
</alert-box>
```

**Available Documentation:**
- [Marko Tags Guide](./docs/guides/marko-tags.md) - Overview and quick start
- [Component API](./docs/guides/marko-components.md) - Component library reference
- [Marko.js v6 Syntax](./docs/guides/marko-v6-syntax.md) - Syntax and best practices
- [Component Support](./docs/guides/marko-components-support.md) - Feature coverage analysis
- [Lessons Learned](./docs/development/marko-tags-lessons.md) - Common mistakes to avoid

## ⚙️ Configuration

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
    navbar: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/docs' },
      { text: 'Blog', link: '/blog' },
    ],
    sidebar: {
      '/docs/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/docs/intro' },
            { text: 'Installation', link: '/docs/install' },
          ],
        },
      ],
    },
  },
  markdown: {
    lineNumbers: true,
    theme: { light: 'github-light', dark: 'github-dark' },
  },
});
```

## 🎨 Theming

MarkoPress uses a powerful theming system with slot-based overrides.

### Use Default Theme

```typescript
// markopress.config.ts
export default defineConfig({
  theme: '@markopress/theme-default',
});
```

### Customize Theme

1. **Override Styles**: Create `.markopress/theme/styles.css`

```css
:root {
  --accent-color: #42b883;
  --border-radius: 8px;
}
```

2. **Override Components**: Copy to `.markopress/theme/components/`

3. **Override Layouts**: Copy to `.markopress/theme/layouts/`

See [Theme Documentation](./docs/theme.md) for details.

## 🔌 Plugins

Extend MarkoPress with plugins:

```typescript
export default defineConfig({
  plugins: [
    '@markopress/plugin-content-docs',
    '@markopress/plugin-content-blog',
    '@markopress/plugin-content-pages',
    // Custom plugins
    './plugins/my-plugin.ts',
  ],
});
```

### Creating a Plugin

```typescript
// plugins/my-plugin.ts
import { Plugin } from 'markopress';

export const myPlugin: Plugin = {
  name: 'my-plugin',
  
  hooks: {
    contentLoaded(content) {
      // Transform content
    },
    
    extendMarkdown(md) {
      // Add markdown-it plugins
    },
  },
};
```

## 🚀 Deployment

### Deploy to Vercel

```bash
npm run build
vercel --prod
```

### Deploy to Netlify

```bash
npm run build
netlify deploy --prod --dir=dist
```

### Deploy to GitHub Pages

```bash
npm run build
# Push dist/ to gh-pages branch
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 4173
CMD ["npm", "run", "preview"]
```

## 📚 Documentation

### Core Features
- [Getting Started](./docs/GETTING_STARTED.md)
- [Configuration Guide](./docs/CONFIGURATION.md)
- [Marko Tags Guide](./docs/guides/marko-tags.md) - Use Marko components in Markdown
- [Theming](./docs/theme.md)
- [Plugin Development](./docs/plugins.md)

### Architecture & Design
- **[VitePress & Docusaurus Architecture Analysis](./docs/ARCHITECTURE_ANALYSIS.md)** - Comprehensive analysis of how VitePress and Docusaurus work, and how MarkoPress implements similar features with Marko.js v6
  - Core architecture comparison
  - Build system implementation
  - Route generation strategies
  - Plugin and theme systems
  - Feature parity roadmap

### Advanced Guides
- [Component API Reference](./docs/guides/marko-components.md) - Marko Tags component library
- [Marko.js v6 Syntax](./docs/guides/marko-v6-syntax.md) - Syntax and best practices
- [Component Support Coverage](./docs/guides/marko-components-support.md) - Feature analysis
- [Development Lessons](./docs/development/marko-tags-lessons.md) - Common mistakes to avoid

### Reference
- [Deployment](./docs/DEPLOYMENT.md)
- [Migration Guide](./docs/MIGRATION.md)
- [Production Features](./docs/PRODUCTION_FEATURES.md)
- [@marko/run Reference](./docs/marko-run-reference.md)

## 🆚 Comparison

| Feature | MarkoPress | VitePress | Docusaurus |
|---------|-----------|-----------|------------|
| **Framework** | Marko.js v6 | Vue 3 | React |
| **Build Time** | ⚡ Fast | ⚡ Fast | 🐌 Slower |
| **HMR** | ✅ Instant | ✅ Fast | ⚠️ Moderate |
| **TypeScript** | ✅ Native | ✅ Supported | ✅ Supported |
| **Content Compatible** | ✅ Both | ✅ N/A | ✅ N/A |
| **Themes** | ✅ Slot-based | ✅ Vue Components | ✅ React Components |
| **Plugins** | ✅ Hooks API | ✅ Markdown API | ✅ React Plugins |
| **Bundle Size** | 📦 Minimal | 📦 Larger | 📦 Largest |
| **Learning Curve** | 📈 Moderate | 📈 Easy | 📈 Steeper |

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md).

## 📄 License

MIT © [MarkoPress](LICENSE)

## 🙏 Acknowledgments

Built with:
- [Marko.js](https://markojs.com/) - UI framework
- [@marko/run](https://github.com/marko-js/run) - Build tool
- [markdown-it](https://github.com/markdown-it/markdown-it) - Markdown parser
- [Shiki](https://shiki.style/) - Syntax highlighting

## 📮 Support

- 💬 [Discord](https://discord.gg/markopress)
- 🐛 [Issues](https://github.com/markopress/markopress/issues)
- 📖 [Documentation](https://markopress.dev)
- 🐦 [Twitter](https://twitter.com/markopress)

---

Made with ❤️ by the MarkoPress team

# MarkoPress

> A general-purpose static site generator powered by Marko.js v6

[![NPM Version](https://img.shields.io/npm/v/markopress.svg)](https://www.npmjs.com/package/markopress)

**MarkoPress** is a fast, modern static site generator that combines the power of Marko.js v6 with the simplicity of markdown. It's designed to be a drop-in alternative to VitePress and Docusaurus with full content compatibility.

## Features

- VitePress-style file-based routing
- Full GitHub Flavored Markdown with frontmatter
- Automatic sitemap, robots.txt, and Open Graph tags
- Plugin system with hooks API
- TypeScript support

## Installation

```bash
npm install markopress
```

## Quick Start

```bash
npx markopress init my-site
cd my-site
npm install
npm run dev
```

## Content Organization

MarkoPress uses **VitePress-style routing** where file path directly determines URL.

### URL Mapping

The `contentDir` (default: `content`) contains all content. Directory structure = URL structure:

| File Path | URL |
|-----------|-----|
| `content/index.md` | `/` |
| `content/about.md` | `/about` |
| `content/docs/index.md` | `/docs/` |
| `content/docs/guide.md` | `/docs/guide` |
| `content/blog/index.md` | `/blog/` |
| `content/blog/first-post.md` | `/blog/first-post` |

### Configuration

```typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  contentDir: 'content',  // Default
  content: {
    docs: {
      sidebar: true,      // Auto-generate sidebar
      toc: true,          // Table of contents
    },
    blog: {
      rss: true,          // Generate RSS feed
      list: true,         // Generate blog list page
    },
  },
});
```

### Feature Flags

| Flag | Description |
|------|-------------|
| `sidebar` | Auto-generate sidebar navigation for the section |
| `toc` | Generate table of contents for each page |
| `rss` | Generate RSS feed for the section |
| `list` | Generate a list/index page showing all items |

### Frontmatter Fields

- `title` (string) - Page title
- `description` (string) - SEO description
- `draft` (boolean) - Exclude from build when true
- `order` (number) - Sidebar ordering
- `date` (Date) - Publication date (for blog)
- `author` (string) - Author name (for blog)
- `tags` (string[]) - Tags (for blog)

## Markdown Features

MarkoPress supports GitHub Flavored Markdown plus:

- **Syntax highlighting** via Shiki (customizable themes)
- **Custom containers**: `::: tip`, `::: warning`, `::: danger`
- **Emoji** via markdown-it-emoji
- **Task lists**: `- [ ]` and `- [x]`
- **Tables** with standard GitHub syntax
- **Custom Marko tags** (optional)

## CLI Commands

```bash
markopress dev           # Start dev server (default: localhost:3000)
markopress dev -p 4173   # Start on custom port
markopress build         # Build for production
markopress preview       # Preview production build
markopress init [dir]    # Create new site
```

## License

MIT

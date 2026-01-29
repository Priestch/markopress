# MarkoPress Official Website

This is the official website for MarkoPress, built using MarkoPress itself.

## Structure

```
website/
├── content/           # Website content
│   ├── pages/         # General pages (Home, Features, About, etc.)
│   ├── guides/        # User guides and documentation
│   └── blog/          # Blog posts
├── public/            # Static assets
├── src/               # Generated routes (built from content)
├── tags/              # Custom Marko tags for content
├── markopress.config.js
└── package.json
```

## Development

### From the website directory

```bash
cd website
pnpm dev
```

### From the monorepo root

```bash
# Run website dev server
pnpm docs:dev

# Or use the shorthand
pnpm dev
```

## Build

```bash
# From website directory
pnpm build

# From monorepo root
pnpm docs:build
# or
pnpm build
```

## Preview Production Build

```bash
# From website directory
pnpm preview

# From monorepo root
pnpm docs:preview
# or
pnpm preview
```

## Content Organization

### Pages (`content/pages/`)
- Home page, features, about, contact, etc.
- URL pattern: `/filename`

### Guides (`content/guides/`)
- User guides, tutorials, API reference
- URL pattern: `/guides/filename`
- Has auto-generated sidebar navigation

### Blog (`content/blog/`)
- Blog posts and updates
- URL pattern: `/blog/filename`
- Has auto-generated blog index at `/blog`

## Adding Content

### Create a new page

1. Create `content/pages/my-page.md`:

```markdown
---
title: My Page
description: Page description
---

# My Page Title

Content goes here...
```

2. Run `pnpm dev` - the page will be available at `/my-page`

### Create a new guide

1. Create `content/guides/my-guide.md`:

```markdown
---
title: My Guide
description: Guide description
order: 1
---

# My Guide Title

Content goes here...
```

2. The guide will appear in the sidebar automatically

### Create a blog post

1. Create `content/blog/YYYY-MM-DD-slug.md`:

```markdown
---
title: My Blog Post
date: 2024-01-21
author: Your Name
description: Post description
---

# Blog Post Title

Content goes here...
```

2. The post will appear on `/blog` automatically

## Theming

The website uses `@markopress/theme-default` with the default style. To customize:

1. Override components in `.markopress/theme/components/`
2. Modify CSS variables in `markopress.config.js`
3. See theme docs for details

## Deployment

The website builds to `dist/` which can be deployed to any static hosting service:

- **Vercel**: `vercel deploy dist`
- **Netlify**: Drop `dist/` in Netlify dashboard
- **GitHub Pages**: Push `dist/` to `gh-pages` branch
- **Cloudflare Pages**: Connect repo and use `dist/` as output directory

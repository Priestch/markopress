# MarkoPress Official Website

This is the official website for MarkoPress, built using MarkoPress itself.

## Structure

MarkoPress uses a **content-first** layout where implementation details are hidden under `.markopress/`:

```
website/
├── content/           # Primary authoring surface
│   ├── pages/         # General pages (Home, Features, About, etc.)
│   ├── guides/        # User guides and documentation
│   └── blog/          # Blog posts
├── public/            # Static assets (images, audio, video)
├── .markopress/       # Hidden app root (implementation)
│   ├── src/           # Generated routes, layouts, components
│   ├── public/        # Framework/theme assets
│   ├── config.js      # MarkoPress configuration
│   └── package.json   # Package definition
└── package.json       # Workspace placeholder
```

**Key points:**
- Users work primarily with `content/` and `public/` directories
- All Marko/MarkoPress implementation lives under `.markopress/`
- The CLI automatically resolves paths - run commands from `website/`

## Development

### From the website directory

```bash
cd website
markopress dev
# or
pnpm dev
```

### From the monorepo root

```bash
# Run website dev server
pnpm docs:dev

# Or use the shorthand
pnpm dev
```

The dev server will automatically:
1. Resolve `.markopress/` as the app root
2. Find content in `../content/` relative to the app root
3. Generate routes in `.markopress/src/routes/`
4. Start the @marko/run dev server

## Build

```bash
# From website directory
markopress build
# or
pnpm build

# From monorepo root
pnpm docs:build
# or
pnpm build
```

## Preview Production Build

```bash
# From website directory
markopress preview
# or
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

2. Run `markopress dev` - the page will be available at `/my-page`

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

## Advanced Customization

For advanced customization, you can work directly with the `.markopress/` directory:

### Override Components
Create `.markopress/src/components/` to override theme components

### Custom Routes
Add custom routes in `.markopress/src/routes/` (but note that generated routes may overwrite)

### Custom Marko Tags
Add `.markopress/tags/` for custom Marko components to use in markdown

### Configuration
Edit `.markopress/config.js` to customize theme, plugins, and content paths

## Deployment

The website builds to `.markopress/dist/` which can be deployed to any static hosting service:

- **Vercel**: `vercel deploy website/.markopress/dist`
- **Netlify**: Use `website/.markopress/dist` as publish directory
- **GitHub Pages**: Push `.markopress/dist/` to `gh-pages` branch
- **Cloudflare Pages**: Connect repo and use `website/.markopress/dist` as output directory

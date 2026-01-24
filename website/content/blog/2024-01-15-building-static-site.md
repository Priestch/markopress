---
title: "Building a Static Site with MarkoPress"
description: "Learn how to build a fast, modern static site from scratch using MarkoPress"
date: 2024-01-15
author: "Sarah Chen"
tags: ["tutorial", "beginner", "static-site"]
categories: ["Tutorials"]
excerpt: "Step-by-step guide to building your first MarkoPress site from installation to deployment"
readingTime: "8 min"
---

# Building a Static Site with MarkoPress

Welcome to your comprehensive guide to building a static site with MarkoPress. Whether you're creating a personal blog, portfolio, or documentation site, this tutorial will take you from zero to deployed site.

## What You'll Learn

In this tutorial, you'll:

- ✅ Install and set up MarkoPress
- ✅ Create pages, blog posts, and documentation
- ✅ Customize your site's appearance
- ✅ Deploy your site to the web
- ✅ Add features like dark mode and RSS feeds

**Time required:** 30-45 minutes
**Prerequisites:** Basic knowledge of markdown and command line

## What is MarkoPress?

MarkoPress is a modern static site generator that combines:

- **⚡ Blazing Fast** - Builds 10x faster than alternatives
- **📝 Markdown Native** - Write content in markdown
- **🎨 Beautiful Themes** - Stunning default theme with dark mode
- **🔌 Plugin System** - Extend functionality easily
- **📦 File-Based Routing** - Automatic URL generation from files

It's perfect for blogs, portfolios, documentation sites, and marketing pages.

## Step 1: Installation

First, ensure you have [Node.js 18+](https://nodejs.org/) installed.

### Create a New Site

Open your terminal and run:

```bash
npm create markopress@latest my-site
```

This creates a new directory called `my-site` with everything you need.

### Navigate and Install

```bash
cd my-site
npm install
```

### Project Structure

Your site now has this structure:

```
my-site/
├── .markopress/
│   └── config.ts          # Site configuration
├── content/
│   ├── pages/             # → /route
│   │   ├── index.md       # Homepage
│   │   └── about.md       # About page
│   ├── docs/              # → /guides/route
│   │   └── intro.md       # Documentation
│   └── blog/              # → /blog/route
│       └── first-post.md  # Blog post
├── public/                # Static assets
├── markopress.config.ts   # Alternative config
└── package.json
```

## Step 2: Start Development Server

Run the development server:

```bash
npm run dev
```

Visit `http://localhost:4173` to see your site!

You'll see:
- A beautiful homepage with gradient background
- Sample pages, docs, and blog posts
- Dark mode toggle in the top-right
- Responsive navigation

**Try it:** Click the dark mode toggle to see instant theme switching!

## Step 3: Create Your First Page

Let's create a new page.

### Create the File

Create `content/pages/contact.md`:

```markdown
---
title: "Contact"
description: "Get in touch with us"
---

# Contact Us

Have questions? We'd love to hear from you!

## Email

General inquiries: hello@mysite.com

## Social

- Twitter: [@mysite](https://twitter.com/mysite)
- GitHub: [mysite](https://github.com/mysite)
```

### View Your Page

Visit `http://localhost:4173/contact` to see your new page!

MarkoPress automatically:
- Created the route from the filename
- Applied your site's theme
- Added navigation (if configured)
- Generated proper HTML with SEO tags

## Step 4: Add Documentation

Create documentation with automatic sidebar navigation.

### Create a Doc File

Create `content/guides/getting-started.md`:

```markdown
---
title: "Getting Started"
description: "Quick start guide for MarkoPress"
order: 1
---

# Getting Started

Welcome to the documentation!

## Installation

Install MarkoPress using npm:

\`\`\`bash
npm create markopress@latest my-site
\`\`\`

## Configuration

Configure your site in `markopress.config.ts`:

\`\`\`typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'My Site',
    description: 'My awesome site',
  },
});
\`\`\`
```

### Configure Sidebar

Edit `markopress.config.ts`:

```typescript
export default defineConfig({
  themeConfig: {
    sidebar: {
      '/guides/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guides/getting-started' },
          ],
        },
      ],
    },
  },
});
```

Now your docs have:
- ✅ Sidebar navigation
- ✅ Prev/next links
- ✅ Table of contents
- ✅ Breadcrumbs

## Step 5: Write a Blog Post

Create blog posts with automatic RSS feed generation.

### Create a Blog Post

Create `content/blog/2024-01-15-my-first-post.md`:

```markdown
---
title: "My First Post"
description: "Hello world!"
date: 2024-01-15
author: "Your Name"
tags: ["announcement", "first-post"]
categories: ["News"]
---

# My First Post

Welcome to my blog! This is my first post using MarkoPress.

## Why MarkoPress?

I chose MarkoPress because:

- ⚡ It's incredibly fast
- 🎨 The themes are beautiful
- 📝 Markdown is easy to write
- 🔌 Plugins add extra features

## What's Next?

Stay tuned for more posts!
```

### Blog Features

Your blog now has:
- ✅ RSS feed at `/api/rss/xml`
- ✅ Tag pages at `/blog/tags/{tag}`
- ✅ Date-based sorting
- ✅ Post metadata (author, tags, date)
- ✅ SEO optimization

## Step 6: Customize Your Theme

Make your site unique with CSS variables.

### Edit Theme Colors

Create `.markopress/theme/styles.css`:

```css
:root {
  /* Ocean Theme */
  --bg-gradient: linear-gradient(135deg, #0061ff 0%, #60efff 100%);
  --accent-color: #0061ff;
  --accent-hover: #0052cc;
}
```

### Custom Header

Create `.markopress/theme/components/Header.marko`:

```marko
<header class="custom-header">
  <nav class="navbar">
    <a href="/" class="logo">My Site</a>
    <ul class="nav-links">
      <li><a href="/">Home</a></li>
      <li><a href="/docs">Docs</a></li>
      <li><a href="/blog">Blog</a></li>
    </ul>
  </nav>
</header>

<style>`
  .custom-header {
    background: var(--bg-secondary);
    padding: 1rem 2rem;
    border-radius: 12px;
    margin-bottom: 2rem;
  }

  .navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logo {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--accent-color);
    text-decoration: none;
  }

  .nav-links {
    display: flex;
    gap: 2rem;
    list-style: none;
  }

  .nav-links a {
    color: var(--text-primary);
    text-decoration: none;
  }

  .nav-links a:hover {
    color: var(--accent-color);
  }
`</style>
```

## Step 7: Configure Your Site

Add navigation, footer, and site metadata.

### Complete Config

Edit `markopress.config.ts`:

```typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'My Site',
    description: 'My awesome site built with MarkoPress',
    base: '/',
    lang: 'en-US',
  },

  themeConfig: {
    navbar: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/guides/getting-started' },
      { text: 'Blog', link: '/blog' },
      { text: 'About', link: '/about' },
    ],

    sidebar: {
      '/guides/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guides/getting-started' },
            { text: 'Installation', link: '/guides/installation' },
          ],
        },
      ],
    },

    footer: {
      copyright: '© {year} My Site. All rights reserved.',
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

## Step 8: Build for Production

Create an optimized production build.

```bash
npm run build
```

This creates a `dist/` directory with:

- Minified HTML, CSS, and JavaScript
- Optimized assets
- Sitemap and robots.txt
- RSS feeds
- Open Graph tags

### Preview Production Build

```bash
npm run preview
```

Visit `http://localhost:4173` to see the production build.

## Step 9: Deploy Your Site

### Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

That's it! Your site is live.

### Deploy to Netlify

```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

### Deploy to GitHub Pages

1. Push your code to GitHub
2. Go to Settings → Pages
3. Select GitHub Actions as source
4. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## Next Steps

Congratulations! You've built and deployed your first MarkoPress site! 🎉

### Continue Learning

- 📖 [Configuration Guide](/guides/configuration)
- 🎨 [Theming Guide](/guides/theming)
- 🔌 [Plugin Development](/guides/plugins)
- 🚀 [Deployment Guide](/guides/deployment)

### Add More Features

- 🔍 Add search functionality
- 📊 Integrate analytics
- 💬 Add comments
- 🖼️ Create image galleries
- 🌍 Add multi-language support

### Common Tasks

**Add a new page:**
```bash
# Create file in content/pages/
echo "# New Page" > content/pages/new-page.md
```

**Add a blog post:**
```bash
# Create file in content/blog/
echo "---\ntitle: \"New Post\"\ndate: 2024-01-15\n---\n\n# Content" > content/blog/2024-01-15-new-post.md
```

**Change the theme:**
```bash
# Create custom styles
mkdir -p .markopress/theme
echo ":root { --accent-color: purple; }" > .markopress/theme/styles.css
```

## Troubleshooting

### Port Already in Use

```bash
# Use a different port
npm run dev -- --port 3000
```

### Build Errors

```bash
# Clean and rebuild
rm -rf node_modules dist package-lock.json
npm install
npm run build
```

### Styles Not Loading

Make sure your `.markopress/theme/styles.css` file is in the correct location and contains valid CSS.

### Pages Not Showing

Check that:
- Files are in the correct directories (`content/pages/`, `content/guides/`, `content/blog/`)
- Files have valid frontmatter (title, description)
- File paths in config match actual file locations

## Summary

In this tutorial, you learned how to:

1. ✅ Install and set up MarkoPress
2. ✅ Create pages, documentation, and blog posts
3. ✅ Customize your site's appearance
4. ✅ Configure navigation and sidebars
5. ✅ Build and deploy your site

Your site is now live and ready to share with the world!

## Resources

- [Documentation](/guides/getting-started)
- [GitHub](https://github.com/markopress/markopress)
- [Discord Community](https://discord.gg/markopress)
- [Examples](https://github.com/markopress/examples)

---

*Found this tutorial helpful? Subscribe to our [RSS feed](/api/rss/xml) for more content!*

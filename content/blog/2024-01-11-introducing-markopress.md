---
title: Introducing MarkoPress
description: A new static site generator powered by Marko.js v6
date: 2024-01-11
author: MarkoPress Team
tags: [announcement, marko, static-site-generator]
categories: [Announcements]
---

# Introducing MarkoPress

We're excited to introduce MarkoPress, a general-purpose static site generator powered by Marko.js v6!

## Why MarkoPress?

MarkoPress was built to bring the power of Marko.js to the world of static site generation. While tools like VitePress and Docusaurus are great, we wanted something that:

1. Uses the powerful Marko.js templating engine
2. Provides full TypeScript support out of the box
3. Has a flexible plugin system
4. Supports existing content from VitePress and Docusaurus

## Key Features

### Markdown + Frontmatter

Write your content in Markdown with YAML frontmatter, just like you're used to:

```yaml
---
title: My Post
description: This is my post
date: 2024-01-11
tags: [news, updates]
---
```

### File-based Routing

Your content structure automatically becomes your site structure:

```
content/
├── pages/
│   └── index.md        → /
├── docs/
│   └── guide.md        → /docs/guide
└── blog/
    └── 2024-01-11.md   → /blog/2024-01-11
```

### Plugin System

Extend MarkoPress with plugins for additional functionality:

```typescript
export default defineConfig({
  plugins: [
    '@markopress/plugin-content-blog',
    ['my-custom-plugin', { option: 'value' }],
  ],
});
```

### Theme System

Customize your site with theme overrides:

```
my-site/
└── .markopress/
    └── theme/
        └── layouts/
            └── docs.marko
```

## Getting Started

Install MarkoPress and create your first site:

```bash
npm install markopress
npx markopress init my-site
cd my-site
npm run dev
```

## What's Next?

We're actively developing MarkoPress and have many exciting features planned:

- Enhanced plugin ecosystem
- More theme options
- Improved performance
- Better tooling and documentation

Stay tuned for more updates!

## Get Involved

MarkoPress is open source and we welcome contributions. Check out our [GitHub repository](https://github.com) to get involved.

Happy building!

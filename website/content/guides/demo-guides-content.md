---
title: "Guide: Content Organization"
description: "Best practices for organizing and structuring your MarkoPress content"
order: 12
prev: /guides/demo-api-markdown
next: /guides/theming
---

# Guide: Content Organization

Learn how to effectively organize and structure your MarkoPress content for scalability, maintainability, and optimal user experience.

## Overview

Proper content organization is crucial for:

- 📁 Easy navigation and discovery
- 🔄 Scalable site structure
- 👥 Collaboration-friendly workflows
- 🚀 Consistent user experience
- 🔍 Better SEO performance

## Directory Structure

### Default Structure

```
your-site/
├── .markopress/
│   └── theme/              # Theme overrides
├── content/
│   ├── pages/              # General pages → /route
│   ├── docs/               # Documentation → /guides/route
│   └── blog/               # Blog posts → /blog/route
├── public/                 # Static assets
├── src/
│   ├── routes/             # Custom routes
│   └── tags/               # Custom components
└── markopress.config.ts    # Site configuration
```

### Content Types

Each directory serves a specific purpose:

**`content/pages/`** - General pages (About, Contact, Home)
**`content/guides/`** - Documentation (Guides, API Reference, Tutorials)
**`content/blog/`** - Blog posts (News, Tutorials, Updates)

## Naming Conventions

### Files

Use kebab-case for filenames:

```markdown
✅ good-file-name.md
❌ Bad File Name.md
❌ bad_file_name.md
❌ badFileName.md
```

### Dates for Blog Posts

Use `YYYY-MM-DD` prefix for blog posts:

```
content/blog/
├── 2024-01-15-first-post.md
├── 2024-01-20-second-post.md
└── 2024-02-03-third-post.md
```

### Index Files

Use `index.md` for directory roots:

```
content/guides/
├── index.md              # → /docs
├── guide/
│   └── index.md          # → /guides/guide
```

## Content Type Guidelines

### Pages

**Purpose:** General site pages (About, Contact, Pricing)

**Location:** `content/pages/`

**URL Pattern:** `/{filename}`

**Example:**

```
content/pages/
├── index.md              # → /
├── about.md              # → /about
├── contact.md            # → /contact
└── pricing.md            # → /pricing
```

**Best Practices:**

- Keep pages focused on single topics
- Use descriptive filenames
- Include SEO metadata
- Keep content under 1500 words if possible

### Documentation

**Purpose:** Guides, API docs, tutorials

**Location:** `content/guides/`

**URL Pattern:** `/guides/{path}`

**Example:**

```
content/guides/
├── index.md                      # → /docs
├── getting-started.md            # → /guides/getting-started
├── installation.md               # → /guides/installation
├── configuration.md              # → /guides/configuration
├── api/
│   ├── index.md                  # → /guides/api
│   ├── routing.md                # → /guides/api/routing
│   └── markdown.md               # → /guides/api/markdown
└── guides/
    ├── theming.md                # → /guides/guides/theming
    └── plugins.md                # → /guides/guides/plugins
```

**Organization Patterns:**

**By User Journey:**
```
content/guides/
├── getting-started/
├── basic-concepts/
├── advanced-features/
└── reference/
```

**By Feature:**
```
content/guides/
├── installation/
├── configuration/
├── components/
└── deployment/
```

**By Audience:**
```
content/guides/
├── users/
├── developers/
└── administrators/
```

**Best Practices:**

- Use `order` frontmatter for sidebar ordering
- Group related docs in subdirectories
- Create index pages for each section
- Cross-reference related content

### Blog Posts

**Purpose:** News, tutorials, thoughts

**Location:** `content/blog/`

**URL Pattern:** `/blog/{filename-without-date}`

**Example:**

```
content/blog/
├── 2024-01-15-announcement.md     # → /blog/announcement
├── 2024-01-20-tutorial-part1.md   # → /blog/tutorial-part1
├── 2024-01-27-tutorial-part2.md   # → /blog/tutorial-part2
└── 2024-02-03-case-study.md       # → /blog/case-study
```

**Best Practices:**

- Use date prefix for chronological ordering
- Include date, author, tags in frontmatter
- Keep posts under 2000 words
- Use categories for broad grouping
- Use tags for specific topics

## Frontmatter Strategy

### Required Fields

All content should have:

```yaml
---
title: "Page Title"
description: "Page description for SEO"
---
```

### Blog Posts

```yaml
---
title: "Post Title"
description: "Post description"
date: 2024-01-15
author: "Author Name"
tags: ["tag1", "tag2"]
categories: ["Category"]
excerpt: "Brief summary"
---
```

### Documentation

```yaml
---
title: "Page Title"
description: "Page description"
order: 1                      # For sidebar ordering
prev: /guides/previous-page      # Previous page link
next: /guides/next-page          # Next page link
---
```

## Navigation Structure

### Top-Level Navigation

Keep nav items to 5-7 maximum:

```typescript
navbar: [
  { text: 'Home', link: '/' },
  { text: 'Docs', link: '/docs' },
  { text: 'Blog', link: '/blog' },
  { text: 'About', link: '/about' },
  { text: 'Contact', link: '/contact' },
]
```

### Sidebar Structure

Organize docs into logical groups:

```typescript
sidebar: {
  '/guides/': [
    {
      text: 'Getting Started',
      items: [
        { text: 'Introduction', link: '/guides/intro' },
        { text: 'Installation', link: '/guides/install' },
        { text: 'Quick Start', link: '/guides/quick-start' },
      ],
    },
    {
      text: 'Core Concepts',
      collapsed: true,  // Collapsed by default
      items: [
        { text: 'Architecture', link: '/guides/architecture' },
        { text: 'Routing', link: '/guides/routing' },
        { text: 'Rendering', link: '/guides/rendering' },
      ],
    },
  ],
}
```

## Content Length Guidelines

### Pages

| Type | Recommended Length |
|------|-------------------|
| Homepage | 300-500 words |
| About | 500-800 words |
| Pricing | 400-600 words |
| Contact | 200-400 words |

### Documentation

| Type | Recommended Length |
|------|-------------------|
| Overview | 500-800 words |
| Tutorial | 1000-2000 words |
| API Reference | 300-600 words per endpoint |
| Guide | 800-1500 words |

### Blog Posts

| Type | Recommended Length |
|------|-------------------|
| News/Updates | 300-600 words |
| Tutorials | 1000-2000 words |
| Case Studies | 1200-2500 words |
| Opinion/Thoughts | 800-1500 words |

## Taxonomy Strategy

### Categories

Use categories for broad groupings (3-5 maximum):

```yaml
categories: ["Tutorials"]      # Good
categories: ["Web Development"] # Good
categories: ["post"]            # Too generic
```

**Recommended Categories:**

- Tutorials
- News/Updates
- Case Studies
- Best Practices
- Release Notes

### Tags

Use tags for specific topics (unlimited):

```yaml
tags: ["performance", "optimization", "vite"]
```

**Tag Strategy:**

- Use consistent tag names
- Prefer kebab-case: `web-development`
- Avoid singular/plural duplicates
- Use descriptive tags: `performance` not `perf`

## Cross-References

### Internal Links

Link to related content:

```markdown
See [Installation](/guides/installation) for setup instructions.

Learn more in the [Theming Guide](/guides/theming).
```

### Related Content Sections

Add related content at the end:

```markdown
## Related Content

- [Getting Started](/guides/getting-started)
- [Configuration](/guides/configuration)
- [Deployment](/guides/deployment)
```

### See Also Blocks

```markdown
> **See Also**
>
> - [API Reference](/guides/api)
> - [Examples](/guides/examples)
```

## Media Organization

### Images

Organize images by content type:

```
public/
├── images/
│   ├── blog/
│   │   ├── 2024-01-15-post/
│   │   └── 2024-01-20-post/
│   ├── docs/
│   │   ├── installation.png
│   │   └── configuration.jpg
│   └── general/
│       ├── logo.png
│       └── hero.jpg
```

### File Naming

Use descriptive names:

```
✅ blog-post-hero-image.jpg
✅ installation-step1-screenshot.png
❌ IMG_1234.jpg
� Untitled.png
```

## Content Migration

### From Other Platforms

**VitePress:**

```bash
# Copy docs
cp -r docs/* content/guides/

# Copy blog
cp -r blog/* content/blog/
```

**Docusaurus:**

```bash
# Copy docs
cp -r docs/* content/guides/

# Copy blog (from blog/ to content/blog/)
cp -r blog/* content/blog/

# Copy static assets
cp -r static/* public/
```

## Scalability Patterns

### Large Documentation Sites

**Structure:**

```
content/guides/
├── index.md
├── getting-started/
│   ├── index.md
│   ├── installation.md
│   └── configuration.md
├── concepts/
│   ├── index.md
│   ├── architecture.md
│   └── data-flow.md
├── guides/
│   ├── index.md
│   ├── basic-usage.md
│   └── advanced-features.md
├── api/
│   ├── index.md
│   ├── routes.md
│   └── components.md
├── reference/
│   ├── index.md
│   ├── config.md
│   └── cli.md
└── resources/
    ├── index.md
    ├── examples.md
    └── faq.md
```

**Configuration:**

```typescript
sidebar: {
  '/guides/': [
    { text: 'Getting Started', link: '/guides/getting-started' },
    { text: 'Concepts', link: '/guides/concepts' },
    { text: 'Guides', link: '/guides/guides' },
    { text: 'API', link: '/guides/api' },
    { text: 'Reference', link: '/guides/reference' },
    { text: 'Resources', link: '/guides/resources' },
  ],
}
```

### Multi-Author Blogs

```
content/
├── authors/
│   ├── jane.md
│   ├── john.md
│   └── team.md
└── blog/
    ├── 2024-01-15-post-by-jane.md   # author: "jane"
    └── 2024-01-20-post-by-john.md   # author: "john"
```

**`content/authors/jane.md`:**

```yaml
---
name: "Jane Developer"
bio: "Full-stack developer"
avatar: "/authors/jane.jpg"
twitter: "@janedev"
website: "https://jane.dev"
---
```

## Maintenance

### Content Audits

Perform regular content audits:

**Quarterly:**
- Review outdated content
- Update broken links
- Refresh old screenshots
- Add missing metadata

**Annually:**
- Reorganize structure if needed
- Archive old content
- Update style guide
- Review analytics

### Content Lifecycle

```yaml
---
title: "Post Title"
status: "published"    # published, archived, draft
lastReviewed: 2024-01-15
nextReview: 2024-07-15
---
```

## Versioning

### API Documentation

Version your API docs:

```
content/guides/
├── api/
│   ├── v1/
│   │   ├── endpoints.md
│   │   └── schemas.md
│   ├── v2/
│   │   ├── endpoints.md
│   │   └── schemas.md
│   └── index.md
```

## Best Practices Summary

### ✅ Do

- Use kebab-case for filenames
- Include descriptive frontmatter
- Organize by content type
- Create index pages for sections
- Cross-reference related content
- Keep URLs short and meaningful
- Use consistent terminology
- Regular content audits

### ❌ Don't

- Use spaces in filenames
- Bury important content deep in structure
- Create orphan pages (no links to them)
- Use duplicate content across pages
- Ignore SEO metadata
- Mix content types in same directory
- Use cryptic file names
- Over-categorize

## Examples

### Small Site Structure

```
content/
├── pages/
│   ├── index.md
│   ├── about.md
│   └── contact.md
└── blog/
    ├── 2024-01-15-first-post.md
    └── 2024-01-20-second-post.md
```

### Medium Site Structure

```
content/
├── pages/
│   ├── index.md
│   ├── about.md
│   ├── pricing.md
│   └── contact.md
├── docs/
│   ├── index.md
│   ├── getting-started.md
│   ├── configuration.md
│   ├── theming.md
│   └── deployment.md
└── blog/
    ├── 2024-01-15-news.md
    ├── 2024-01-20-tutorial.md
    └── 2024-01-25-case-study.md
```

### Large Site Structure

```
content/
├── pages/
│   ├── index.md
│   ├── about.md
│   ├── pricing.md
│   ├── contact.md
│   └── team.md
├── docs/
│   ├── getting-started/
│   ├── concepts/
│   ├── guides/
│   ├── api/
│   ├── reference/
│   └── resources/
└── blog/
    ├── 2024/
    │   ├── 01/
    │   │   ├── 15-news.md
    │   │   ├── 20-tutorial.md
    │   │   └── 25-case-study.md
    │   └── 02/
    │       └── 01-update.md
    └── authors/
        └── team.md
```

## Tools

### Content Validation

Validate frontmatter:

```typescript
// plugins/validate-frontmatter.ts
export default function validateFrontmatter() {
  return {
    name: 'validate-frontmatter',
    contentLoaded(ctx) {
      const pages = ctx.getPages();

      for (const page of pages) {
        if (!page.frontmatter.title) {
          ctx.utils.warn(`Missing title: ${page.filePath}`);
        }
        if (!page.frontmatter.description) {
          ctx.utils.warn(`Missing description: ${page.filePath}`);
        }
      }
    },
  };
}
```

## Next Steps

- 🎨 Learn about [Theming](/guides/theming)
- 🔌 Build [Plugins](/guides/plugins)
- 📖 Read [API Reference](/guides/api)

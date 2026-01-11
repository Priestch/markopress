---
title: "Custom Content Directories"
description: "How to use custom content directories with MarkoPress"
order: 2
---

# Using Custom Content Directories

By default, MarkoPress looks for content in the `content/` directory. However, you can customize this to match your project structure.

## Why Use Custom Directories?

- **Multi-project repos**: Separate documentation from main site
- **Legacy migration**: Keep existing content structure
- **Organizational preference**: Match your team's conventions
- **Multiple content sources**: Combine content from different locations

## Configuration Options

### Basic Configuration

```typescript
// markopress.config.ts
export default defineConfig({
  content: {
    pages: 'my-content/pages',
    docs: 'my-content/docs',
    blog: 'my-content/blog',
  },
});
```

### Absolute Paths

You can also use absolute paths:

```typescript
import path from 'path';

export default defineConfig({
  content: {
    pages: path.resolve(__dirname, 'custom-content/pages'),
    docs: path.resolve(__dirname, 'custom-content/docs'),
    blog: path.resolve(__dirname, 'custom-content/blog'),
  },
});
```

### Parent Directory

Reference content from a parent directory:

```typescript
export default defineConfig({
  content: {
    pages: '../shared-content/pages',
    docs: '../shared-content/docs',
    blog: '../shared-content/blog',
  },
});
```

## Mapped Routes

Regardless of where your content is located, the routes remain the same:

| Content Location | Route | Example File | URL |
|-----------------|-------|--------------|-----|
| `my-content/pages/` | `/` | `index.md` | `/` |
| `my-content/pages/` | `/` | `about.md` | `/about` |
| `my-content/docs/` | `/docs/*` | `intro.md` | `/docs/intro` |
| `my-content/blog/` | `/blog/*` | `post.md` | `/blog/post` |

## Best Practices

1. **Keep it simple**: Use relative paths when possible
2. **Document your structure**: Add a README explaining your directory layout
3. **Consistent naming**: Use clear, descriptive directory names
4. **Version control**: Commit your `.markopress` config file

## Example: Monorepo Setup

For a monorepo with multiple sites:

```
company-repo/
├── packages/
│   ├── main-site/
│   │   ├── markopress.config.ts  → content: '../../content/main'
│   │   └── package.json
│   ├── docs-site/
│   │   ├── markopress.config.ts  → content: '../../content/docs'
│   │   └── package.json
│   └── blog-site/
│       ├── markopress.config.ts  → content: '../../content/blog'
│       └── package.json
└── content/
    ├── main/
    ├── docs/
    └── blog/
```

This setup allows multiple sites to share or separate content as needed.

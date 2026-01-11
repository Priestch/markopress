---
title: "Introduction"
description: "Getting started with MarkoPress"
order: 1
---

# Getting Started with MarkoPress

This documentation site is using a **custom content directory** called `my-content/docs/`.

## Configuration

To use a custom content directory, configure it in `markopress.config.ts`:

```typescript
export default defineConfig({
  content: {
    pages: 'my-content/pages',
    docs: 'my-content/docs',
    blog: 'my-content/blog',
  },
});
```

## Directory Structure

Your project structure looks like:

```
test-project/
├── markopress.config.ts
├── package.json
└── my-content/
    ├── pages/
    │   └── index.md
    ├── docs/
    │   ├── intro.md
    │   └── custom-dir.md
    └── blog/
        └── 2024-01-11-test-post.md
```

## Next Steps

- Read about [custom directories](/docs/custom-dir)
- Check the [blog](/blog)

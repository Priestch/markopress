---
title: Getting Started
description: Get started with MarkoPress in minutes
order: 1
---

# Getting Started with MarkoPress

Welcome! This guide will help you get started with MarkoPress.

## Installation

```bash
npm install markopress
```

## Quick Start

1. Create a `markopress.config.ts` file:

```typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'My Site',
    description: 'Welcome to my site',
  },
  content: {
    pages: 'content/pages',
    docs: 'content/docs',
    blog: 'content/blog',
  },
});
```

2. Create your content in the `content/` directory

3. Start the development server:

```bash
npm run dev
```

## Next Steps

- Learn about [configuration](/guides/configuration)
- Explore [themes](/guides/theming)
- Build [plugins](/guides/plugins)

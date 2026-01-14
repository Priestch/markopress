---
title: Advanced Features Overview
order: 10
---

# Advanced Features

MarkoPress comes with many advanced features out of the box.

## Markdown Extensions

### Custom Containers

Use custom containers to highlight content:

::: tip
This is a tip container for helpful hints.
:::

::: warning
This is a warning for important notes.
:::

::: danger
This is a danger warning for critical issues.
:::

### Code Features

Enhanced code blocks with line highlighting:

```javascript {1,3-5}
function hello(name) {
  console.log(`Hello, ${name}!`);
  return true;
}
```

Line numbers are enabled by default.

## Frontmatter

All markdown files support frontmatter:

```yaml
---
title: My Page
description: Page description
draft: false
tags:
  - guide
  - tutorial
---
```

## Syntax Highlighting

MarkoPress uses Shiki for beautiful syntax highlighting with support for 50+ languages.

## Next Steps

- Learn about [Markdown Options](/docs/advanced/markdown)
- Explore [Build Configuration](/docs/advanced/build)
- Check the [API Reference](/docs/api/routes)

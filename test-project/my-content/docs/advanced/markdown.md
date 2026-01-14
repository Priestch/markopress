---
title: Markdown Options
order: 20
---

# Markdown Options

Configure how MarkoPress processes markdown content.

## Line Numbers

Enable or disable line numbers globally:

```javascript
markdown: {
  lineNumbers: true,
}
```

Disable for specific blocks:

``````markdown
```javascript no-line-numbers
const x = 1;
```
``````

## Syntax Themes

Configure light and dark themes:

```javascript
markdown: {
  theme: {
    light: 'github-light',
    dark: 'github-dark',
  },
}
```

Available themes:
- `github-light`, `github-dark`
- `monokai`, `nord`
- `dracula`, `material`

## Custom Containers

Configure custom container types:

```javascript
markdown: {
  containers: {
    tip: '💡 Tip',
    warning: '⚠️ Warning',
    danger: '🚨 Danger',
    info: 'ℹ️ Info',
  },
}
```

## Headers

Headers automatically generate:
- Anchor links for navigation
- Table of contents data
- Breadcrumb trails

See also:
- [Advanced Features Overview](/docs/advanced/overview)
- [API Reference](/docs/api/markdown)

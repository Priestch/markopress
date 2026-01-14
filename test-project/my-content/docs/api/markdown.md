---
title: Markdown API
order: 20
---

# Markdown API

Programmatic API for markdown processing.

## parseMarkdown()

Parse markdown content to HTML:

```javascript
import { parseMarkdown } from 'markopress/markdown';

const result = await parseMarkdown('# Hello\n\nWorld!');
// Returns: { html, headers, frontmatter }
```

## Options

Configure parsing behavior:

```javascript
const result = await parseMarkdown(content, {
  lineNumbers: true,
  theme: 'github-light',
});
```

## Result Object

```typescript
interface MarkdownResult {
  html: string;           // Rendered HTML
  headers: Header[];      // Document headers
  frontmatter: {         // Parsed frontmatter
    title?: string;
    description?: string;
    [key: string]: any;
  };
}
```

## Headers

Headers structure for TOC:

```typescript
interface Header {
  level: number;      // 1-6
  title: string;      // Header text
  id: string;         // Anchor ID
  children: Header[]; // Nested headers
}
```

## Extensions

Built-in markdown extensions:
- GitHub Flavored Markdown
- Custom containers
- Syntax highlighting
- Emoji support
- Task lists

See also:
- [Routes API](/docs/api/routes)
- [Build API](/docs/api/build)

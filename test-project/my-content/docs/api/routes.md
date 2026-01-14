---
title: Routes API
order: 10
---

# API Reference

Technical reference for MarkoPress APIs.

## Routes API

### Page Routes

Pages in `content/pages/` become root-level routes:

```
content/pages/
  about.md → /about
  contact.md → /contact
```

### Doc Routes

Docs in `content/docs/` become `/docs/*` routes:

```
content/docs/
  guide.md → /docs/guide
  api.md → /docs/api
```

### Blog Routes

Blog posts in `content/blog/` become `/blog/*` routes:

```
content/blog/
  2024-01-11-post.md → /blog/2024-01-11-post
```

## Route Handlers

Access route data via context:

```javascript
// +handler.js
export async function GET(context) {
  context.title = 'Page Title';
  context.description = 'Page description';
  context.headers = [{ level: 1, title: 'Heading' }];
}
```

## Route Templates

Marko templates use `+page.marko`:

```marko
<div class="page">
  <h1>${$global.title}</h1>
  <div class="content" no-parse>
    <!-- Content injected here -->
  </div>
</div>
```

## Layouts

Use `+layout.marko` for page wrappers:

```marko
<html>
  <body>
    <${input.content}/>
  </body>
</html>
```

See also:
- [Configuration](/docs/configuration)
- [Markdown API](/docs/api/markdown)
- [Build API](/docs/api/build)

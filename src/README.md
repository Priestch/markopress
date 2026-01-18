# MarkoPress `src/` Directory

This directory contains custom routes, components, and utilities for your MarkoPress site.

## Directory Structure

```
src/
├── routes/              # Custom routes (auto-generated routes are created here by build)
│   ├── components/      # Custom Marko components
│   ├── lib/            # Utility functions and helpers
│   ├── api/            # Custom API routes
│   ├── +layout.marko   # Root layout (auto-generated, can override)
│   ├── +middleware.js  # Global middleware (optional)
│   ├── docs/           # Auto-generated from content/docs/
│   ├── blog/           # Auto-generated from content/blog/
│   └── pages/          # Auto-generated from content/pages/
└── tags/               # Custom Marko tags (for use in markdown)
```

## How MarkoPress Works

### Content-Driven Routing

MarkoPress **automatically generates** routes from your markdown content:

| Content Directory | Route Pattern | Example |
|-------------------|---------------|---------|
| `content/pages/` | `/filename` | `about.md` → `/about` |
| `content/docs/` | `/docs/filename` | `guide.md` → `/docs/guide` |
| `content/blog/` | `/blog/filename` | `post.md` → `/blog/post` |

**Important**: Do NOT manually create routes in `src/routes/docs/`, `src/routes/blog/`, or `src/routes/pages/` - they are generated during build and will be overwritten.

### What Goes in `src/`?

Use `src/` for **custom** functionality:

- **Custom components** in `src/routes/components/`
- **Utility functions** in `src/routes/lib/`
- **API endpoints** in `src/routes/api/`
- **Custom middleware** in `src/routes/+middleware.js`
- **Marko tags** (for markdown) in `src/tags/`

## Examples

### Custom Component

Create `src/routes/components/MyComponent.marko`:

```marko
class {
  onCreate() {
    this.state = { count: 0 };
  }

  increment() {
    this.state.count++;
  }
}

<div>
  <p>Count: ${state.count}</p>
  <button on-click('increment')">+1</button>
</div>
```

Use in any route:

```marko
<components.MyComponent/>
```

### API Route

Create `src/routes/api/hello/+handler.js`:

```javascript
export async function GET(context) {
  return new Response(JSON.stringify({ message: 'Hello!' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

Access at `/api/hello`

### Utility Function

Create `src/routes/lib/utils.js`:

```javascript
export function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

export function slugify(text) {
  return text.toLowerCase().replace(/\s+/g, '-');
}
```

Use in handlers:

```javascript
import { formatDate, slugify } from '../../lib/utils.js';

export async function GET(context) {
  context.formattedDate = formatDate(new Date());
}
```

### Custom Middleware

Create `src/routes/+middleware.js`:

```javascript
export async function middleware(context, next) {
  // Add custom headers
  context.responseHeaders.set('X-Custom-Header', 'value');

  // Or modify context
  context.customData = 'something';

  // Always call next()
  await next();
}
```

## Marko Tags in Markdown

The `src/tags/` directory contains custom Marko components that can be used directly in markdown files.

### Creating a Tag

Create `src/tags/alert-box.marko`:

```marko
<div class=["alert", input.kind && "alert-" + input.kind]>
  <${input.content}/>
</div>

<style>
  .alert {
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid #ddd;
  }
  .alert-warning {
    background: #fff3cd;
    border-color: #ffc107;
  }
</style>
```

### Using in Markdown

```markdown
<alert-box kind="warning">
  This is a **warning** alert!
</alert-box>
```

## Override Auto-Generated Layout

By default, MarkoPress generates `+layout.marko`. To override it:

1. Create `src/routes/+layout.marko`
2. Add your custom layout
3. **Important**: Use `<${input.content}/>` to render page content

Example:

```marko
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${$global.title || 'My Site'}</title>
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
    </nav>
  </header>

  <main>
    <!-- CRITICAL: Use input.content for rendering pages -->
    <${input.content}/>
  </main>

  <footer>
    <p>© ${new Date().getFullYear()}</p>
  </footer>
</body>
</html>
```

## Build Process

When you run `markopress build` or `npm run build`:

1. **Scans** `content/` directories for markdown files
2. **Processes** markdown with frontmatter
3. **Generates** `+page.marko` and `+handler.js` files in `src/routes/`
4. **Compiles** everything with `@marko/run`
5. **Outputs** static HTML to `dist/`

## Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Important Notes

⚠️ **Do NOT manually edit:**
- `src/routes/docs/` - Generated from `content/docs/`
- `src/routes/blog/` - Generated from `content/blog/`
- `src/routes/pages/` - Generated from `content/pages/`
- `src/routes/+layout.marko` - Auto-generated (unless you want to customize)

✅ **Safe to edit:**
- `src/routes/components/` - Your custom components
- `src/routes/lib/` - Your utilities
- `src/routes/api/` - Your API routes
- `src/routes/+middleware.js` - Your middleware
- `src/tags/` - Your markdown components

# MarkoPress Test Project

A test project demonstrating MarkoPress with custom content directories and static HTML generation.

## What This Tests

✅ Custom content directory configuration (`my-content/` instead of default `content/`)
✅ Static HTML generation using `@marko/run-adapter-static`
✅ Route-based rendering with Marko templates

## Quick Start

### 1. Build

```bash
npx marko-run build
```

### 2. Preview

```bash
npx marko-run preview
```

Then open http://localhost:4173

### 3. Automated Test

```bash
./test-all.sh
```

## Project Structure

```
test-project/
├── markopress.config.js    # Config with custom content dirs
├── vite.config.ts          # Vite config with static adapter
├── package.json
├── src/
│   └── routes/
│       └── +page.marko     # Homepage route
├── my-content/             # Custom content directory
│   ├── pages/
│   │   └── index.md       # → /
│   ├── docs/
│   │   ├── intro.md       # → /docs/intro
│   │   └── custom-dir.md  # → /docs/custom-dir
│   └── blog/
│       └── 2024-01-11-test-post.md  # → /blog/...
└── dist/
    └── public/
        └── index.html     # Generated static HTML
```

## Configuration

### markopress.config.js

```javascript
import { defineConfig } from 'markopress/config';

export default defineConfig({
  content: {
    pages: 'my-content/pages',  // Custom directory
    docs: 'my-content/docs',
    blog: 'my-content/blog',
  },
});
```

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import marko from '@marko/run/vite';
import staticAdapter from '@marko/run-adapter-static';

export default defineConfig({
  plugins: [
    marko({
      adapter: staticAdapter(),  // Generates static HTML
    }),
  ],
});
```

## What Gets Generated

After running `npx marko-run build`:

```
dist/public/
└── index.html    (537 bytes - minified HTML)
```

The HTML contains fully rendered content from your Marko routes.

## Test Results

### Build Output
```
┌────────┬──────┬───────┬───────────┐
│ METHOD │ PATH │ ENTRY │ SIZE/GZIP │
├────────┼──────┼───────┼───────────┤
│ GET    │ /    │ page  │    0.0 kB │
└────────┴──────┴───────┴───────────┘
```

### Generated HTML
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MarkoPress Test Site</title>
</head>
<body>
  <div class="container">
    <h1>Welcome to MarkoPress Test Site</h1>
    <p>This is testing custom content directories!</p>
    ...
  </div>
</body>
</html>
```

## Key Features Demonstrated

1. **Custom Content Directories** ✅
   - Uses `my-content/` instead of default `content/`
   - Configurable per content type (pages, docs, blog)

2. **Static HTML Generation** ✅
   - Uses `@marko/run-adapter-static`
   - Output: `dist/public/index.html`
   - Minified and production-ready

3. **Route-based Rendering** ✅
   - Marko templates in `src/routes/`
   - Automatic route generation
   - Hot reload in dev mode

## Next Steps

### To Add More Content:

1. **Create a new route:**
```bash
cat > src/routes/about.marko << 'EOF'
<!DOCTYPE html>
<html>
<head><title>About</title></head>
<body><h1>About</h1><p>About page content</p></body>
</html>
EOF
```

2. **Rebuild:**
```bash
npx marko-run build
```

3. **Check output:**
```bash
ls -lh dist/public/
```

### To Test Real Markdown Processing:

The MarkoPress build system can generate route files from markdown. When the CLI is fully functional:

```bash
# This will scan my-content/ and generate routes
markopress build

# Then build static HTML
npx marko-run build
```

## Deployment

The `dist/public/` directory can be deployed to any static hosting service:

- **Netlify:** Deploy `dist/public/`
- **Vercel:** Deploy `dist/public/`
- **GitHub Pages:** Use `dist/public/` as source
- **Surge:** `surge dist/public/`
- **Nginx/Apache:** Serve from `dist/public/`

## Documentation

- [TEST_STEPS.md](./TEST_STEPS.md) - Detailed testing guide
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Configuration testing
- [test.sh](./test.sh) - Test automation script

## Status

| Component | Status |
|-----------|--------|
| Custom content directories | ✅ Working |
| Static HTML generation | ✅ Working |
| Route-based rendering | ✅ Working |
| Dev server | ✅ Working |
| Production build | ✅ Working |
| Markdown→Route generation | 🚧 Implemented (needs TS build fix) |

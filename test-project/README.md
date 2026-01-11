# Testing MarkoPress with Custom Content Directories

This test project demonstrates how to use MarkoPress with custom content directories.

## What Was Tested

✅ **Custom Content Directory Configuration**
- Using `my-content/` instead of default `content/`
- Separate directories for pages, docs, and blog
- All content types detected and routed correctly

## Project Structure

```
test-project/
├── markopress.config.js    # Configuration with custom content dirs
├── package.json
└── my-content/             # Custom content directory
    ├── pages/
    │   └── index.md
    ├── docs/
    │   ├── intro.md
    │   └── custom-dir.md
    └── blog/
        └── 2024-01-11-test-post.md
```

## Configuration

To use custom content directories, specify them in `markopress.config.js`:

```javascript
import { defineConfig } from 'markopress/config';

export default defineConfig({
  content: {
    pages: 'my-content/pages',
    docs: 'my-content/docs',
    blog: 'my-content/blog',
  },
});
```

## Results

Build output shows content is detected correctly:

```
📂 Scanning content directories...
   Found 1 pages
   Found 2 docs
   Found 1 blog posts

Pages routes:
  / ← my-content/pages/index.md
Docs routes:
  /docs/custom-dir ← my-content/docs/custom-dir.md
  /docs/intro ← my-content/docs/intro.md
Blog routes:
  /blog/2024-01-11-test-post ← my-content/blog/2024-01-11-test-post.md
```

## How to Test

### Build

```bash
cd test-project
pnpm install
pnpm exec markopress build
```

### Build with Debug

```bash
pnpm exec markopress build --debug
```

## Notes

- Config file must be `.js` or `.mjs` (not `.ts`) for now
- MarkoPress successfully reads configuration
- Content scanning works with custom directories
- URL generation is correct

## Current Limitations

The build system scans content but doesn't yet generate actual route files. A full implementation would:

1. Generate Marko route files in `src/routes/`
2. Create virtual components for markdown content
3. Apply theme layouts
4. Build static HTML with @marko/run

This test demonstrates that the **configuration and content scanning** parts work correctly with custom directories.

---
title: Build API
order: 30
---

# Build API

Programmatic API for building sites.

## build()

Build your site programmatically:

```javascript
import { build } from 'markopress/build';

const result = await build({
  outDir: 'dist',
  debug: false,
});

console.log(`Built ${result.pages} pages`);
```

## Build Options

```typescript
interface BuildOptions {
  outDir?: string;    // Output directory
  debug?: boolean;    // Enable debug logging
}
```

## Build Result

```typescript
interface BuildResult {
  success: boolean;   // Build success status
  outDir: string;     // Output directory path
  pages: number;      // Total pages built
  errors: string[];   // Build errors
}
```

## Build Process

The build process consists of:

1. Load configuration
2. Scan content directories
3. Generate route files
4. Build with @marko/run
5. Optimize output

## Hooks

Use hooks to customize the build:

```javascript
export default defineConfig({
  plugins: [
    {
      name: 'my-plugin',
      beforeBuild(ctx) {
        console.log('Building...');
      },
      afterBuild(ctx) {
        console.log('Done!');
      },
    },
  ],
});
```

See also:
- [Routes API](/docs/api/routes)
- [Markdown API](/docs/api/markdown)

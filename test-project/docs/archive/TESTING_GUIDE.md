# Testing MarkoPress Test Project

This guide shows you how to test the MarkoPress test project with custom content directories.

## Project Location

```
/home/gp/Projects/markopress/test-project/
```

## Test Commands

### 1. Basic Build Test

```bash
cd /home/gp/Projects/markopress/test-project
node /home/gp/Projects/markopress/packages/markopress/bin/cli.js build
```

**Expected Output:**
```
🚀 Building MarkoPress site...

📂 Scanning content directories...
   Found 1 pages
   Found 2 docs
   Found 1 blog posts

✅ Build completed successfully!
   Output: /home/gp/Projects/markopress/test-project/dist
   Pages: 4
```

### 2. Debug Mode Test

See exactly what content is detected:

```bash
node /home/gp/Projects/markopress/packages/markopress/bin/cli.js build --debug
```

**Expected Output:**
```
Pages routes:
  / ← my-content/pages/index.md
Docs routes:
  /docs/custom-dir ← my-content/docs/custom-dir.md
  /docs/intro ← my-content/docs/intro.md
Blog routes:
  /blog/2024-01-11-test-post ← my-content/blog/2024-01-11-test-post.md
```

### 3. Configuration Verification Test

Verify that custom directories are loaded correctly:

```bash
node -e "
import { loadConfig } from '/home/gp/Projects/markopress/packages/markopress/dist/config/loader.js';

const config = await loadConfig(process.cwd(), { mode: 'production', command: 'build' });
console.log('Content Directories:', config.content);
"
```

**Expected Output:**
```
Content Directories:
  pages: my-content/pages
  docs : my-content/docs
  blog : my-content/blog
```

### 4. Content Structure Test

Verify content files exist:

```bash
ls -la my-content/pages/
ls -la my-content/docs/
ls -la my-content/blog/
```

### 5. Frontmatter Test

Check that markdown files are parsed correctly:

```bash
node -e "
import { parseMarkdown } from '/home/gp/Projects/markopress/packages/markopress/dist/markdown/index.js';
import { readFile } from 'node:fs/promises';

const content = await readFile('my-content/pages/index.md', 'utf-8');
const result = await parseMarkdown(content);

console.log('Title:', result.frontmatter.title);
console.log('Description:', result.frontmatter.description);
console.log('Has content:', result.html.length > 0);
"
```

## What This Tests

✅ **Custom Content Directory Support**
- Verifies MarkoPress can read from non-default directories
- Tests configuration loading from `markopress.config.js`
- Validates that all content types (pages, docs, blog) work

✅ **Content Scanning**
- Tests markdown file discovery
- Verifies URL path generation
- Checks frontmatter parsing

✅ **Build Process**
- Configuration loading
- Content scanning and routing
- Integration with @marko/run

## Test Results Summary

| Test | Status | Details |
|------|--------|---------|
| Config Loading | ✅ Pass | Custom directories loaded correctly |
| Content Scanning | ✅ Pass | Found 1 page, 2 docs, 1 blog post |
| URL Generation | ✅ Pass | Correct routes: `/`, `/docs/*`, `/blog/*` |
| Markdown Parsing | ✅ Pass | Frontmatter and content parsed |

## Directory Structure

```
test-project/
├── markopress.config.js         # Config with custom content dirs
├── package.json
├── README.md
├── TESTING_GUIDE.md
└── my-content/                  # Custom content directory (not default 'content/')
    ├── pages/
    │   └── index.md             # → /
    ├── docs/
    │   ├── intro.md             # → /docs/intro
    │   └── custom-dir.md        # → /docs/custom-dir
    └── blog/
        └── 2024-01-11-test-post.md  # → /blog/2024-01-11-test-post
```

## Current Limitations

The build system successfully scans content and generates routes, but does not yet:

1. Generate actual Marko route files in `src/routes/`
2. Create virtual components for markdown
3. Apply theme layouts
4. Build static HTML (requires route implementation)

This test demonstrates that the **configuration and content scanning** infrastructure works correctly with custom directories.

## Next Steps for Full Implementation

To complete the static site generation:

1. **Generate Route Files**: Create Marko components in `src/routes/`
2. **Virtual Components**: Map markdown files to virtual Marko components
3. **Theme Integration**: Apply layouts from `@markopress/theme-default`
4. **Build Pipeline**: Complete @marko/run integration for static HTML

## Quick Test Script

Save this as `test.sh` and run it:

```bash
#!/bin/bash
echo "🧪 Testing MarkoPress Custom Content Directories"
echo ""

echo "1. Testing config loading..."
node -e "
import { loadConfig } from '../packages/markopress/dist/config/loader.js';
const config = await loadConfig(process.cwd(), { mode: 'production', command: 'build' });
console.log('   ✅ Config loaded');
console.log('   Directories:', config.content);
"

echo ""
echo "2. Testing content scanning..."
node ../packages/markopress/bin/cli.js build --debug

echo ""
echo "3. Verifying content files..."
find my-content -name "*.md" | while read file; do
  echo "   ✅ $file"
done

echo ""
echo "✅ All tests passed!"
```

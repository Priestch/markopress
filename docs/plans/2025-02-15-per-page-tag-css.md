# Per-Page Tag CSS Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate per-page CSS imports for Marko tags used in markdown content, enabling precise CSS loading in dev mode and optimal bundling in production.

**Architecture:** During build, scan markdown files for used Marko tags, generate entry modules importing only those tags, and update page templates to import entries. Vite extracts CSS automatically from imported Marko components.

**Tech Stack:** Node.js, TypeScript, Vite plugins, Marko.js, regex tag detection, HMR

---

## Task 1: Add Config Option for Per-Page CSS

**Files:**
- Modify: `packages/markopress/src/config/types.ts`
- Modify: `packages/markopress/src/config/loader.ts`

**Step 1: Add config type definition**

Edit `packages/markopress/src/config/types.ts` to add `perPageCss` option to `MarkoTagsConfig`:

```typescript
export interface MarkoTagsConfig {
  /** Enable custom Marko tags in markdown */
  enabled?: boolean;
  /** Directory containing custom Marko tags */
  tagsDir?: string;
  /** Generate per-page CSS imports for tags (default: false) */
  perPageCss?: boolean;
}
```

**Step 2: Set default value**

Edit `packages/markopress/src/config/loader.ts` to set default:

```typescript
// In resolveConfig() function, add to markdown.markoTags defaults
markoTags: {
  enabled: false,
  tagsDir: 'src/.markopress/tags',
  perPageCss: false,
}
```

**Step 3: Commit**

```bash
git add packages/markopress/src/config/types.ts packages/markopress/src/config/loader.ts
git commit -m "feat: add perPageCss config option for markoTags"
```

---

## Task 2: Create Tag Detection Utility

**Files:**
- Create: `packages/markopress/src/build/tag-detector.ts`

**Step 1: Write tests for tag detection**

Create test file `packages/markopress/test/build/tag-detector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectTagsInMarkdown } from '../../src/build/tag-detector.js';

describe('detectTagsInMarkdown', () => {
  it('should detect simple kebab-case tags', () => {
    const markdown = '<alert-box>This is an alert</alert-box>';
    const tags = detectTagsInMarkdown(markdown);
    expect(tags).toEqual(['alert-box']);
  });

  it('should detect multiple tags', () => {
    const markdown = '<alert-box/><card-header/>';
    const tags = detectTagsInMarkdown(markdown);
    expect(new Set(tags)).toEqual(new Set(['alert-box', 'card-header']));
  });

  it('should ignore tags in code blocks', () => {
    const markdown = `
\`\`\`
<alert-box>This is code</alert-box>
\`\`\`
<alert-box>Real tag</alert-box>
    `;
    const tags = detectTagsInMarkdown(markdown);
    expect(tags).toEqual(['alert-box']);
  });

  it('should ignore tags in inline code', () => {
    const markdown = '`<alert-box>` <card-header/>';
    const tags = detectTagsInMarkdown(markdown);
    expect(tags).toEqual(['card-header']);
  });

  it('should deduplicate repeated tags', () => {
    const markdown = '<alert-box/><alert-box/>';
    const tags = detectTagsInMarkdown(markdown);
    expect(tags).toEqual(['alert-box']);
  });

  it('should handle self-closing tags', () => {
    const markdown = '<alert-box/>';
    const tags = detectTagsInMarkdown(markdown);
    expect(tags).toEqual(['alert-box']);
  });

  it('should handle nested tags', () => {
    const markdown = '<card><card-body/></card>';
    const tags = detectTagsInMarkdown(markdown);
    expect(new Set(tags)).toEqual(new Set(['card', 'card-body']));
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd packages/markopress
pnpm test
```

Expected: FAIL - "Cannot find module '../../src/build/tag-detector.js'"

**Step 3: Implement tag detector**

Create `packages/markopress/src/build/tag-detector.ts`:

```typescript
/**
 * Detect Marko component tags used in markdown content
 *
 * Scans for kebab-case tags like <alert-box>, <card-header>
 * while properly ignoring code blocks and inline code.
 */

export function detectTagsInMarkdown(markdown: string): string[] {
  const tags = new Set<string>();

  // Regex to match kebab-case tags: <word-word> or <word-word/>
  const KEBAB_TAG_REGEX = /<([a-z][a-z0-9]*(-[a-z0-9]+)+)[\s\/>]/g;

  // Split by code blocks (fenced with ``` or ~~~)
  const parts = markdown.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/);

  for (const part of parts) {
    // Skip code blocks (they start with ``` or ~~~)
    if (part.startsWith('```') || part.startsWith('~~~')) {
      continue;
    }

    // Within each non-code part, skip inline code
    const inlineCodeParts = part.split(/(`[^`\n]+`)/);

    for (const inlinePart of inlineCodeParts) {
      // Skip inline code (starts with `)
      if (inlinePart.startsWith('`')) {
        continue;
      }

      // Detect tags in this part
      let match: RegExpExecArray | null;
      while ((match = KEBAB_TAG_REGEX.exec(inlinePart)) !== null) {
        const tagName = match[1];
        tags.add(tagName);
      }
    }
  }

  return Array.from(tags).sort();
}
```

**Step 4: Run tests to verify they pass**

```bash
cd packages/markopress
pnpm test
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/markopress/src/build/tag-detector.ts packages/markopress/test/build/tag-detector.test.ts
git commit -m "feat: add tag detection utility for markdown"
```

---

## Task 3: Create Tag Entry Generator

**Files:**
- Create: `packages/markopress/src/build/tag-entry-generator.ts`
- Create: `packages/markopress/test/build/tag-entry-generator.test.ts`

**Step 1: Write tests for entry generation**

Create `packages/markopress/test/build/tag-entry-generator.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { generateTagEntries } from '../../src/build/tag-entry-generator.js';
import { rimraf } from 'rimraf';

describe('generateTagEntries', () => {
  const testDir = path.join(process.cwd(), 'test-temp', 'tag-entries');
  const tagsDir = path.join(testDir, 'tags');
  const entriesDir = path.join(testDir, 'entries');

  beforeEach(async () => {
    await fs.mkdir(tagsDir, { recursive: true });
    await fs.mkdir(entriesDir, { recursive: true });
  });

  afterEach(async () => {
    await rimraf(testDir);
  });

  it('should generate entry module for single page', async () => {
    // Setup
    await fs.mkdir(path.join(tagsDir, 'alert-box.marko'), { recursive: true });

    const tagMap = new Map<string, string[]>();
    tagMap.set('docs/guide', ['alert-box']);

    // Execute
    await generateTagEntries(tagMap, tagsDir, entriesDir, 'src/.markopress/tags');

    // Verify
    const entryPath = path.join(entriesDir, 'docs-guide.js');
    const content = await fs.readFile(entryPath, 'utf-8');

    expect(content).toContain("import '../../.markopress/tags/alert-box.marko'");
  });

  it('should generate entry module with multiple tags', async () => {
    // Setup
    await fs.mkdir(path.join(tagsDir, 'alert-box.marko'), { recursive: true });
    await fs.mkdir(path.join(tagsDir, 'card.marko'), { recursive: true });

    const tagMap = new Map<string, string[]>();
    tagMap.set('index', ['alert-box', 'card']);

    // Execute
    await generateTagEntries(tagMap, tagsDir, entriesDir, 'src/.markopress/tags');

    // Verify
    const entryPath = path.join(entriesDir, 'index.js');
    const content = await fs.readFile(entryPath, 'utf-8');

    expect(content).toContain("import '../../.markopress/tags/alert-box.marko'");
    expect(content).toContain("import '../../.markopress/tags/card.marko'");
  });

  it('should handle special characters in page IDs', async () => {
    await fs.mkdir(path.join(tagsDir, 'alert-box.marko'), { recursive: true });

    const tagMap = new Map<string, string[]>();
    tagMap.set('docs/api/reference', ['alert-box']);

    await generateTagEntries(tagMap, tagsDir, entriesDir, 'src/.markopress/tags');

    const entryPath = path.join(entriesDir, 'docs-api-reference.js');
    expect(await fs.access(entryPath)).resolves.toBeUndefined();
  });

  it('should create empty entry for pages with no tags', async () => {
    const tagMap = new Map<string, string[]>();
    tagMap.set('empty-page', []);

    await generateTagEntries(tagMap, tagsDir, entriesDir, 'src/.markopress/tags');

    const entryPath = path.join(entriesDir, 'empty-page.js');
    const content = await fs.readFile(entryPath, 'utf-8');

    expect(content).toContain('// No tags used on this page');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd packages/markopress
pnpm test
```

Expected: FAIL - "Cannot find module '../../src/build/tag-entry-generator.js'"

**Step 3: Implement entry generator**

Create `packages/markopress/src/build/tag-entry-generator.ts`:

```typescript
/**
 * Generate per-page tag entry modules
 *
 * Creates JavaScript files that import only the Marko tags
 * used on each page, enabling precise CSS extraction.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface TagEntryOptions {
  /** Map of page ID to array of tag names */
  tagMap: Map<string, string[]>;
  /** Directory where tag components are located */
  tagsDir: string;
  /** Directory where entry modules should be written */
  entriesDir: string;
  /** Import path prefix for tags (relative to entries dir) */
  tagsImportPath: string;
}

/**
 * Generate entry modules for all pages
 */
export async function generateTagEntries(
  tagMap: Map<string, string[]>,
  tagsDir: string,
  entriesDir: string,
  tagsImportPath: string
): Promise<void> {
  // Ensure entries directory exists
  await fs.mkdir(entriesDir, { recursive: true });

  // Calculate relative import path
  const relativePath = calculateRelativePath(entriesDir, tagsImportPath);

  // Generate entry for each page
  for (const [pageId, tags] of tagMap.entries()) {
    const entryPath = path.join(entriesDir, `${sanitizePageId(pageId)}.js`);
    const content = generateEntryContent(tags, relativePath);
    await fs.writeFile(entryPath, content, 'utf-8');
  }
}

/**
 * Generate content for a single entry module
 */
function generateEntryContent(tags: string[], relativeImportPath: string): string {
  const imports = tags
    .map(tag => `import '${relativeImportPath}/${tag}.marko';`)
    .sort()
    .join('\n');

  return `// Generated by MarkoPress - do not edit
// This file imports only the Marko tags used on this page
// to enable precise CSS extraction

${imports || '// No tags used on this page'}
`;
}

/**
 * Calculate relative import path from entries dir to tags dir
 */
function calculateRelativePath(fromDir: string, toDir: string): string {
  // Normalize paths
  const from = path.normalize(fromDir);
  const to = path.normalize(toDir);

  // Calculate relative path
  const relative = path.relative(from, to);
  return relative.startsWith('.') ? relative : `./${relative}`;
}

/**
 * Sanitize page ID for use as filename
 */
function sanitizePageId(pageId: string): string {
  return pageId
    .replace(/[^a-z0-9\/]/gi, '-')  // Replace special chars with dash
    .replace(/\/+/g, '-')             // Replace slashes with dash
    .replace(/^-+|-+$/g, '');         // Trim leading/trailing dashes
}
```

**Step 4: Run tests to verify they pass**

```bash
cd packages/markopress
pnpm test
```

Expected: PASS (may need to adjust path calculations)

**Step 5: Commit**

```bash
git add packages/markopress/src/build/tag-entry-generator.ts packages/markopress/test/build/tag-entry-generator.test.ts
git commit -m "feat: add tag entry generator for per-page CSS"
```

---

## Task 4: Integrate Entry Generation into Build Process

**Files:**
- Modify: `packages/markopress/src/build/index.ts`

**Step 1: Add entry generation call**

In `packages/markopress/src/build/index.ts`, after content scanning phase (~line 300):

```typescript
// Add after plugin loadContent hooks
import { detectTagsInMarkdown } from './tag-detector.js';
import { generateTagEntries } from './tag-entry-generator.js';

// In build() function, after content scanning (around line 302)
if (config.markdown.markoTags?.enabled && config.markdown.markoTags?.perPageCss) {
  console.log('🏷️  Generating per-page tag entries...');

  const t3 = time('Tag entry generation');
  t3.start();

  // Scan markdown files for used tags
  const tagMap = new Map<string, string[]>();
  const tagsDirConfig = config.markdown.markoTags.tagsDir || 'src/.markopress/tags';
  const tagsDir = path.join(root, tagsDirConfig);

  for (const [contentId, file] of contentManifest) {
    if (file.rawContent) {
      const tags = detectTagsInMarkdown(file.rawContent);
      if (tags.length > 0) {
        tagMap.set(contentId, tags);
      }
    }
  }

  // Generate entry modules
  const entriesDir = path.join(routesDir, '.generated', 'tag-entries');
  await generateTagEntries(tagMap, tagsDir, entriesDir, tagsDirConfig);

  console.log(`   Generated ${tagMap.size} entry modules`);
  t3.end();
}
```

**Step 2: Store tag map for later use**

Add to build context or pass to page generation. Modify the page generation loop to use the tag map.

**Step 3: Test build**

```bash
cd /home/gp/Projects/markopress/website
rm -rf .markopress/dist .markopress/src/routes
npm run build
```

Verify entries are generated in `website/.markopress/src/routes/.generated/tag-entries/`

**Step 4: Commit**

```bash
git add packages/markopress/src/build/index.ts
git commit -m "feat: integrate tag entry generation into build"
```

---

## Task 5: Update Page Template to Use Tag Entries

**Files:**
- Modify: `packages/markopress/templates/page.marko.template`
- Modify: `packages/markopress/src/build/index.ts`

**Step 1: Modify page template**

Update `packages/markopress/templates/page.marko.template` to include entry import when perPageCss is enabled:

```marko
//<!-- TEMPLATE: Generated Marko page for content: {{CONTENT_ID}} -->
<if($global.perPageCss && $global.tagEntry)>
  import './.generated/tag-entries/{{TAG_ENTRY_FILE}}.js';
</if>

<div class="markdown-content">
  <virtual-markdown-content/virtualId="{{CONTENT_ID}}"/>
</div>
```

**Step 2: Pass tag entry info to page generation**

In `packages/markopress/src/build/index.ts` page generation code (~line 600):

```typescript
// When generating page, add to $global context
const tagEntryFile = sanitizePageId(contentId);
const pageContext = {
  // ... existing context
  perPageCss: config.markdown.markoTags?.perPageCss,
  tagEntry: tagEntryFile,
};
```

**Step 3: Test page rendering**

```bash
cd /home/gp/Projects/markopress/website
npm run dev
```

Visit a page using tags, verify CSS is loaded.

**Step 4: Commit**

```bash
git add packages/markopress/templates/page.marko.template packages/markopress/src/build/index.ts
git commit -m "feat: use tag entries in page templates"
```

---

## Task 6: Create Vite Plugin for HMR Support (Dev Mode)

**Files:**
- Create: `packages/markopress/src/build/tag-entries-plugin.ts`

**Step 1: Create HMR plugin**

```typescript
/**
 * Vite plugin for HMR support with per-page tag entries
 *
 * Watches markdown files and regenerates tag entry modules
 * when tags are added or removed.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { detectTagsInMarkdown } from './tag-detector.js';

export interface TagEntriesPluginOptions {
  /** Root directory of the project */
  root: string;
  /** Tags directory path */
  tagsDir: string;
  /** Entries directory path */
  entriesDir: string;
  /** Tags import path */
  tagsImportPath: string;
}

export function tagEntriesPlugin(options: TagEntriesPluginOptions): Plugin {
  const { root, tagsDir, entriesDir, tagsImportPath } = options;

  return {
    name: 'markopress-tag-entries',
    enforce: 'pre',

    async handleHotUpdate({ file, modules }) {
      // Only process markdown files
      if (!file.endsWith('.md')) {
        return;
      }

      // Read markdown content
      const content = await fs.readFile(file, 'utf-8');

      // Detect used tags
      const tags = detectTagsInMarkdown(content);

      // Calculate page ID from file path
      const relativePath = path.relative(root, file);
      const pageId = relativePath
        .replace(/\.md$/, '')
        .replace(/\\/g, '/');

      // Generate entry filename
      const entryFile = `${sanitizePageId(pageId)}.js`;
      const entryPath = path.join(entriesDir, entryFile);

      // Generate entry content
      const relativeImportPath = calculateRelativePath(entriesDir, tagsImportPath);
      const entryContent = generateEntryContent(tags, relativeImportPath);

      // Write entry module
      await fs.writeFile(entryPath, entryContent, 'utf-8');

      // Trigger HMR for the entry module
      const entryModuleId = `/src/routes/.generated/tag-entries/${entryFile}`;
      this.emit({
        name: 'update',
        payload: {
          changes: [
            {
              type: 'update',
              updates: [
                {
                  acceptedPath: entryModuleId,
                  path: entryModuleId,
                  timestamp: Date.now(),
                }
              ]
            }
          ]
        }
      });

      return modules;
    },
  };
}

function generateEntryContent(tags: string[], relativeImportPath: string): string {
  const imports = tags
    .map(tag => `import '${relativeImportPath}/${tag}.marko';`)
    .sort()
    .join('\n');

  return `// Generated by MarkoPress - do not edit
// This file imports only the Marko tags used on this page

${imports || '// No tags used on this page'}
`;
}

function calculateRelativePath(fromDir: string, toDir: string): string {
  const from = path.normalize(fromDir);
  const to = path.normalize(toDir);
  const relative = path.relative(from, to);
  return relative.startsWith('.') ? relative : `./${relative}`;
}

function sanitizePageId(pageId: string): string {
  return pageId
    .replace(/[^a-z0-9\/]/gi, '-')
    .replace(/\/+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

**Step 2: Register plugin in dev mode**

In `packages/markopress/src/cli/index.ts` or wherever Vite dev server is started:

```typescript
import { tagEntriesPlugin } from '../build/tag-entries-plugin.js';

// In dev server configuration
if (config.markdown.markoTags?.perPageCss) {
  plugins.push(tagEntriesPlugin({
    root: config.root,
    tagsDir: path.join(config.root, config.markdown.markoTags.tagsDir || 'src/.markopress/tags'),
    entriesDir: path.join(config.root, 'src/routes/.generated/tag-entries'),
    tagsImportPath: config.markdown.markoTags.tagsDir || 'src/.markopress/tags',
  }));
}
```

**Step 3: Test HMR**

```bash
cd /home/gp/Projects/markopress/website
npm run dev
```

Edit a markdown file to add/remove a tag, verify CSS updates without full page reload.

**Step 4: Commit**

```bash
git add packages/markopress/src/build/tag-entries-plugin.ts packages/markopress/src/cli/index.ts
git commit -m "feat: add HMR support for per-page tag entries"
```

---

## Task 7: Remove Manual CSS Workaround

**Files:**
- Modify: `packages/markopress/templates/layout.marko.template`
- Delete: `website/.markopress/public/markopress-components.css` (after verification)

**Step 1: Remove manual imports from layout template**

Edit `packages/markopress/templates/layout.marko.template`:

```diff
-import "../tags/alert-box.marko";
-import "../tags/card.marko";
-import "../tags/card-body.marko";
-import "../tags/card-header.marko";
-import "../tags/custom-button.marko";
-
<!DOCTYPE html>
```

**Step 2: Update website config to enable perPageCss**

Edit `website/.markopress/config.ts`:

```typescript
export default defineConfig({
  // ...
  markdown: {
    markoTags: {
      enabled: true,
      perPageCss: true,  // Enable per-page CSS
    },
  },
});
```

**Step 3: Test everything still works**

```bash
cd /home/gp/Projects/markopress/website
npm run build
npm run preview
```

Verify tag styles are loaded correctly.

**Step 4: Remove manual CSS file**

```bash
rm /home/gp/Projects/markopress/website/.markopress/public/markopress-components.css
```

**Step 5: Commit**

```bash
git add packages/markopress/templates/layout.marko.template
git commit -m "chore: remove manual tag CSS imports, use per-page entries"
```

---

## Task 8: Add Documentation

**Files:**
- Create: `docs/features/per-page-tag-css.md`

**Step 1: Write documentation**

Create comprehensive documentation explaining:
- What per-page tag CSS is
- How to enable it via config
- Benefits (dev HMR, production optimization)
- Migration guide from manual CSS

**Step 2: Update main README**

Add reference to new feature.

**Step 3: Commit**

```bash
git add docs/features/per-page-tag-css.md README.md
git commit -m "docs: add per-page tag CSS documentation"
```

---

## Task 9: Final Testing & Validation

**Files:**
- No new files, comprehensive testing

**Step 1: Test dev mode HMR**

```bash
cd /home/gp/Projects/markopress/website
npm run dev
```

- Edit markdown to add tag → CSS loads immediately
- Edit markdown to remove tag → CSS unloads immediately
- Edit tag component .marko file → CSS hot-reloads

**Step 2: Test production build**

```bash
npm run build
```

- Verify all pages build successfully
- Check bundle sizes (should be optimized)
- Verify CSS is included in output

**Step 3: Test edge cases**

- Page with no tags
- Page with all available tags
- Nested tags
- Special characters in page paths

**Step 4: Run all tests**

```bash
cd packages/markopress
pnpm test
```

**Step 5: Create example in demo site**

Add example markdown files showing tag usage.

**Step 6: Final commit**

```bash
git add .
git commit -m "test: validate per-page tag CSS implementation"
```

---

## Summary

This plan implements per-page tag CSS through:

1. **Config option** - `markdown.markoTags.perPageCss` flag
2. **Tag detection** - Regex-based scanning of markdown files
3. **Entry generation** - Creates JS files importing only used tags
4. **Build integration** - Generates entries during build
5. **Template updates** - Pages import their tag entries
6. **HMR support** - Vite plugin for dev-mode hot reloading
7. **Cleanup** - Removes manual CSS workarounds

Each task follows TDD: write test → implement → verify → commit.

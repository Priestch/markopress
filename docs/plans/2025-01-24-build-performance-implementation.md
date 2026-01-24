# Build Performance Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Speed up MarkoPress builds 3-5x for large sites (1000+ files) through two-level parallel processing.

**Architecture:** Parallelize content scanning at both directory and file levels with a shared concurrency limit. Create MarkdownIt instance once and reuse across all files. Use Promise.allSettled for graceful error handling.

**Tech Stack:** TypeScript, p-limit for concurrency control, existing markdown-it and Shiki setup

---

## Task 1: Check p-limit dependency

**Files:**
- Check: `package.json`
- Check: `packages/markopress/package.json`

**Step 1: Check if p-limit is available**

Run: `grep -r "p-limit" package.json packages/*/package.json`
Expected: Either found in dependencies or not found

**Step 2: If not found, add p-limit to packages/markopress/package.json**

If p-limit was found, skip to Step 3.

Edit `packages/markopress/package.json`, add to dependencies:
```json
"p-limit": "^4.0.0"
```

**Step 3: Install dependency**

Run: `cd packages/markopress && pnpm install`
Expected: p-limit installed successfully

---

## Task 2: Extract getMarkdownIt function in loader.ts

**Files:**
- Modify: `packages/markopress/src/markdown/loader.ts`

**Step 1: Read the current loader implementation**

The current `setupMarkdownIt` function (lines 82-140) creates a MarkdownIt instance. We need to extract this into a reusable function.

**Step 2: Add getMarkdownIt export function**

Add this new function after the `getHighlighterInstance` function (after line 39):

```typescript
/**
 * Get or create a shared MarkdownIt instance
 * This allows reusing the same instance across multiple parseMarkdown calls
 *
 * @param options - Markdown parsing options
 * @param env - Markdown environment context
 * @returns Configured MarkdownIt instance
 */
export async function getMarkdownIt(
  options: MarkdownOptions = {},
  env: MarkdownEnv = {}
): Promise<MarkdownIt> {
  const highlighter = await getHighlighterInstance();

  // Create enhanced highlighter with line features
  const enhancedHighlight = createEnhancedHighlighter(highlighter, {
    lineNumbers: options.lineNumbers ?? true,
  });

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: (code, lang, attrs) => {
      if (!lang) {
        return '';
      }
      try {
        return enhancedHighlight(code, lang, attrs);
      } catch (e) {
        return '';
      }
    },
  });

  // Add plugins
  md.use(mdAnchor, {
    permalink: mdAnchor.permalink.linkInsideHeader({
      symbol: '#',
      placement: 'before',
    }),
  });
  md.use(mdAttrs);
  md.use(mdEmoji.full || mdEmoji.bare);

  // Add custom containers
  setupContainers(md);
  setupDetails(md);

  // Add preserve Marko tags plugin if enabled
  if (options.markoTags?.enabled) {
    md.use(preserveTagsPlugin, {
      tagsDir: options.markoTags?.tagsDir || 'tags/',
      onTagDetected: (tagName: string, lineNumber: number) => {
        globalTagValidator.addDetectedTag(
          tagName,
          env.filePath || 'unknown',
          lineNumber
        );
      },
    });
  }

  return md;
}
```

**Step 3: Refactor setupMarkdownIt to use getMarkdownIt**

Replace the entire `setupMarkdownIt` function body (lines 82-140) with:

```typescript
/**
 * Setup markdown-it with plugins and Shiki highlighting
 * @deprecated Use getMarkdownIt() directly for better reusability
 */
async function setupMarkdownIt(options: MarkdownOptions, env: MarkdownEnv): Promise<MarkdownIt> {
  return getMarkdownIt(options, env);
}
```

**Step 4: Add optional existingMd parameter to parseMarkdown**

Update the `parseMarkdown` function signature (line 44) and add null check:

Change:
```typescript
export async function parseMarkdown(
  src: string,
  options: MarkdownOptions = {},
  env: MarkdownEnv = {}
): Promise<ProcessedMarkdown> {
```

To:
```typescript
export async function parseMarkdown(
  src: string,
  options: MarkdownOptions = {},
  env: MarkdownEnv = {},
  existingMd?: MarkdownIt
): Promise<ProcessedMarkdown> {
```

Then update the markdown-it usage (line 62):

Change:
```typescript
  // Setup markdown-it with Shiki
  const md = await setupMarkdownIt(options, env);
```

To:
```typescript
  // Use provided MarkdownIt or create new one
  const md = existingMd || await setupMarkdownIt(options, env);
```

**Step 5: Commit**

```bash
git add packages/markopress/src/markdown/loader.ts
git commit -m "refactor: extract getMarkdownIt for reuse across parseMarkdown calls

This allows sharing a single MarkdownIt instance across multiple
markdown files, avoiding redundant plugin setup.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add ScanContext interface to scanner.ts

**Files:**
- Modify: `packages/markopress/src/content/scanner.ts`

**Step 1: Add imports**

Add at the top of the file (after existing imports):

```typescript
import type MarkdownIt from 'markdown-it';
import pLimit from 'p-limit';
import type { Limit } from 'p-limit';
```

**Step 2: Add ScanContext interface**

Add after the file imports (around line 13):

```typescript
/**
 * Shared context for parallel content scanning
 */
export interface ScanContext {
  /** Concurrency limiter shared across all directories */
  limit: Limit;
  /** Shared MarkdownIt instance (lazy-loaded) */
  md: MarkdownIt | null;
  /** Promise for MarkdownIt creation (prevents race conditions) */
  mdPromise?: Promise<MarkdownIt>;
}
```

**Step 3: Update scanContentModules signature**

Update the function signature (line 51) to accept context:

Change:
```typescript
export async function scanContentModules(options: ContentScannerOptions): Promise<ContentModule[]> {
```

To:
```typescript
export async function scanContentModules(
  options: ContentScannerOptions,
  sharedContext?: ScanContext
): Promise<ContentModule[]> {
```

**Step 4: Commit**

```bash
git add packages/markopress/src/content/scanner.ts
git commit -m "refactor: add ScanContext interface for parallel scanning

Defines the shared context structure for coordinating parallel
content scanning across directories.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Implement parallel scanning in scanDirectory

**Files:**
- Modify: `packages/markopress/src/content/scanner.ts`

**Step 1: Update scanDirectory signature**

Update the function signature (line 85):

Change:
```typescript
async function scanDirectory(
```

To:
```typescript
async function scanDirectory(
  dirPath: string,
  rootDir: string,
  markdownOptions?: MarkdownOptions,
  moduleId?: string,
  type?: 'page' | 'doc' | 'blog' | 'custom',
  sharedContext?: ScanContext
): Promise<ContentFile[]>
```

**Step 2: Replace sequential loop with parallel processing**

Replace the entire file processing loop (lines 107-135) with:

```typescript
  // If no shared context, use sequential processing (backward compatibility)
  if (!sharedContext) {
    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const processed = await parseMarkdown(content, markdownOptions, {
          rootDir,
          filePath,
        });

        if (processed.frontmatter.draft) {
          continue;
        }

        const relativePath = path.relative(rootDir, filePath);
        const urlPath = getUrlPath(relativePath, dirPath, moduleId);

        contentFiles.push({
          id: generateId(relativePath),
          filePath,
          relativePath,
          type,
          moduleId: moduleId || 'unknown',
          urlPath,
          processed,
        });
      } catch (error) {
        console.error(`Failed to scan file: ${filePath}`, error);
      }
    }
  } else {
    // Parallel processing with shared context
    const results = await Promise.allSettled(
      files.map((filePath) =>
        sharedContext.limit(async () => {
          const content = await fs.readFile(filePath, 'utf-8');

          // Lazy-load MarkdownIt once across all files
          if (!sharedContext.md) {
            if (!sharedContext.mdPromise) {
              sharedContext.mdPromise = import('../markdown/index.js').then(
                (m) => m.getMarkdownIt(markdownOptions, { rootDir, filePath })
              );
            }
            sharedContext.md = await sharedContext.mdPromise;
          }

          const processed = await parseMarkdown(
            content,
            markdownOptions,
            { rootDir, filePath },
            sharedContext.md
          );

          if (processed.frontmatter.draft) {
            return null;
          }

          const relativePath = path.relative(rootDir, filePath);
          const urlPath = getUrlPath(relativePath, dirPath, moduleId);

          return {
            id: generateId(relativePath),
            filePath,
            relativePath,
            type,
            moduleId: moduleId || 'unknown',
            urlPath,
            processed,
          } as ContentFile | null;
        })
      )
    );

    // Collect successful results
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        contentFiles.push(result.value);
      } else if (result.status === 'rejected') {
        console.error(`File processing failed:`, result.reason);
      }
    }
  }

  return contentFiles;
```

**Step 3: Update scanContentModules to pass context**

Update the directory scanning loop (lines 56-77) to pass shared context:

Change:
```typescript
    const files = await scanDirectory(dirPath, rootDir, markdownOptions, key);
```

To:
```typescript
    const files = await scanDirectory(
      dirPath,
      rootDir,
      markdownOptions,
      key,
      undefined, // type will be determined inside scanDirectory
      sharedContext
    );
```

**Step 4: Commit**

```bash
git add packages/markopress/src/content/scanner.ts
git commit -m "feat: add parallel content scanning with shared context

- Process files in parallel with p-limit concurrency control
- Share single MarkdownIt instance across all files
- Use Promise.allSettled for graceful error handling
- Maintain backward compatibility (sequential when no context)

Expected 3-5x speedup for sites with 1000+ files.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Wire up shared context in build/index.ts

**Files:**
- Modify: `packages/markopress/src/build/index.ts`

**Step 1: Add p-limit import**

Add to imports at top of file (around line 8):

```typescript
import pLimit from 'p-limit';
```

**Step 2: Import ScanContext type**

Add to imports (around line 12):

```typescript
import { scanContent, scanContentModules, type ScanContext } from '../content/scanner.js';
```

**Step 3: Create and pass shared context in build()**

Update the content scanning section (around lines 62-73):

Change:
```typescript
    // Step 3: Scan content modules (NEW APPROACH)
    console.log('📂 Scanning content modules...');
    const modules = await scanContentModules({
      rootDir: process.cwd(),
      dirs: config.content,
      markdownOptions: config.markdown,
    });
```

To:
```typescript
    // Step 3: Scan content modules with parallel processing
    console.log('📂 Scanning content modules...');
    const scanContext: ScanContext = {
      limit: pLimit(50), // Process up to 50 files concurrently
      md: null,
    };
    const modules = await scanContentModules(
      {
        rootDir: process.cwd(),
        dirs: config.content,
        markdownOptions: config.markdown,
      },
      scanContext
    );
```

**Step 4: Commit**

```bash
git add packages/markopress/src/build/index.ts
git commit -m "feat: wire up shared scan context in build process

Creates shared ScanContext with p-limit(50) for parallel
content scanning. Passed to scanContentModules for
coordinated parallel processing across all directories.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Build and verify

**Step 1: Build the package**

Run: `cd packages/markopress && pnpm build`
Expected: Build completes without errors

**Step 2: Check for TypeScript errors**

Run: `pnpm run typecheck` (if available) or review build output
Expected: No type errors

**Step 3: Test on demo site**

Run: `cd /home/gp/Projects/markopress && npm run build`
Expected: Build completes successfully

---

## Task 7: Manual verification

**Step 1: Create test content**

Create ~10 test markdown files to verify parallel processing:

Run:
```bash
mkdir -p /home/gp/Projects/markopress/website/content/docs/test-perf
for i in {1..10}; do
  echo "# Test File $i" > "/home/gp/Projects/markopress/website/content/docs/test-perf/file-$i.md"
  echo "## Content
Some markdown content with **formatting**.

\`\`\`js
console.log('hello world');
\`\`\`" >> "/home/gp/Projects/markopress/website/content/docs/test-perf/file-$i.md"
done
```

**Step 2: Run build and observe output**

Run: `cd /home/gp/Projects/markopress && npm run build`
Expected: Build completes, all test files processed

**Step 3: Verify output includes test files**

Check: `ls dist/test-perf/`
Expected: HTML files for each test markdown file

**Step 4: Clean up test content**

Run:
```bash
rm -rf /home/gp/Projects/markopress/website/content/docs/test-perf
```

**Step 5: Final verification build**

Run: `npm run build`
Expected: Build completes without errors

---

## Task 8: Documentation updates

**Files:**
- Modify: `docs/PLANS.md` (if it exists)
- Or create: `docs/CHANGELOG.md` entry

**Step 1: Document the performance improvement**

Add entry noting the parallel scanning feature and expected performance gains.

**Step 2: Commit documentation**

```bash
git add docs/
git commit -m "docs: note build performance optimization

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

After completing all tasks:
- Content scanning runs in parallel with 50-file concurrency limit
- Single MarkdownIt instance shared across all files
- Graceful error handling for individual file failures
- Expected 3-5x speedup for sites with 1000+ files
- Backward compatible (sequential when no context provided)

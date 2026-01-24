# Build Performance Optimization

**Date:** 2025-01-24
**Status:** Design Approved
**Target:** 3-5x faster builds for large sites (1000+ files)

## Problem

MarkoPress build performance is slow for sites with 1000+ content files due to:

1. **Sequential file scanning** - Files are read and parsed one-by-one in `scanner.ts:107-135`
2. **Redundant MarkdownIt creation** - New instance created for each file in `loader.ts:82`
3. **No template caching** - Templates loaded from disk for each route in `build/index.ts:584,665,716`

## Solution: Two-Level Parallel Processing

Parallelize at both directory and file levels with shared resources.

```
                            scanContentModules (parallel)
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
              pages/ (parallel)   docs/ (parallel)   blog/ (parallel)
                    │                  │                  │
            file 1  ←→  file 2   file 1  ←→  file 2   file 1  ←→  file 2
            (limit 50)            (limit 50)           (limit 50)
```

**Shared concurrency limit of 50 across all directories** ensures ~150 max concurrent operations without overwhelming the filesystem.

## Architecture

### Shared Context

```typescript
interface ScanContext {
  limit: Limit;              // p-limit instance (max 50 concurrent)
  md: MarkdownIt | null;     // Lazy-loaded, shared across all files
  mdPromise?: Promise<MarkdownIt>;  // Prevents race on first access
}
```

### Data Flow

1. `build/index.ts` creates shared context with `pLimit(50)`
2. `scanContentModules()` starts all directories in parallel
3. `scanDirectory()` processes files with shared limit
4. MarkdownIt created once, reused by all files
5. Individual file failures don't stop the build

## Implementation Changes

### 1. `packages/markopress/src/markdown/loader.ts`

Extract MarkdownIt creation for reuse:

```typescript
export async function getMarkdownIt(
  options: MarkdownOptions = {},
  env: MarkdownEnv = {}
): Promise<MarkdownIt> {
  const highlighter = await getHighlighterInstance();
  // ... setup and return instance
}

export async function parseMarkdown(
  src: string,
  options: MarkdownOptions = {},
  env: MarkdownEnv = {},
  existingMd?: MarkdownIt  // NEW: optional reuse
): Promise<ProcessedMarkdown>
```

### 2. `packages/markopress/src/content/scanner.ts`

Add parallel scanning with shared context:

```typescript
async function scanDirectory(
  dirPath: string,
  rootDir: string,
  markdownOptions?: MarkdownOptions,
  moduleId?: string,
  type?: ContentType,
  sharedContext?: ScanContext  // NEW
): Promise<ContentFile[]>
```

Replace sequential loop with:
```typescript
const results = await Promise.allSettled(
  files.map(file =>
    context.limit(async () => {
      const content = await fs.readFile(file, 'utf-8');
      if (!context.md) {
        context.md = await getMarkdownIt(options, env);
      }
      return parseMarkdown(content, options, env, context.md);
    })
  )
);
```

### 3. `packages/markopress/src/build/index.ts`

Create and pass shared context:

```typescript
import pLimit from 'p-limit';

async function build(options: BuildOptions = {}): Promise<BuildResult> {
  // ...
  const scanContext = { limit: pLimit(50), md: null };

  const modules = await scanContentModules({
    rootDir: process.cwd(),
    dirs: config.content,
    markdownOptions: config.markdown,
  }, scanContext);  // Pass shared context
  // ...
}
```

## Error Handling

- Use `Promise.allSettled` to handle individual file failures
- Log errors but continue processing other files
- Build fails only if ALL files fail

## Dependencies

```json
{
  "p-limit": "^4.0.0"
}
```

## Expected Results

| Site Size | Current | Optimized | Speedup |
|-----------|---------|-----------|---------|
| Small (<100) | ~1s | ~0.5s | 2x |
| Medium (100-1000) | ~5s | ~1.5s | 3x |
| Large (1000+) | ~15s | ~3-5s | 3-5x |

## Implementation Order

1. Modify `loader.ts` - Extract `getMarkdownIt()`
2. Modify `scanner.ts` - Add parallel processing
3. Modify `build/index.ts` - Wire up shared context
4. Add `p-limit` dependency if not present
5. Manual testing with ~100 files

## Future Enhancements (Not in Phase 1)

- Build cache for parsed markdown (incremental builds)
- Lazy Shiki language loading
- Worker threads for parsing
- Template caching for route generation

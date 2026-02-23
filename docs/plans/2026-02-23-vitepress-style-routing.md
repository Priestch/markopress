# VitePress-Style Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor routing so directory structure directly determines URL structure, removing special `pages` handling.

**Architecture:** Single `content/` directory with feature-based config per subdirectory. URL = file path relative to content directory.

**Tech Stack:** TypeScript, Marko.js 6, @marko/run

---

## Task 1: Update Config Types

**Files:**
- Modify: `packages/markopress/src/config/types.ts`

**Step 1: Add new types for feature-based content config**

Add after `ModuleOptions` interface (around line 42):

```typescript
export interface ContentFeatureOptions {
  sidebar?: boolean;
  rss?: boolean;
  list?: boolean;
  toc?: boolean;
}

export interface ContentDirectoryConfig extends ContentFeatureOptions {
  toc?: boolean;
}

export interface NewContentConfig {
  [directory: string]: ContentDirectoryConfig;
}
```

**Step 2: Update MarkoPressConfig interface**

Modify the `content` field in `MarkoPressConfig` (around line 158):

```typescript
export interface MarkoPressConfig {
  site: SiteConfig;
  contentDir?: string;
  content?: NewContentConfig;
  theme?: ThemeConfig;
  markdown?: MarkdownConfig;
  build?: BuildConfig;
  search?: SearchConfig;
  plugins?: (string | PluginConfig)[];
}
```

**Step 3: Run type check**

Run: `cd packages/markopress && pnpm tsc --noEmit`
Expected: Type errors in loader.ts (will fix next task)

**Step 4: Commit**

```bash
git add packages/markopress/src/config/types.ts
git commit -m "feat(config): add feature-based content config types"
```

---

## Task 2: Update Config Loader

**Files:**
- Modify: `packages/markopress/src/config/loader.ts`

**Step 1: Update defaults**

Modify the default content config (around line 26):

```typescript
const defaults: Required<Omit<MarkoPressConfig, 'content'>> & { contentDir: string } = {
  site: {
    title: 'MarkoPress',
    description: '',
    lang: 'en-US',
    head: [],
  },
  contentDir: 'content',
  content: {
    docs: { sidebar: true },
    blog: { rss: true, list: true },
  },
  theme: {
    name: '@markopress/theme-default',
    options: {},
  },
  markdown: {
    lineNumbers: false,
  },
  build: {
    useCatchAllRoutes: true,
  },
  search: {
    enabled: true,
  },
  plugins: [],
};
```

**Step 2: Update resolveConfig function**

Modify to handle new content format (around line 40):

```typescript
export async function loadConfig(
  root: string,
  env?: ConfigEnv
): Promise<ResolvedConfig> {
  const configEnv = env || { mode: 'development', command: 'dev' };
  const configPath = await findConfigFile(root);

  let userConfig: UserConfig = {};
  if (configPath) {
    const { loadModule } = await import('./app-root.js');
    const loaded = await loadModule(configPath);
    if (typeof loaded === 'function') {
      userConfig = await loaded(configEnv);
    } else {
      userConfig = loaded || {};
    }
  }

  const merged: ResolvedConfig = {
    root,
    site: { ...defaults.site, ...userConfig.site },
    contentDir: userConfig.contentDir || defaults.contentDir,
    content: userConfig.content || defaults.content,
    theme: { ...defaults.theme, ...userConfig.theme },
    markdown: { ...defaults.markdown, ...userConfig.markdown },
    build: { ...defaults.build, ...userConfig.build },
    search: { ...defaults.search, ...userConfig.search },
    plugins: userConfig.plugins || defaults.plugins,
  };

  return merged;
}
```

**Step 3: Update ResolvedConfig type in types.ts**

Modify `ResolvedConfig` interface (around line 173):

```typescript
export interface ResolvedConfig extends Required<Omit<MarkoPressConfig, 'contentDir'>> {
  root: string;
  contentDir: string;
  content: NewContentConfig;
  build: BuildConfig;
}
```

**Step 4: Run type check**

Run: `cd packages/markopress && pnpm tsc --noEmit`
Expected: Type errors in build/index.ts (will fix next task)

**Step 5: Commit**

```bash
git add packages/markopress/src/config/loader.ts packages/markopress/src/config/types.ts
git commit -m "feat(config): implement feature-based content loading"
```

---

## Task 3: Refactor Build System - URL Generation

**Files:**
- Modify: `packages/markopress/src/build/index.ts`

**Step 1: Create helper function for URL calculation**

Add after imports (around line 35):

```typescript
function filePathToUrl(filePath: string, contentDir: string): string {
  const relativePath = path.relative(contentDir, filePath);
  const slug = relativePath.replace(/\.md$/, '');
  
  if (slug === 'index') return '/';
  if (slug.endsWith('/index')) {
    return '/' + slug.replace('/index', '');
  }
  return '/' + slug;
}
```

**Step 2: Update module scanning logic**

Replace the module scanning loop (lines 111-170) with single content directory scan:

```typescript
const modules: any[] = [];
const contentDir = path.resolve(root, config.contentDir);

try {
  const entries = await fs.readdir(contentDir, { withFileTypes: true, recursive: true });
  const directoryFiles: Map<string, any[]> = new Map();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

    const filePath = path.join(entry.path || entry.parentPath || contentDir, entry.name);
    const relativePath = path.relative(contentDir, filePath);
    const urlPath = filePathToUrl(filePath, contentDir);
    
    const directory = relativePath.split(path.sep)[0] || 'root';
    
    const content = await fs.readFile(filePath, 'utf-8');
    let frontmatter: Record<string, unknown> = {};
    try {
      frontmatter = matter(content).data as Record<string, unknown>;
    } catch {
      // Ignore parse errors
    }

    if (!directoryFiles.has(directory)) {
      directoryFiles.set(directory, []);
    }
    
    directoryFiles.get(directory)!.push({
      id: entry.name.replace('.md', ''),
      slug: entry.name.replace('.md', ''),
      filePath,
      urlPath,
      directory,
      processed: { frontmatter },
    });
  }

  for (const [dir, files] of directoryFiles) {
    const features = config.content[dir] || {};
    const enhancements = new Map<string, unknown>();
    
    modules.push({
      id: dir,
      dir: path.join(contentDir, dir === 'root' ? '' : dir),
      config: features,
      features,
      files,
      enhance(key: string, data: unknown) {
        enhancements.set(key, data);
      },
      getEnhancement<T = unknown>(key: string): T | undefined {
        return enhancements.get(key) as T;
      },
      _enhancements: enhancements,
    });
  }
} catch (error) {
  console.warn(`Warning: Could not scan content directory: ${error}`);
}
```

**Step 3: Remove special pages handling in static URL generation**

Replace lines 456-461:

```typescript
const staticUrls: string[] = [];
for (const mod of modules) {
  for (const file of mod.files) {
    staticUrls.push(file.urlPath);
  }
}
```

**Step 4: Run type check**

Run: `cd packages/markopress && pnpm tsc --noEmit`
Expected: No type errors, or note remaining errors

**Step 5: Commit**

```bash
git add packages/markopress/src/build/index.ts
git commit -m "refactor(build): use content directory structure for URLs"
```

---

## Task 4: Update Tests

**Files:**
- Modify: `packages/markopress/src/config/loader.test.ts`
- Create: `packages/markopress/src/build/url-generation.test.ts`

**Step 1: Update config loader test**

Modify `packages/markopress/src/config/loader.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { loadConfig } from './loader.js';

describe('loadConfig', () => {
  it('applies defaults for new content format', async () => {
    const resolved = await loadConfig(process.cwd());
    expect(resolved.contentDir).toBe('content');
    expect(resolved.content.docs).toEqual({ sidebar: true });
    expect(resolved.content.blog).toEqual({ rss: true, list: true });
  });
});
```

**Step 2: Create URL generation test**

Create `packages/markopress/src/build/url-generation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import path from 'node:path';

function filePathToUrl(filePath: string, contentDir: string): string {
  const relativePath = path.relative(contentDir, filePath);
  const slug = relativePath.replace(/\.md$/, '');
  
  if (slug === 'index') return '/';
  if (slug.endsWith('/index')) {
    return '/' + slug.replace('/index', '');
  }
  return '/' + slug;
}

describe('filePathToUrl', () => {
  const contentDir = '/project/content';

  it('maps root index to /', () => {
    expect(filePathToUrl(`${contentDir}/index.md`, contentDir)).toBe('/');
  });

  it('maps root about to /about', () => {
    expect(filePathToUrl(`${contentDir}/about.md`, contentDir)).toBe('/about');
  });

  it('maps docs index to /docs', () => {
    expect(filePathToUrl(`${contentDir}/docs/index.md`, contentDir)).toBe('/docs');
  });

  it('maps docs guide to /docs/guide', () => {
    expect(filePathToUrl(`${contentDir}/docs/guide.md`, contentDir)).toBe('/docs/guide');
  });

  it('maps nested path correctly', () => {
    expect(filePathToUrl(`${contentDir}/docs/advanced/config.md`, contentDir)).toBe('/docs/advanced/config');
  });
});
```

**Step 3: Run tests**

Run: `cd packages/markopress && pnpm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/markopress/src/config/loader.test.ts packages/markopress/src/build/url-generation.test.ts
git commit -m "test: add tests for new content routing"
```

---

## Task 5: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `packages/markopress/README.md`

**Step 1: Update CLAUDE.md content section**

Replace the Content Organization section with:

```markdown
## Content Organization

Content uses **GitHub Flavored Markdown** with YAML frontmatter. File path determines route:

| File Path | URL |
|-----------|-----|
| `content/index.md` | `/` |
| `content/about.md` | `/about` |
| `content/docs/index.md` | `/docs` |
| `content/docs/guide.md` | `/docs/guide` |
| `content/blog/post.md` | `/blog/post` |

**Rule:** Strip `content/` prefix from file path = URL path.

### Content Features

Configure features per directory in `src/.markopress/config.ts`:

```typescript
export default defineConfig({
  contentDir: 'content',
  content: {
    docs: { sidebar: true },     // Generate sidebar
    blog: { rss: true, list: true }, // RSS feed + index page
    guides: { sidebar: true, toc: true }, // Custom section
  },
});
```

**Feature flags:**
- `sidebar: true` - Generate sidebar, enable `order` frontmatter
- `rss: true` - Generate RSS feed
- `list: true` - Generate index page listing items
- `toc: true` - Extract table of contents

### Frontmatter

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Page title |
| `description` | string | SEO description |
| `draft` | boolean | Exclude from build |
| `order` | number | Sidebar ordering (requires `sidebar: true`) |
| `date` | Date | Publication date (for blog) |
| `author` | string | Author name |
| `tags` | string[] | Tags |
```

**Step 2: Commit**

```bash
git add CLAUDE.md packages/markopress/README.md
git commit -m "docs: update for VitePress-style routing"
```

---

## Task 6: Integration Test

**Files:**
- Modify: Demo site content structure

**Step 1: Move demo content files**

```bash
mv content/pages/*.md content/
rmdir content/pages
```

**Step 2: Update demo config**

Modify `src/.markopress/config.ts`:

```typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'MarkoPress Demo',
    description: 'A demo site built with MarkoPress',
  },
  contentDir: 'content',
  content: {
    docs: { sidebar: true, toc: true },
    blog: { rss: true, list: true },
  },
});
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds, URLs match new structure

**Step 4: Test routes**

- Visit `/` - should show index page
- Visit `/about` - should show about page
- Visit `/docs` - should show docs index
- Visit `/blog` - should show blog index

**Step 5: Commit**

```bash
git add src/.markopress/config.ts content/
git commit -m "chore: migrate demo to new content structure"
```

---

## Summary

After completing all tasks:

1. **Config** - New feature-based content config
2. **Build** - Single content directory, path = URL
3. **Tests** - Coverage for new URL generation
4. **Docs** - Updated documentation
5. **Demo** - Migrated to new structure

**Breaking change migration:**
- Users move `content/pages/*.md` → `content/*.md`
- Users update config to new format

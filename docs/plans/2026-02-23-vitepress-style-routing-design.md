# VitePress-Style Routing Refactor

## Summary

Refactor MarkoPress routing to follow VitePress's file-based routing: directory structure directly determines URL structure. Remove special handling of the `pages` module.

## Current Behavior

```
content/pages/about.md  → /about        (special: no prefix)
content/docs/guide.md   → /docs/guide   (module prefix)
content/blog/post.md    → /blog/post    (module prefix)
```

Special `pages` handling in `build/index.ts:456-461`:
```typescript
if (mod.id === 'pages') {
  staticUrls.push(file.id === 'index' ? '/' : `/${file.id}`);
} else {
  staticUrls.push(file.urlPath);
}
```

## New Behavior

```
content/about.md        → /about        (root file)
content/index.md        → /             (index file)
content/docs/guide.md   → /docs/guide   (directory = URL)
content/blog/post.md    → /blog/post    (directory = URL)
```

Rule: **strip `content/` prefix from file path = URL path**

## Configuration Change

### Before
```typescript
content: {
  pages: 'content/pages',
  docs: 'content/docs',
  blog: 'content/blog',
}
```

### After
```typescript
contentDir: 'content',  // Single content directory (default: 'content')

content: {
  docs: { sidebar: true },      // Feature: generate sidebar
  blog: { rss: true, list: true }, // Features: RSS feed, index page
  guides: { sidebar: true },    // Custom docs-like section
}
```

**Config semantics:**
- `contentDir`: Root directory for all content (default: `content`)
- `content`: Features per subdirectory
  - Key = subdirectory name inside `contentDir`
  - Value = feature flags
  - Unlisted directories = regular pages (no special features)

**Feature flags:**
- `sidebar: true` - Generate sidebar, enable ordering frontmatter
- `rss: true` - Generate RSS feed for this directory
- `list: true` - Generate index page listing all posts
- `toc: true` - Extract table of contents

## URL Derivation

| File Path | URL |
|-----------|-----|
| `content/index.md` | `/` |
| `content/about.md` | `/about` |
| `content/docs/index.md` | `/docs` |
| `content/docs/getting-started.md` | `/docs/getting-started` |
| `content/blog/2024-01-01-hello.md` | `/blog/2024-01-01-hello` |

**No special cases** - one rule for all files.

## Breaking Changes

1. **`content.pages` config removed** - Files go in `content/` root instead
2. **`content.{pages,docs,blog}` string format removed** - Use object with features
3. **Users must move files**:
   - `content/pages/about.md` → `content/about.md`
   - `content/pages/index.md` → `content/index.md`

## Migration Path

1. Deprecation warning in v0.x: "content.pages will be removed, use content/ root"
2. v1.0: Remove special pages handling, require new config format
3. Provide migration script: `markopress migrate routing`

## Implementation Areas

1. **Config types** (`config/types.ts`)
   - Add `contentDir` option
   - Change `ContentConfig` to feature-based format

2. **Config loader** (`config/loader.ts`)
   - Default `contentDir` to `'content'`
   - Validate feature flags

3. **Build system** (`build/index.ts`)
   - Remove `mod.id === 'pages'` special case
   - Single content directory scan
   - URL = file path relative to `contentDir`

4. **Plugin system**
   - Plugins receive directory path + features
   - `sidenav` plugin checks for `sidebar: true`
   - RSS plugin checks for `rss: true`

5. **Static URL generation**
   - All files use same URL calculation
   - No module-specific branches

## Benefits

- **Simpler mental model**: directory structure = URL structure
- **No magic**: no special directory names
- **Flexibility**: any directory can have any features
- **Aligned with VitePress**: familiar to users migrating

## Trade-offs

- **Breaking change**: requires config and file structure migration
- **Less opinionated**: users must organize their own structure

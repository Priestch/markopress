# MarkoPress Long-Term Roadmap: VitePress/Docusaurus Feature Parity

## Executive Summary

This roadmap outlines the implementation of VitePress/Docusaurus-style features in MarkoPress using Marko.js v6. The goal is to create a **world-class static site generator** that combines the best patterns from all three frameworks while leveraging Marko.js's unique advantages (faster rendering, simpler syntax, better SEO, true SSR).

**Vision**: MarkoPress as the fastest, most developer-friendly static site generator with:
- Plugin architecture rivaling Docusaurus
- Theme flexibility matching VitePress
- Performance exceeding both
- Developer experience better than RsPress

---

## Architecture Foundation

### Current State (Strengths)

✅ **Already Implemented:**
- Content scanning and markdown processing (markdown-it + Shiki)
- Plugin system with hooks (config, contentLoaded, beforeBuild, afterBuild, extendMarkdown, extendRoutes)
- Theme system with design tokens (CSS variables)
- Route generation (static and catch-all dynamic)
- Security-focused design (path validation)
- Basic plugin ecosystem (content-pages, content-docs, content-blog)

### Current State (Gaps)

❌ **Missing Critical Features:**
- Plugin hooks not called during build (only dev server)
- No search functionality
- No i18n support
- No versioning system
- Limited theme slots (VitePress has 20+ extension points)
- No dynamic route parameters
- Navigation not auto-generated from file structure

---

## Implementation Roadmap

### Phase 1: Enhanced Plugin System (Foundation)
**Timeline**: Week 1-3
**Priority**: CRITICAL - Everything else depends on this

**Objective**: Implement Docusaurus-style plugin lifecycle with full build integration

#### 1.1 Plugin Lifecycle Hooks

```typescript
interface MarkoPressPlugin {
  name: string;

  // NEW: Load content from external sources
  loadContent?(): Promise<PluginContent | null>;

  // ENHANCED: Process content with actions
  contentLoaded?(ctx: {
    content: PluginContent;
    allContent: AllContent;
    actions: {
      addRoute(route: RouteConfig): void;
      addData(key: string, value: unknown): void;
    };
  }): Promise<void> | void;

  // NEW: Access all content after all plugins
  allContentLoaded?(ctx: {
    allContent: AllContent;
    routes: RouteManifest;
    actions: ContentActions;
  }): Promise<void> | void;

  // NEW: Post-build operations
  postBuild?(ctx: {
    outDir: string;
    routes: RouteManifest;
    assets: string[];
    allContent: AllContent;
  }): Promise<void> | void;

  // Existing (keep)
  extendMarkdown?: (md: MarkdownIt) => void;
  extendRoutes?: (routes: RouteManifest) => RouteManifest;
}
```

**Implementation Files**:
- `packages/markopress/src/plugin/types.ts` - Add new hook types
- `packages/markopress/src/plugin/context.ts` - NEW: AllContentImpl, ContentActionsImpl
- `packages/markopress/src/plugin/manager.ts` - Add hook execution methods
- `packages/markopress/src/plugin/compat.ts` - NEW: Backward compatibility wrapper

#### 1.2 Build Process Integration

**Current Problem**: Build process doesn't call plugin hooks
**Solution**: Refactor build pipeline to call hooks at appropriate stages

```typescript
// Build pipeline with plugin hooks
export async function build(options: BuildOptions) {
  const config = await loadConfig();

  // 1. Initialize plugins
  const pluginManager = new PluginManager(config);
  await pluginManager.loadPlugins(config.plugins);

  // 2. Load plugin content (NEW)
  await pluginManager.execLoadContentHooks();

  // 3. Scan core content
  const manifest = await scanContent();

  // 4. Process plugin content (ENHANCED)
  await pluginManager.execContentLoadedHooks(manifest);

  // 5. Generate routes
  await generateRoutes(manifest);
  await generatePluginRoutes(pluginManager.getPluginRoutes());

  // 6. All content loaded (NEW)
  await pluginManager.execAllContentLoadedHooks(routeManifest);

  // 7. Build with @marko/run
  const buildResult = await runMarkoRunBuild();

  // 8. Post-build hooks (NEW)
  await pluginManager.execPostBuildHooks(
    buildResult.outDir,
    routeManifest,
    assets
  );

  return buildResult;
}
```

**Implementation Files**:
- `packages/markopress/src/build/index.ts` - Refactor build pipeline
- `packages/markopress/src/dev/index.ts` - Match dev server lifecycle

**Success Criteria**:
- ✅ Plugin hooks called during build (not just dev)
- ✅ Plugins can load content from external sources
- ✅ Plugins can add routes and data
- ✅ Backward compatible with existing plugins

---

### Phase 2: Enhanced Theme System
**Timeline**: Week 4-6
**Priority**: HIGH - Critical for customization

**Objective**: Implement VitePress-style slot-based theming with 20+ extension points

#### 2.1 Slot System Architecture

**VitePress Pattern** (20+ slots):
```marko
<VPLayout>
  <template #navbar-start>
  <template #navbar-center>
  <template #navbar-end>
  <template #navbar-search-before>
  <template #navbar-search-after>
  <template #sidebar-top>
  <template #sidebar-bottom>
  <template #aside-top>
  <template #aside-bottom>
  <template #doc-top>
  <template #doc-bottom>
  <template #doc-footer-before>
  <template #doc-footer-after>
  <template #home-hero-before>
  <template #home-hero-after>
  <template #home-features-after>
  <template #page-top>
  <template #page-bottom>
  <!-- ... more slots -->
</VPLayout>
```

**MarkoPress Implementation**:

```marko
<!-- packages/markopress/templates/layout.marko.template -->
<!DOCTYPE html>
<html lang=$global.lang||"en">
<head>
  <slot name="head-top"/>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <slot name="head-bottom"/>
</head>
<body>
  <slot name="body-top"/>

  <nav class="navbar">
    <slot name="navbar-start"/>
    <slot name="navbar-center"/>
    <slot name="navbar-end"/>
    <slot name="navbar-search-before"/>
    <slot name="navbar-search-after"/>
  </nav>

  <div class="layout">
    <aside class="sidebar">
      <slot name="sidebar-top"/>
      <!-- sidebar content -->
      <slot name="sidebar-bottom"/>
    </aside>

    <main class="content">
      <slot name="aside-top"/>
      <slot name="content-top"/>
      <slot name="content-before"/>
      <${input.content}/>
      <slot name="content-after"/>
      <slot name="content-bottom"/>
      <slot name="aside-bottom"/>
    </main>
  </div>

  <slot name="body-bottom"/>
</body>
</html>
```

#### 2.2 Slot Override System

**Directory-based Override**:
```
.markopress/
└── theme/
    └── slots/
        ├── navbar-start.marko
        ├── sidebar-top.marko
        └── doc-footer-before.marko
```

**Implementation**:
- `packages/markopress/src/theme/slots.ts` - NEW: Slot loading and registration
- `packages/markopress/src/theme/loader.ts` - Load user slot overrides
- `packages/theme-default/src/components/` - Refactor to use slots

**Success Criteria**:
- ✅ 20+ slot extension points
- ✅ Users can override any slot without forking theme
- ✅ Slot overrides loaded from `.markopress/theme/slots/`
- ✅ Backward compatible with existing themes

---

### Phase 3: Search Functionality
**Timeline**: Week 7-9
**Priority**: HIGH - Critical user-facing feature

**Objective**: Implement VitePress/RsPress-style client-side search with heading-based indexing

#### 3.1 Search Index Generation

**VitePress Pattern** (heading-based sections):
```typescript
function* splitPageIntoSections(html: string) {
  const sections = html.split(/<h2[^>]*>/);
  for (const section of sections) {
    yield {
      title: extractTitle(section),
      titles: extractHeaderHierarchy(section),
      content: stripHtml(section),
      anchor: generateAnchor(title)
    };
  }
}
```

**MarkoPress Implementation**:

```typescript
// packages/markopress/src/search/indexer.ts
export interface SearchDocument {
  id: string;
  title: string;
  titles: string[]; // Header hierarchy for context
  content: string;
  url: string;
}

export async function generateSearchIndex(
  manifest: ContentManifest,
  options: SearchOptions
): Promise<SearchDocument[]> {
  const docs: SearchDocument[] = [];

  for (const page of manifest.pages) {
    const sections = splitPageIntoSections(page.processed.html);
    for (const section of sections) {
      docs.push({
        id: `${page.urlPath}#${section.anchor}`,
        title: section.title,
        titles: section.titles, // ["Getting Started", "Installation", "Step 1"]
        content: stripHtml(section.content),
        url: page.urlPath
      });
    }
  }

  return docs;
}
```

#### 3.2 Client-Side Search Component

**Using MiniSearch** (like VitePress) or **FlexSearch** (like RsPress):

```marko
<!-- packages/theme-default/src/search/SearchBar.marko -->
<div class="search-bar">
  <input
    type="search"
    placeholder="Search docs..."
    on-keyup="handleSearch"
    class="search-input"
  />

  <if(state.results.length > 0)>
    <div class="search-results">
      <for|result| of=state.results>
        <a class="search-result" href=result.url>
          <div class="result-title">${result.title}</div>
          <div class="result-titles">
            <for|title| of=result.titles>
              <span class="breadcrumb">${title}</span>
            </for>
          </div>
          <div class="result-content">${result.content}</div>
        </a>
      </for>
    </div>
  </if>
</div>

<script>
class SearchBar {
  state = {
    query: '',
    results: [],
    index: null
  };

  onMount() {
    // Load search index
    fetch('/search-index.json')
      .then(r => r.json())
      .then(data => {
        this.state.index = new MiniSearch({
          fields: ['title', 'titles', 'content'],
          storeFields: ['title', 'titles', 'url'],
          searchOptions: {
            fuzzy: 0.2,
            prefix: true,
            boost: { title: 4, titles: 2 }
          }
        });
        this.state.index.addAll(data);
      });
  }

  handleSearch(event) {
    const query = event.target.value;
    if (!query) {
      this.state.results = [];
      return;
    }

    this.state.results = this.state.index.search(query);
  }
}
</script>
```

#### 3.3 Search Plugin

```typescript
// packages/markopress/src/plugins/search/index.ts
export const searchPlugin: MarkoPressPlugin = {
  name: '@markopress/plugin-search',

  async postBuild({ outDir, allContent }) {
    // Generate search index
    const pages = allContent.getPages();
    const docs = allContent.getDocs();
    const index = await generateSearchIndex([...pages, ...docs]);

    // Write to public directory
    await fs.writeFile(
      path.join(outDir, 'search-index.json'),
      JSON.stringify(index, null, 2)
    );
  }
};
```

**Implementation Files**:
- `packages/markopress/src/search/indexer.ts` - NEW: Search index generation
- `packages/markopress/src/search/types.ts` - NEW: Search types
- `packages/theme-default/src/search/SearchBar.marko` - NEW: Search UI
- `packages/markopress/src/plugins/search/` - NEW: Search plugin

**Success Criteria**:
- ✅ Heading-based search index (like VitePress)
- ✅ Client-side search with fuzzy matching
- ✅ Shows header hierarchy in results
- ✅ Fast search performance (<100ms)

---

### Phase 4: Auto-Generated Navigation
**Timeline**: Week 10-11
**Priority**: MEDIUM - Better DX

**Objective**: Implement VitePress-style auto-generated navigation from file structure

#### 4.1 Sidebar Auto-Generation

**VitePress Pattern**:
```typescript
// Auto-generate from directory structure
const sidebar = fs.readdirSync(docsDir).map(file => ({
  text: frontmatter.title,
  link: `/${path.basename(file, '.md')}`
}));
```

**MarkoPress Implementation**:

```typescript
// packages/markopress/src/navigation/sidebar.ts
export async function generateSidebar(
  contentPath: string,
  config: SidebarConfig
): Promise<SidebarItem[]> {

  // Auto-generate from directory structure
  if (config === 'auto') {
    const files = await glob('**/*.md', { cwd: contentPath });

    return files.map(file => {
      const { frontmatter } = await parseFrontmatter(file);
      const url = path.relative(contentPath, file).replace('.md', '');
      const order = frontmatter.order || 999;

      return {
        text: frontmatter.title,
        link: `/${url}`,
        order,
        collapsed: frontmatter.collapsed || false
      };
    }).sort((a, b) => a.order - b.order);
  }

  // Manual configuration
  return config;
}
```

**Config Example**:
```typescript
// markopress.config.ts
export default defineConfig({
  theme: {
    sidebar: {
      '/docs/': 'auto', // Auto-generate from content/docs/
      '/guide/': [
        { text: 'Getting Started', link: '/guide/intro' },
        { text: 'Advanced', link: '/guide/advanced' }
      ]
    }
  }
});
```

#### 4.2 Active State Tracking

```typescript
// packages/markopress/src/navigation/active.ts
export function getActiveItem(
  sidebar: SidebarItem[],
  currentPath: string
): SidebarItem | null {
  for (const item of sidebar) {
    if (item.link === currentPath) {
      return item;
    }
    if (item.children) {
      const active = getActiveItem(item.children, currentPath);
      if (active) return active;
    }
  }
  return null;
}
```

**Implementation Files**:
- `packages/markopress/src/navigation/sidebar.ts` - NEW: Sidebar generation
- `packages/markopress/src/navigation/active.ts` - NEW: Active state tracking
- `packages/theme-default/src/components/Sidebar.marko` - Update with active state

**Success Criteria**:
- ✅ Auto-generate sidebar from file structure
- ✅ Support manual override
- ✅ Active state highlighting
- ✅ Collapsible nested sections

---

### Phase 5: Internationalization (i18n)
**Timeline**: Week 12-14
**Priority**: MEDIUM - Important for global sites

**Objective**: Implement Docusaurus-style i18n with subpath routing

#### 5.1 i18n Configuration

```typescript
// packages/markopress/src/i18n/config.ts
export interface I18nConfig {
  defaultLocale: string;
  locales: Record<string, LocaleConfig>;
}

export interface LocaleConfig {
  lang: string;
  label: string;
  title?: string;
  description?: string;
  themeConfig?: ThemeConfig;
}
```

**Config Example**:
```typescript
// markopress.config.ts
export default defineConfig({
  i18n: {
    defaultLocale: 'en',
    locales: {
      en: { label: 'English' },
      zh: { label: '简体中文' },
      ja: { label: '日本語' }
    }
  }
});
```

#### 5.2 Content Structure

```
content/
├── en/
│   ├── docs/
│   │   └── guide.md
│   └── blog/
└── zh/
    ├── docs/
    │   └── guide.md
    └── blog/
```

#### 5.3 Route Generation with i18n

```typescript
// Generate routes for each locale
for (const [locale, localeConfig] of Object.entries(i18n.locales)) {
  const contentPath = path.join(contentDir, locale, 'docs');
  const routesDir = path.join(baseRoutesDir, locale, 'docs');

  await generateRoutesForLocale(contentPath, routesDir, localeConfig);
}

// Results:
// /en/docs/guide
// /zh/docs/guide
// /ja/docs/guide
```

#### 5.4 i18n Plugin

```typescript
// packages/markopress/src/plugins/i18n/index.ts
export const i18nPlugin: MarkoPressPlugin = {
  name: '@markopress/plugin-i18n',

  config(config) {
    const i18nConfig = config.i18n;
    if (!i18nConfig) return config;

    // Transform content paths to include locale
    return {
      ...config,
      content: {
        ...config.content,
        // Dynamic content paths based on locale
      }
    };
  },

  async loadContent() {
    // Load content for each locale
    const locales = Object.keys(this.config.i18n.locales);
    const content: PluginContent = {};

    for (const locale of locales) {
      content[locale] = await scanLocaleContent(locale);
    }

    return content;
  }
};
```

**Implementation Files**:
- `packages/markopress/src/i18n/config.ts` - NEW: i18n types
- `packages/markopress/src/i18n/loader.ts` - NEW: Locale loading
- `packages/markopress/src/i18n/routes.ts` - NEW: Locale route generation
- `packages/markopress/src/plugins/i18n/` - NEW: i18n plugin

**Success Criteria**:
- ✅ Multi-language sites with subpath routing
- ✅ Locale-specific content directories
- ✅ Language switcher component
- ✅ RTL language support

---

### Phase 6: Dynamic Route Parameters
**Timeline**: Week 15-16
**Priority**: MEDIUM - Important for dynamic content

**Objective**: Implement VitePress-style dynamic routes with `.paths.ts`

#### 6.1 Dynamic Route Pattern

**VitePress Pattern**:
```
docs/
├── [id].md          # Dynamic route
└── [id].paths.ts    # Path generation
```

**MarkoPress Implementation**:

```
content/
└── docs/
    └── [slug].md           # Dynamic route
    └── [slug].paths.ts     # Path generation (sidecar)
```

#### 6.2 Path Generation File

```typescript
// content/docs/[slug].paths.ts
import type { PathConfig } from '@markopress/core';

export default {
  paths: [
    { params: { slug: 'guide' }, path: '/guide' },
    { params: { slug: 'api' }, path: '/api' },
    { params: { slug: 'tutorial' }, path: '/tutorial' }
  ]
} satisfies PathConfig;
```

#### 6.3 Route Generation

```typescript
// packages/markopress/src/routes/dynamic.ts
export async function generateDynamicRoutes(
  contentFile: ContentFile,
  routesDir: string
): Promise<void> {

  // Check for sidecar .paths.ts file
  const pathsFile = contentFile.filePath.replace('.md', '.paths.ts');
  let paths: PathConfig[] = [];

  if (await fileExists(pathsFile)) {
    // Load paths from sidecar
    const pathsModule = await import(pathsFile);
    paths = pathsModule.default.paths;
  } else {
    // Generate from catch-all pattern
    paths = generateCatchAllPaths(contentFile);
  }

  // Generate route for each path
  for (const pathConfig of paths) {
    const routePath = pathConfig.path;
    const handlerCode = `
      export async function GET(context, next) {
        context.params = ${JSON.stringify(pathConfig.params)};
        context.content = await loadContent(context.params);
      }
    `;

    await writeRoute(routesDir, routePath, handlerCode);
  }
}
```

**Implementation Files**:
- `packages/markopress/src/routes/dynamic.ts` - NEW: Dynamic route generation
- `packages/markopress/src/routes/types.ts` - Add PathConfig type

**Success Criteria**:
- ✅ Dynamic routes with `[param].md`
- ✅ Sidecar `.paths.ts` for path generation
- ✅ Params accessible in context
- ✅ Backward compatible with catch-all routes

---

### Phase 7: Versioning System
**Timeline**: Week 17-19
**Priority**: LOW - Niche use case

**Objective**: Implement Docusaurus-style doc versioning

#### 7.1 Version Configuration

```typescript
// markopress.config.ts
export default defineConfig({
  docs: {
    versions: {
      current: {
        label: '3.0',
        path: '/docs/3.0/',
        contentPath: 'content/docs/v3.0'
      },
      '2.x': {
        label: '2.0',
        path: '/docs/2.0/',
        contentPath: 'content/docs/v2.0'
      },
      '1.x': {
        label: '1.0',
        path: '/docs/1.0/',
        contentPath: 'content/docs/v1.0'
      }
    }
  }
});
```

#### 7.2 Version Metadata

```typescript
export interface VersionMetadata {
  name: string;
  label: string;
  path: string;
  contentPath: string;
  isLast: boolean;
}
```

#### 7.3 Version Plugin

```typescript
// packages/markopress/src/plugins/versioning/index.ts
export const versioningPlugin: MarkoPressPlugin = {
  name: '@markopress/plugin-versioning',

  async loadContent() {
    const versions = this.config.docs.versions;
    const content: PluginContent = {};

    for (const [versionName, versionConfig] of Object.entries(versions)) {
      content[versionName] = await scanVersionContent(versionConfig);
    }

    return content;
  },

  async allContentLoaded({ allContent, actions }) {
    // Generate version selector routes
    actions.addRoute({
      path: '/docs/versions',
      component: 'version-selector.marko',
      meta: { versions: getAllVersions() }
    });
  }
};
```

**Implementation Files**:
- `packages/markopress/src/versioning/types.ts` - NEW: Version types
- `packages/markopress/src/versioning/loader.ts` - NEW: Version loading
- `packages/markopress/src/plugins/versioning/` - NEW: Versioning plugin

**Success Criteria**:
- ✅ Multiple doc versions
- ✅ Version selector component
- ✅ Version-aware navigation
- ✅ Migration guides between versions

---

### Phase 8: Performance Optimizations
**Timeline**: Week 20-22
**Priority**: HIGH - Leverage Marko.js advantages

**Objective**: Implement performance optimizations surpassing VitePress/Docusaurus

#### 8.1 Build Performance

**RsPress Pattern** - Rust-based tooling:
```typescript
// Consider Rsbuild integration for faster builds
const rsbuild = await initRsbuild(config);
```

**MarkoPress Optimization**:
- Parallel content scanning with Worker threads
- Incremental build caching
- Virtual modules for runtime data
- Smart HMR for content changes

#### 8.2 Runtime Performance

**Marko.js Advantages**:
- **Faster than Vue/React**: Marko is significantly faster
- **True SSR**: No client-side hydration needed
- **Progressive Enhancement**: Works without JavaScript
- **Smaller bundles**: Less JavaScript to ship

**Implementation**:
```typescript
// Optimize Marko compilation
export function optimizeMarkoBuild() {
  return {
    // Tree-shake unused components
    // Minify Marko templates
    // Code-split by route
    // Lazy-load images
    // Prefetch links
  };
}
```

#### 8.3 Caching Strategy

```typescript
// packages/markopress/src/build/cache.ts
export class BuildCache {
  async get(cacheKey: string): Promise<any> {}
  async set(cacheKey: string, value: any): Promise<void> {}
  async invalidate(contentFiles: string[]): Promise<void> {}
}

// Use in build process
const cache = new BuildCache();
const cachedManifest = await cache.get('content-manifest');
```

**Implementation Files**:
- `packages/markopress/src/build/cache.ts` - NEW: Build caching
- `packages/markopress/src/build/optimizers.ts` - NEW: Build optimizations

**Success Criteria**:
- ✅ Build time <10 seconds for 100 pages
- ✅ Incremental builds <2 seconds
- ✅ HMR <100ms for content changes
- ✅ Lighthouse scores >95 across all metrics

---

### Phase 9: Developer Experience
**Timeline**: Week 23-25
**Priority**: MEDIUM - Important for adoption

**Objective**: Implement RsPress-style DX improvements

#### 9.1 Enhanced CLI

```typescript
// CLI with intelligent commands
markopress dev              # Start dev server
markopress dev --debug      # Debug mode with verbose logs
markopress build            # Production build
markopress build --analyze  # Bundle analysis
markopress preview          # Preview build
markopress init [template]  # Create new site from template
markopress migrate          # Migrate from VitePress/Docusaurus
```

#### 9.2 Configuration Improvements

```typescript
// Async configuration support
export default defineConfig(async () => {
  const data = await fetch('https://api.example.com/config');
  return {
    site: {
      title: data.title
    }
  };
});
```

#### 9.3 Error Handling

```typescript
// Better error messages with suggestions
Error: Route '/docs/guide' not found
  → Did you mean '/docs/guides'?
  → Check if the file exists: content/docs/guide.md
  → Verify the frontmatter has 'title' field
```

#### 9.4 Interactive Features

```typescript
// Interactive code playgrounds (like RsPress)
<code-playground
  language="marko"
  code="..."
  preview="true"
/>

// Live preview with HMR
```

**Implementation Files**:
- `packages/markopress/src/cli/index.ts` - Enhanced CLI
- `packages/markopress/src/config/async.ts` - NEW: Async config loading
- `packages/theme-default/src/components/CodePlayground.marko` - NEW: Interactive playground

**Success Criteria**:
- ✅ Intuitive CLI with helpful error messages
- ✅ Async configuration support
- ✅ Interactive components
- ✅ Migration tools from VitePress/Docusaurus

---

### Phase 10: AI/LLM Integration
**Timeline**: Week 26-27
**Priority**: LOW - Innovative feature

**Objective**: Implement RsPress-style AI/LLM text generation

#### 10.1 LLM Text Generation

```typescript
// packages/markopress/src/plugins/llm/index.ts
export const llmPlugin: MarkoPressPlugin = {
  name: '@markopress/plugin-llm',

  async postBuild({ outDir, allContent }) {
    const pages = allContent.getPages();

    // Generate LLM-friendly text
    const llmsTxt = generateLlmsTxt(pages, nav, siteConfig);

    // Write to output
    await fs.writeFile(
      path.join(outDir, 'llms.txt'),
      llmsTxt
    );
  }
};
```

**Output**: `/llms.txt` - Structured text for AI training

**Implementation Files**:
- `packages/markopress/src/plugins/llm/` - NEW: LLM plugin

**Success Criteria**:
- ✅ Generate `llms.txt` for AI training
- ✅ Generate `llms-full.txt` with complete content
- ✅ Support for custom LLM formats

---

## Phase 11: Testing & Documentation
**Timeline**: Week 28-30
**Priority**: HIGH - Ensure quality

**Objective**: Comprehensive testing and documentation

#### 11.1 Testing Strategy

```typescript
// Unit tests
packages/markopress/src/**/__tests__/*.test.ts

// Integration tests
tests/integration/plugin-lifecycle.test.ts
tests/integration/build-pipeline.test.ts
tests/integration/i18n.test.ts

// E2E tests
tests/e2e/*.spec.ts
```

#### 11.2 Documentation

- **Plugin API Documentation**: Complete plugin hook reference
- **Theme Authoring Guide**: How to create themes
- **Migration Guides**: From VitePress, Docusaurus
- **Performance Tuning**: Optimization techniques
- **Deployment Guides**: Vercel, Netlify, Cloudflare Pages

**Success Criteria**:
- ✅ 80%+ test coverage
- ✅ All features documented
- ✅ Example plugins and themes
- ✅ Migration guides available

---

## Phase 12: Release & Launch
**Timeline**: Week 31-32
**Priority**: HIGH - Successful launch

**Objective**: Prepare for stable release

#### 12.1 Stability Checklist

- ✅ All critical features implemented and tested
- ✅ Breaking changes documented with migration guide
- ✅ Performance benchmarks meet targets
- ✅ Security audit passed
- ✅ Documentation complete
- ✅ Example sites updated

#### 12.2 Launch Materials

- **Release Notes**: Comprehensive changelog
- **Blog Post**: Announcing MarkoPress 1.0
- **Demo Site**: Showcasing all features
- **Video Tutorial**: Getting started guide
- **Conference Talks**: Submit to conferences

**Success Criteria**:
- ✅ Stable 1.0 release
- ✅ Published to npm
- ✅ Featured in Marko.js ecosystem
- ✅ Community adoption starts

---

## Summary Timeline

| Phase | Feature | Weeks | Priority |
|-------|---------|-------|----------|
| 1 | Enhanced Plugin System | 1-3 | CRITICAL |
| 2 | Enhanced Theme System | 4-6 | HIGH |
| 3 | Search Functionality | 7-9 | HIGH |
| 4 | Auto-Generated Navigation | 10-11 | MEDIUM |
| 5 | i18n Support | 12-14 | MEDIUM |
| 6 | Dynamic Route Parameters | 15-16 | MEDIUM |
| 7 | Versioning System | 17-19 | LOW |
| 8 | Performance Optimizations | 20-22 | HIGH |
| 9 | Developer Experience | 23-25 | MEDIUM |
| 10 | AI/LLM Integration | 26-27 | LOW |
| 11 | Testing & Documentation | 28-30 | HIGH |
| 12 | Release & Launch | 31-32 | HIGH |

**Total**: 8 months to production-ready 1.0

---

## Key Implementation Files

### Core System
```
packages/markopress/src/
├── plugin/
│   ├── types.ts              # Plugin interface definitions
│   ├── context.ts            # NEW: Plugin context implementations
│   ├── manager.ts            # Plugin manager with hook execution
│   └── compat.ts             # NEW: Backward compatibility
├── build/
│   ├── index.ts              # Build pipeline (refactor)
│   ├── cache.ts              # NEW: Build caching
│   └── optimizers.ts         # NEW: Build optimizations
├── theme/
│   ├── types.ts              # Theme type definitions
│   ├── slots.ts              # NEW: Slot system
│   └── loader.ts             # Theme loading
├── search/
│   ├── indexer.ts            # NEW: Search index generation
│   └── types.ts              # NEW: Search types
├── navigation/
│   ├── sidebar.ts            # NEW: Sidebar generation
│   └── active.ts             # NEW: Active state tracking
├── i18n/
│   ├── config.ts             # NEW: i18n configuration
│   ├── loader.ts             # NEW: Locale loading
│   └── routes.ts             # NEW: Locale route generation
├── routes/
│   ├── dynamic.ts            # NEW: Dynamic route generation
│   └── types.ts              # Route type definitions
├── versioning/
│   ├── types.ts              # NEW: Version types
│   └── loader.ts             # NEW: Version loading
└── plugins/
    ├── search/               # NEW: Search plugin
    ├── i18n/                 # NEW: i18n plugin
    ├── versioning/           # NEW: Versioning plugin
    └── llm/                  # NEW: LLM plugin
```

### Theme Components
```
packages/theme-default/src/
├── components/
│   ├── SearchBar.marko       # NEW: Search UI
│   ├── Sidebar.marko         # Enhanced with active state
│   ├── Navbar.marko          # Enhanced with slots
│   ├── CodePlayground.marko  # NEW: Interactive playground
│   └── VersionSelector.marko # NEW: Version selector
├── layouts/
│   └── layout.marko          # Refactor with 20+ slots
└── styles.css                # Theme styles
```

---

## Success Metrics

### Feature Completeness
- ✅ Plugin system with full lifecycle (loadContent, contentLoaded, allContentLoaded, postBuild)
- ✅ 20+ theme slot extension points
- ✅ Client-side search with heading-based indexing
- ✅ Auto-generated navigation from file structure
- ✅ i18n support with subpath routing
- ✅ Dynamic route parameters with `.paths.ts`
- ✅ Versioning system for docs
- ✅ Performance exceeding VitePress/Docusaurus

### Performance Targets
- Build time <10s for 100 pages
- Incremental build <2s
- HMR <100ms
- Lighthouse Performance >95
- Lighthouse SEO >100
- Lighthouse Accessibility >100

### Developer Experience
- Intuitive CLI with helpful errors
- Comprehensive documentation
- Migration tools from VitePress/Docusaurus
- Plugin ecosystem with 10+ plugins
- Theme ecosystem with 3+ themes

### Community Adoption
- 1000+ npm weekly downloads by month 6
- 50+ GitHub stars by month 6
- 10+ community plugins by month 12
- Featured in 5+ blog posts

---

## Marko.js Advantages to Leverage

### 1. Performance
**Marko is faster than Vue/React**:
- Smaller runtime bundle
- Faster rendering
- Less memory usage
- Better SEO (true SSR)

### 2. Developer Experience
**Simpler syntax**:
```marko
<!-- Marko -->
<div if=showContent>Hello ${name}</div>

<!-- Vue -->
<div v-if="showContent">Hello {{ name }}</div>

<!-- React -->
{showContent && <div>Hello {name}</div>}
```

### 3. Progressive Enhancement
**Works without JavaScript**:
- Server-rendered HTML works instantly
- JavaScript enhances progressively
- Better resilience on poor connections

### 4. Build Integration
**@marko/run** advantages:
- Built for Marko from ground up
- Optimized for Marko compilation
- Excellent HMR support
- Fast incremental builds

---

## Competitive Analysis

| Feature | MarkoPress | VitePress | Docusaurus | RsPress |
|---------|-----------|-----------|------------|---------|
| **Framework** | Marko.js v6 | Vue 3 | React 18 | React 18 |
| **Build Speed** | Fast | Fast | Medium | Very Fast (Rust) |
| **Runtime Perf** | Very Fast | Fast | Medium | Fast |
| **Plugin System** | Comprehensive | Basic | Comprehensive | Good |
| **Theme Slots** | 20+ | 20+ | Swizzling | Good |
| **Search** | MiniSearch | MiniSearch | Algolia only | FlexSearch |
| **i18n** | Built-in | Built-in | Built-in | Built-in |
| **Versioning** | Plugin | ❌ | ✅ | ❌ |
| **Dynamic Routes** | ✅ | ✅ | ❌ | ✅ |
| **AI Integration** | ✅ | ❌ | ❌ | ✅ |
| **Learning Curve** | Low | Low | Medium | Low |

**MarkoPress Advantages**:
- ✅ Best performance (Marko.js)
- ✅ Most comprehensive plugin system
- ✅ Both search and versioning
- ✅ AI/LLM integration
- ✅ Simplest syntax

---

## Conclusion

This roadmap establishes MarkoPress as a **world-class static site generator** that:

1. **Surpasses VitePress** in performance, plugin flexibility, and features
2. **Rivals Docusaurus** in plugin architecture while being faster
3. **Innovates beyond RsPress** with comprehensive plugin system and versioning

**Key Success Factors**:
- ✅ Enhanced plugin system (foundation for everything)
- ✅ 20+ theme slots (match VitePress flexibility)
- ✅ Client-side search (critical feature)
- ✅ Performance optimizations (leverage Marko.js)
- ✅ Developer experience (intuitive CLI, docs, migration tools)

**Timeline**: 8 months to production-ready 1.0 release

**Next Steps**: Begin Phase 1 - Enhanced Plugin System implementation

---

**The future of static site generation is MarkoPress.** 🚀

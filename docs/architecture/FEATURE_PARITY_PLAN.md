# MarkoPress Feature Parity Plan

## Goal: Implement VitePress/Docusaurus-style features using Marko.js v6

Based on analysis of VitePress and Docusaurus, this plan outlines the architecture and implementation steps to achieve feature parity.

---

## Part 1: Feature Comparison

### Current MarkoPress Features vs VitePress/Docusaurus

| Feature | MarkoPress (Current) | VitePress | Docusaurus | Status |
|---------|---------------------|------------|-------------|---------|
| **Content Scanning** | ✅ Basic scanner | ✅ Advanced | ✅ Plugin-based | Needs enhancement |
| **Frontmatter Parsing** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Complete |
| **Route Generation** | ✅ Static & Catch-all | ✅ Static + Dynamic | ✅ Plugin-based | ⚠️ Dynamic routes incomplete |
| **Markdown Processing** | ✅ markdown-it + Shiki | ✅ markdown-it + Shiki | ✅ MDX | ⚠️ No MDX support |
| **Plugin System** | ✅ Hooks-based | ✅ Vite plugins | ✅ Plugin API | ⚠️ Limited hooks |
| **Theme System** | ✅ Slot-based | ✅ Vue slots | ✅ Swizzling | ⚠️ Basic slots |
| **Search** | ❌ No | ✅ Local/Algolia | ❌ Algolia only | ❌ Missing |
| **i18n** | ❌ No | ✅ Built-in | ✅ Built-in | ❌ Missing |
| **Versioning Docs** | ❌ No | ❌ No | ✅ Yes | ❌ Missing |
| **Blog** | ✅ Basic | ✅ Yes | ✅ Yes | ⚠️ Limited features |
| **Code Highlighting** | ✅ Shiki | ✅ Shiki | ✅ Prism.js | ✅ Good |
| **Dark Mode** | ✅ Basic | ✅ System-aware | ✅ Yes | ⚠️ No persistence |

---

## Part 2: Architectural Insights from VitePress/Docusaurus

### Key Patterns to Adopt

#### 1. **Content Plugin Architecture** (Docusaurus Pattern)

Instead of a monolithic build system, use separate plugins for different content types:

```typescript
// Plugin interface (Docusaurus-style)
interface MarkoPressPlugin {
  name: string;
  loadContent?(): Promise<Content>;
  contentLoaded?(ctx: ContentContext): void;
  allContentLoaded?(ctx: AllContentContext): void;
  postBuild?(ctx: BuildContext): void;
}
```

**Current MarkoPress:** Simple hooks
**Target:** Full plugin lifecycle with proper data flow

#### 2. **Theme Slot System** (VitePress Pattern)

VitePress uses extensive slot-based theming:

```marko
<!-- Layout with many extension points -->
<VPLayout>
  <VPNavbar>
    <template #navbar-title-before>
      <slot name="navbar-title-before"/>
    </template>
  </VPNavbar>

  <VPContent>
    <template #doc-top>
      <slot name="doc-top"/>
    </template>
  </VPContent>
</VPLayout>
```

**Current MarkoPress:** Basic layout
**Target:** 20+ extension points like VitePress

#### 3. **Dynamic Route Generation** (VitePress Pattern)

VitePress supports `[param].md` files with `.paths.ts`:

```typescript
// [id].paths.ts
export default {
  paths: [
    { params: { id: 'guide' }, path: '/guide' },
    { params: { id: 'api' }, path: '/api' }
  ]
}
```

**Current MarkoPress:** Only catch-all `$$slug`
**Target:** Parameterized routes with path generation

#### 4. **Search Indexing** (VitePress Pattern)

VitePress MiniSearch implementation:

```typescript
// Index pages by headings
function* splitPageIntoSections(html: string) {
  const sections = html.split(/<h2[^>]*>/);
  for (const section of sections) {
    yield { title, content, url };
  }
}
```

**Current MarkoPress:** None
**Target:** Client-side search with heading-based indexing

#### 5. **Navigation Generation** (VitePress Pattern)

VitePress auto-generates navigation from content:

```typescript
// Sidebar from directory structure
const sidebar = fs.readdirSync(docsDir).map(file => ({
  text: frontmatter.title,
  link: `/${path.basename(file, '.md')}`
}));
```

**Current MarkoPress:** Manual configuration
**Target:** Auto-generation with manual override option

---

## Part 3: Implementation Plan

### Phase 1: Enhanced Plugin System (Foundation)

**File:** `packages/markopress/src/plugin/types.ts`

```typescript
// Enhanced plugin interface with full lifecycle
export interface MarkoPressPlugin {
  name: string;

  // Content loading
  loadContent?(): Promise<Content | null>;

  // Content processing
  contentLoaded?(ctx: {
    content: Content;
    actions: {
      addRoute(route: RouteConfig): void;
      addData(key: string, value: unknown): void;
    };
  }): Promise<void> | void;

  // Global processing
  allContentLoaded?(ctx: {
    allContent: AllContent;
    actions: {
      addRoute(route: RouteConfig): void;
      addData(key: string, value: unknown): void;
    };
  }): Promise<void> | void;

  // Post-build hooks
  postBuild?(ctx: {
    outDir: string;
    routes: RouteManifest;
    assets: string[];
  }): Promise<void> | void;

  // Markdown extension (optional)
  extendMarkdown?: (md: MarkdownIt) => void;

  // Custom route handling (optional)
  extendRoutes?: (routes: RouteManifest) => RouteManifest;
}
```

**Benefits:**
- Clear separation of concerns
- Each content type (docs, blog, pages) as independent plugin
- Easy to add new content types

---

### Phase 2: Enhanced Theme System

**File:** `packages/markopress/src/theme/types.ts`

#### 2.1 Slot-Based Theme Components

```marko
<!-- packages/markopress/templates/layout.marko.template -->
class {
  // Provide default content for slots
  renderBody() {
    return <slot name="layout-top"/> + <input.content/> + <slot name="layout-bottom"/>;
  }
}

<!DOCTYPE html>
<html lang=$global.lang||"en">
<head>
  <slot name="head-top"/>
  <slot name="head-bottom"/>
</head>
<body>
  <slot name="body-top"/>

  <nav class="navbar">
    <slot name="navbar-start"/>
    <slot name="navbar-center"/>
    <slot name="navbar-end"/>
  </nav>

  <main class="content">
    <slot name="content-top"/>
    <slot name="content-before"/>
    <${input.content}/>
    <slot name="content-after"/>
    <slot name="content-bottom"/>
  </main>

  <slot name="body-bottom"/>
</body>
</html>
```

#### 2.2 Slot Registration System

```typescript
// packages/markopress/src/theme/slots.ts
export interface SlotConfig {
  name: string;
  component?: string; // Path to custom component
  location?: 'before' | 'after' | 'replace';
}

// Load user's slot overrides from .markopress/theme/
export async function loadSlots(dir: string): Promise<Map<string, string>> {
  const slotsDir = path.join(dir, 'theme', 'slots');
  const slotFiles = await glob('**/*.marko', { cwd: slotsDir });

  const slots = new Map();
  for (const file of slotFiles) {
    const slotName = path.basename(file, '.marko');
    slots.set(slotName, path.join(slotsDir, file));
  }
  return slots;
}
```

**Benefits:**
- Users can override any part of the layout
- Multiple extension points (like VitePress's 20+ slots)
- No need to fork entire theme

---

### Phase 3: Search Functionality

**File:** `packages/markopress/src/search/`

#### 3.1 Search Index Generation

```typescript
// packages/markopress/src/search/indexer.ts
export interface SearchDocument {
  id: string;
  title: string;
  titles: string[]; // Heading hierarchy
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
        titles: section.titles,
        content: stripHtml(section.content),
        url: page.urlPath
      });
    }
  }

  return docs;
}

function* splitPageIntoSections(html: string) {
  // Split by <h2> headings
  const parts = html.split(/<h2[^>]*>(.*?)<\/h2>/gi);

  let currentTitles: string[] = [];
  let currentTitle = '';

  for (let i = 0; i < parts.length; i++) {
    const headingMatch = parts[i].match(/<h2[^>]*>(.*?)<\/h2>/i);

    if (headingMatch) {
      currentTitle = headingMatch[1];
      currentTitles = [...currentTitles, stripHtml(currentTitle)];
    }

    const content = parts[i + 1] || '';
    yield {
      title: currentTitle,
      titles: [...currentTitles],
      content: stripHtml(content),
      anchor: generateAnchor(currentTitle)
    };
  }
}
```

#### 3.2 Client-Side Search Component

```marko
<!-- packages/theme-default/src/search/SearchBar.marko -->
<div class="search-bar">
  <input
    type="search"
    placeholder="Search docs..."
    on-keyup('handleSearch')
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

**Benefits:**
- Instant search results
- No server required
- Heading-based indexing (like VitePress)
- Fuzzy matching

---

### Phase 4: Internationalization (i18n)

**File:** `packages/markopress/src/i18n/`

```typescript
// packages/markopress/src/i18n/config.ts
export interface LocaleConfig {
  lang: string;
  label: string;
  title?: string;
  description?: string;
  themeConfig?: ThemeConfig;
}

export interface I18nConfig {
  defaultLocale: string;
  locales: Record<string, LocaleConfig>;
}

// Load locale configurations
export async function loadI18n(config: ResolvedConfig): Promise<I18nConfig> {
  const i18nConfig = config.i18n;
  if (!i18nConfig) {
    return null;
  }

  const locales: Record<string, LocaleConfig> = {};

  for (const [localeKey, localeConfig] of Object.entries(i18nConfig.locales)) {
    locales[localeKey] = {
      ...localeConfig,
      ...await loadLocaleConfig(localeKey, config)
    };
  }

  return {
    defaultLocale: i18nConfig.defaultLocale,
    locales
  };
}
```

**Route Generation with i18n:**

```typescript
// Generate routes for each locale
for (const [locale, localeConfig] of Object.entries(i18n.locales)) {
  const contentPath = path.join(contentDir, locale, 'docs');
  const routesDir = path.join(baseRoutesDir, locale, 'docs');

  await generateRoutesForLocale(contentPath, routesDir, localeConfig);
}
```

**Benefits:**
- Multi-language sites
- Localized URLs (`/en/guide`, `/zh/guide`)
- Translation file management
- RTL language support

---

### Phase 5: Enhanced Content Plugins

**File:** `packages/markopress/src/plugins/`

#### 5.1 Refactor Content Plugins as Independent Modules

```typescript
// packages/markopress/src/plugins/content-pages/index.ts
export const contentPagesPlugin: MarkoPressPlugin = {
  name: 'content-pages',

  loadContent() {
    return scanContentDirectory('content/pages');
  },

  contentLoaded({ content, actions }) {
    for (const page of content.pages) {
      actions.addRoute({
        path: page.urlPath,
        handler: generateHandler(page),
        template: loadTemplate('page.marko.template', { CONTENT: page.html })
      });
    }
  }
};
```

**Benefits:**
- Each content type is self-contained
- Easy to add new content types
- Clear separation of concerns
- Easier to test

---

### Phase 6: Auto-Generated Navigation

**File:** `packages/markopress/src/navigation/`

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

**Benefits:**
- Automatic sidebar generation
- Override with manual config
- Consistent with VitePress/Docusaurus UX

---

### Phase 7: Build Process Improvements

#### 7.1 Multi-Stage Build Pipeline

```typescript
// packages/markopress/src/build/pipeline.ts
export async function buildSite(config: ResolvedConfig) {

  // Stage 1: Scan content
  const manifest = await scanContent(config);

  // Stage 2: Load plugins
  const plugins = await loadPlugins(config.plugins);

  // Stage 3: Plugin lifecycle
  const pluginContext = new PluginContext(manifest);

  for (const plugin of plugins) {
    if (plugin.loadContent) {
      const content = await plugin.loadContent();
      pluginContext.addContent(content);
    }
  }

  for (const plugin of plugins) {
    await plugin.contentLoaded?.(pluginContext);
  }

  for (const plugin of plugins) {
    await plugin.allContentLoaded?.(pluginContext);
  }

  // Stage 4: Generate routes
  await generateRoutes(pluginContext.routes, config);

  // Stage 5: Generate search index
  const searchIndex = await generateSearchIndex(manifest, config);
  await fs.writeFile(
    path.join(config.build.outDir, 'search-index.json'),
    JSON.stringify(searchIndex, null, 2)
  );

  // Stage 6: Run @marko/run build
  await runMarkoBuild(config);

  // Stage 7: Post-build hooks
  for (const plugin of plugins) {
    await plugin.postBuild?.({
      outDir: config.build.outDir,
      routes: pluginContext.routes,
      assets: []
    });
  }

  console.log('✅ Build completed successfully!');
}
```

---

## Part 4: Priority Matrix

### High Priority (Core Features)

1. **Enhanced Plugin System** - Foundation for everything else
2. **Slot-Based Theming** - Better customization
3. **Search Functionality** - Critical user-facing feature
4. **Auto-Generated Navigation** - Better DX

### Medium Priority (Important Features)

5. **i18n Support** - International sites
6. **Enhanced Content Plugins** - Better architecture
7. **Build Pipeline Improvements** - Better performance

### Low Priority (Nice to Have)

8. **Versioning Docs** - Niche use case
9. **MDX Support** - Complex, may not align with Marko philosophy
10. **Advanced Analytics** - Can be plugins

---

## Part 5: Implementation Strategy

### Iterative Approach

**Sprint 1: Foundation**
- Week 1-2: Enhanced plugin system
- Week 2-3: Slot-based theming
- Week 3-4: Search functionality

**Sprint 2: User Experience**
- Week 1-2: Auto-generated navigation
- Week 2-3: i18n support
- Week 3-4: Build pipeline improvements

**Sprint 3: Polish**
- Week 1-2: Enhanced content plugins
- Week 3-4: Performance optimizations

### Testing Strategy

Each phase should include:
- Unit tests for new functions
- Integration tests for plugins
- E2E tests for user-facing features
- Performance benchmarks

---

## Part 6: Key Files to Create/Modify

### New Files

```
packages/markopress/src/
├── plugin/
│   ├── types.ts           # Enhanced plugin interface
│   └── context.ts          # Plugin context implementation
├── theme/
│   ├── types.ts           # Theme slot definitions
│   └── slots.ts           # Slot loading logic
├── search/
│   ├── indexer.ts         # Search index generation
│   └── client.marko       # Search UI component
├── i18n/
│   ├── config.ts          # i18n configuration
│   └── loader.ts         # Locale loading logic
├── navigation/
│   ├── sidebar.ts         # Auto-generation logic
│   └── navbar.ts         # Navbar generation
└── build/
    └── pipeline.ts        # Build pipeline orchestration
```

### Modified Files

```
packages/markopress/src/
├── build/index.ts         # Use new pipeline
├── plugins/
│   ├── content-pages/     # Convert to plugin format
│   ├── content-docs/      # Convert to plugin format
│   └── content-blog/      # Convert to plugin format
└── templates/
    ├── layout.marko.template  # Add slots
    └── *.marko.template     # Use $!{} syntax
```

---

## Part 7: Marko.js v6 Advantages

### Why MarkoPress can be better:

1. **Faster Rendering**: Marko is faster than Vue/React
2. **Simpler Syntax**: More intuitive than JSX/MDX
3. **Better SEO**: True SSR by default
4. **Smaller Bundle**: Less JavaScript to ship
5. **Progressive Enhancement**: Works without JS

### Leveraging Marko v6 Features

- **Class-based components**: Already using this ✅
- **State management**: Already implemented ✅
- **Native HTML rendering**: `$!{}` syntax ✅
- **Fast recompilation**: HMR works great ✅
- **Tree-shaking**: Minimal CSS/JS ✅

---

## Conclusion

This plan provides a roadmap to achieve feature parity with VitePress and Docusaurus while leveraging Marko.js v6's unique advantages. The modular, plugin-based architecture will make MarkoPress:
- More extensible
- Easier to maintain
- Better performing
- More enjoyable to use

The key insight: **Don't copy VitePress/Docusaurus exactly - adapt their best patterns while staying true to Marko's philosophy.**

# VitePress & Docusaurus Architecture Analysis

This document provides a comprehensive analysis of VitePress and Docusaurus architectures, explaining how they work and how MarkoPress implements similar features using Marko.js v6.

## Table of Contents

- [Overview](#overview)
- [VitePress Architecture](#vitepress-architecture)
- [Docusaurus Architecture](#docusaurus-architecture)
- [Comparative Analysis](#comparative-analysis)
- [MarkoPress Implementation](#markopress-implementation)
- [Implementation Roadmap](#implementation-roadmap)

---

## Overview

### VitePress
- **Framework**: Vue 3 + Vite
- **Build Tool**: Vite with custom plugins
- **Routing**: File-based with dynamic route support
- **Theme System**: Vue component-based with slot overrides
- **Plugin System**: Extends Vite plugins with custom hooks

### Docusaurus
- **Framework**: React 18/19
- **Build Tool**: Webpack 5 (with Rspack experimental)
- **Routing**: MDX-based with plugin-driven route generation
- **Theme System**: React components with swizzling
- **Plugin System**: Hooks-based with lifecycle methods

### MarkoPress (Target)
- **Framework**: Marko.js v6
- **Build Tool**: @marko/run
- **Routing**: File-based with route generation
- **Theme System**: Marko components with slot overrides
- **Plugin System**: Hooks-based API

---

## VitePress Architecture

### 1. Core Architecture

#### Monorepo Structure
```
vitepress/
├── src/
│   ├── client/              # Vue 3 client code
│   │   ├── app/            # App root and navigation
│   │   ├── theme-default/  # Default theme
│   │   └── composables/    # Vue composables
│   └── node/               # Node.js build tools
│       ├── build/          # Build system
│       ├── cli/            # CLI commands
│       ├── markdown/       # Markdown processing
│       └── plugins/        # Build plugins
```

#### Key Design Principles
1. **Separation of Concerns**: Client and server code are separate
2. **Plugin-Based**: Extends Vite's plugin system
3. **Convention Over Configuration**: File-based routing and content
4. **Performance-First**: LRU caching, code splitting, lazy loading

### 2. Build System

#### Build Process (`src/node/build/build.ts`)

```typescript
// VitePress Build Pipeline
async function build() {
  // 1. Load Configuration
  const config = await resolveConfig();

  // 2. Scan Content
  const pages = await scanContent(config.srcDir);

  // 3. Bundle Phase
  const clientResult = await buildClient(config);
  const serverResult = await buildServer(config);

  // 4. Render Phase (SSG)
  for (const page of pages) {
    const html = await renderPage(page, serverResult);
    await writeHTML(page.path, html);
  }

  // 5. Post-Processing
  await generateSitemap(config);
  await optimizeAssets();
}
```

#### Key Components

**1. Client Bundle**
```typescript
// Uses Vite to bundle Vue app
- Entry: src/client/app/index.ts
- Output: dist/assets/*.js
- Features: Code splitting, tree shaking, HMR
```

**2. Server Bundle**
```typescript
- Bundles server-side rendering code
- Includes markdown transforms
- Generates virtual modules for routes
```

**3. Static Site Generation**
```typescript
- Pre-renders each route to HTML
- Injects page metadata
- Generates hydration data
```

### 3. Route Generation System

#### Static Routes
```
File Structure           →  Route Path
index.md                →  /
guide.md                →  /guide
guide/getting-started.md → /guide/getting-started
```

#### Dynamic Routes
```typescript
// With [slug].md pattern
blog/[slug].md  →  blog/hello-world
                 blog/another-post

// .paths.ts defines parameters
export default {
  async paths() {
    return [
      { slug: 'hello-world' },
      { slug: 'another-post' }
    ];
  }
}
```

#### Implementation (`src/node/build/dynamicRoutesPlugin.ts`)

```typescript
export function dynamicRoutesPlugin() {
  return {
    name: 'vitepress:dynamic-routes',

    resolveId(id) {
      // Virtual module for route generation
      if (id === '@siteData') return '\0siteData';
    },

    load(id) {
      // Return route manifest
      return `
        export const routes = ${JSON.stringify(routes)};
      `;
    }
  };
}
```

### 4. Plugin System

#### Plugin Interface
```typescript
interface VPPlugin {
  name: string;

  // Config Hooks
  config?: (config: UserConfig) => UserConfig;
  configResolved?: (config: ResolvedConfig) => void;

  // Build Hooks
  buildStart?: () => void;
  buildEnd?: () => void;

  // Content Hooks
  transformPageIndex?: (page: PageData) => PageData;
  extendFrontmatter?: (fm: Frontmatter) => Frontmatter;

  // Markdown Hooks
  extendMarkdown?: (md: MarkdownIt) => void;

  // Route Hooks
  extendRoutes?: (routes: Route[]) => Route[];
}
```

#### Built-in Plugins
```typescript
// Markdown enhancement
markdownPlugin({
  theme: {
    light: 'github-light',
    dark: 'github-dark'
  },
  lineNumbers: true
});

// Custom components
componentsPlugin({
  components: {
    'Badge': 'Badge.vue',
    'VCard': 'VCard.vue'
  }
});

// Static data
dataPlugin({
  glob: '**/*.json'
});
```

### 5. Theme System

#### Theme Structure
```
theme-default/
├── Layout.vue           # Root layout
├── components/
│   ├── VPSidebar.vue   # Sidebar navigation
│   ├── VPNavbar.vue    # Top navigation
│   ├── VPDoc.vue       # Documentation layout
│   └── VPFooter.vue    # Footer
├── composables/
│   useNav.ts           # Navigation logic
│   useSidebar.ts       # Sidebar logic
└── styles/
    └── index.css       # Theme styles
```

#### Theme Override System
```typescript
// .vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme';
import MyComponent from './MyComponent.vue';

export default {
  extends: DefaultTheme,

  enhanceApp({ app, router, siteData }) {
    // Register global components
    app.component('MyComponent', MyComponent);
  },

  Layout() {
    // Override layout
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content': () => h('div', 'Custom Nav')
    });
  }
};
```

### 6. Markdown Processing

#### Pipeline (`src/node/markdown/markdown.ts`)

```typescript
// 1. Create markdown-it instance
const md = markdownit({
  html: true,
  linkify: true,
  typographer: true
});

// 2. Apply plugins
md.use(anchor);                    // Anchor links
md.use(attributes);                // Custom attributes
md.use(emoji);                     // Emoji support
md.use(container);                 // Custom containers

// 3. Vue-specific plugins
md.use(mditVue);
md.use(markdownItVue);

// 4. Syntax highlighting
await setupShiki(md, config);

// 5. Process markdown
const result = md.render(source);
```

#### Custom Containers
```markdown
::: tip
This is a tip
:::

::: warning
This is a warning
:::

::: danger
This is dangerous
:::
```

#### Vue Component Embedding
```markdown
<Badge text="v2.0" type="warning" />

<VCard>
  Custom content here
</VCard>
```

### 7. Dev Server

#### Implementation (`src/node/dev/dev.ts`)

```typescript
import { createServer as createViteServer } from 'vite';
import polka from 'polka';
import sirv from 'sirv';

export async function createDevServer() {
  // 1. Create Vite dev server
  const vite = await createViteServer({
    configFile: false,
    server: { middlewareMode: true }
  });

  // 2. Create Polka server
  const app = polka();

  // 3. Add middlewares
  app.use((req, res, next) => {
    // Markdown files → Vue transform
    if (req.path.endsWith('.md')) {
      return transformMarkdown(req.path);
    }
    next();
  });

  app.use(vite.middlewares);
  app.use(sirv('public'));

  // 4. Start server
  app.listen(4173);
}
```

#### Features
- **Instant HMR**: Markdown changes trigger hot reload
- **Virtual Modules**: Routes and config injected as virtual modules
- **Fast Refresh**: Vue component changes preserve state
- **Error Overlay**: Build errors shown in browser

### 8. Configuration System

#### Config Loading (`src/node/config.ts`)

```typescript
// 1. Resolve config file
const configFile = await resolveConfigFile(root);

// 2. Load with TypeScript support
const userConfig = await loadConfig(configFile);

// 3. Apply defaults
const config = mergeConfig(defaultConfig, userConfig);

// 4. Validate
await validateConfig(config);

// 5. Resolve references
config.theme = resolveTheme(config.theme);
```

#### Configuration Structure
```typescript
interface UserConfig {
  // Site metadata
  title: string;
  description: string;
  base: string;
  url: string;

  // Theme
  theme: string;
  themeConfig: ThemeConfig;

  // Markdown
  markdown: {
    theme?: { light?: string; dark?: string };
    lineNumbers?: boolean;
    config?: (md: MarkdownIt) => void;
  };

  // Build
  srcDir?: string;
  srcExclude?: string[];
  outDir?: string;
  cacheDir?: string;

  // Vite
  vite?: ViteConfig;

  // Appearance
  appearance?: boolean | 'dark' | 'light';

  // SEO
  head?: HeadTag[];

  // Locale
  locales?: Record<string, LocaleConfig>;
}
```

---

## Docusaurus Architecture

### 1. Core Architecture

#### Monorepo Structure
```
docusaurus/
├── packages/
│   ├── docusaurus/              # Core package
│   │   ├── src/
│   │   │   ├── client/         # React client code
│   │   │   ├── server/         # Node.js build tools
│   │   │   ├── commands/       # CLI commands
│   │   │   └── plugins/        # Plugin system
│   ├── docusaurus-preset-classic/  # Default preset
│   ├── docusaurus-theme-classic/   # Default theme
│   ├── docusaurus-plugin-content-docs/
│   ├── docusaurus-plugin-content-blog/
│   ├── docusaurus-plugin-content-pages/
│   └── docusaurus-plugin-sitemap/
```

#### Key Design Principles
1. **Plugin-First**: Everything is a plugin
2. **Preset-Based**: Curated plugin bundles
3. **MDX-Centric**: MDX for React component embedding
4. **Versioning**: Built-in docs versioning
5. **i18n**: Comprehensive internationalization

### 2. Build System

#### Build Process (`packages/docusaurus/src/commands/build/build.ts`)

```typescript
async function build() {
  // 1. Load Site
  const site = await loadSite();

  // 2. Build Plugins
  await loadPlugins(site);

  // 3. Load Content
  await pluginsLoadContent(site);

  // 4. Create Webpack Configs
  const clientConfig = createClientConfig(site);
  const serverConfig = createServerConfig(site);

  // 5. Bundle
  const clientStats = await webpack(clientConfig);
  const serverStats = await webpack(serverConfig);

  // 6. SSG
  await generateSite(site);

  // 7. Post Build
  await pluginsPostBuild(site);
}
```

#### Webpack Configuration
```typescript
// Client Config
{
  entry: {
    main: './src/client/index.js'
  },
  output: {
    path: 'build/assets',
    filename: 'js/[name].[contenthash:8].js'
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /node_modules/,
          name: 'vendor'
        }
      }
    }
  }
}
```

### 3. Route Generation System

#### Plugin-Driven Routes

```typescript
// Docs Plugin
{
  id: 'docs',
  routes: [
    {
      path: '/docs',
      component: '@theme/DocPage',
      routes: [
        { path: '/docs/intro', component: '@theme/DocItem' },
        { path: '/docs/guide', component: '@theme/DocItem' }
      ]
    }
  ]
}

// Blog Plugin
{
  id: 'blog',
  routes: [
    {
      path: '/blog',
      component: '@theme/BlogListPage',
      routes: [
        { path: '/blog/first-post', component: '@theme/BlogPostPage' }
      ]
    }
  ]
}

// Pages Plugin
{
  id: 'pages',
  routes: [
    { path: '/', component: './src/pages/index.js' },
    { path: '/about', component: './src/pages/about.js' }
  ]
}
```

#### Route Generation Flow
```typescript
// 1. Plugins scan content
const content = await plugin.loadContent();

// 2. Plugins generate routes
const routes = plugin.contentLoaded(content);

// 3. Routes are merged
const allRoutes = mergeRoutes(plugins);

// 4. React Router config generated
const routerConfig = generateRouterConfig(allRoutes);

// 5. Routes are registered
app.routes = routerConfig;
```

### 4. Plugin System

#### Plugin Interface
```typescript
interface Plugin {
  name: string;
  version: string;

  // Lifecycle Hooks
  extendCli?: (cli: CLI) => void;
  getPathsToWatch?: () => string[];

  // Content Hooks
  loadContent?: () => Promise<Content>;
  contentLoaded?: (params: ContentLoadedParams) => void;

  // Build Hooks
  configureWebpack?: (config: WebpackConfig) => WebpackConfig;
  configurePostCss?: (config: PostCssConfig) => PostCssConfig;

  // HTML Hooks
  injectHtmlTags?: () => HtmlTags;

  // Post Build Hooks
  postBuild?: (params: PostBuildParams) => void;

  // Theme Hooks
  getThemePath?: () => string;
  getTypeScriptThemePath?: () => string;
}
```

#### Plugin Loading
```typescript
// Load plugins from config
const plugins = loadPlugins(config);

// Initialize plugins
for (const plugin of plugins) {
  // Load plugin module
  const module = await import(plugin.path);

  // Call initialization
  if (module.init) {
    await module.init(plugin.options);
  }

  // Register hooks
  registerHooks(plugin.name, module);
}
```

#### Content Plugin Pattern
```typescript
// Example: Docs Plugin
class DocsPlugin {
  name = 'docusaurus-plugin-content-docs';

  async loadContent() {
    // Scan docs directory
    const files = await glob('docs/**/*.md');

    // Parse frontmatter
    const docs = files.map(file => ({
      id: getDocId(file),
      path: getDocPath(file),
      frontmatter: parseFrontmatter(file),
      content: await readFile(file)
    }));

    return { docs };
  }

  contentLoaded({ content, actions }) {
    const { docs } = content;
    const { addRoute, createData } = actions;

    // Create route data
    for (const doc of docs) {
      const docData = await createData(
        `doc-${doc.id}.json`,
        doc
      );

      // Add route
      addRoute({
        path: doc.path,
        component: '@theme/DocItem',
        exact: true,
        modules: {
          doc: docData
        }
      });
    }
  }
}
```

### 5. Theme System

#### Theme Swizzling

**1. Eject (Full Override)**
```bash
docusaurus swizzle [theme-name] [component-name] --eject
```

**2. Wrap (Partial Override)**
```bash
docusaurus swizzle [theme-name] [component-name] --wrap
```

**3. TypeScript Support**
```bash
docusaurus swizzle [theme-name] [component-name] --typescript
```

#### Theme Component Pattern
```typescript
// Original component
function DocItem({ content }) {
  return (
    <div className="doc">
      <h1>{content.title}</h1>
      <div>{content.body}</div>
    </div>
  );
}

// Wrapped component
function WrappedDocItem(props) {
  // Add custom logic
  useEffect(() => {
    trackPageView(props.content.id);
  }, []);

  // Call original
  return (
    <div className="custom-wrapper">
      <OriginalDocItem {...props} />
    </div>
  );
}
```

### 6. Markdown Processing

#### MDX Pipeline
```typescript
// 1. Parse MDX
const mdxAst = parseMDX(source);

// 2. Transform with Remark
const remarkPlugins = [
  remarkParse,
  remarkFrontmatter,
  remarkGfm,
  remarkEmoji,
  remarkMath
];

const hast = await remark()
  .use(remarkPlugins)
  .run(mdxAst);

// 3. Transform with Rehype
const rehypePlugins = [
  rehypeSlug,
  rehypeAutolinkHeadings,
  rehypePrism
];

const html = await rehype()
  .use(rehypePlugins)
  .run(hast);

// 4. Compile to React
const jsx = compileMDX(html);
```

#### MDX Component Embedding
```markdown
import Button from '@site/src/components/Button';

# Hello World

<Button label="Click me" />

Some content...
```

#### Custom Admonitions
```markdown
:::tip
This is a tip
:::

:::warning
This is a warning
:::

:::danger
This is dangerous
:::
```

### 7. Versioning System

#### Version Architecture
```
docs/
├── current/          # Latest version (symlink)
├── v2.0.0/          # Version 2.0.0
├── v1.9.0/          # Version 1.9.0
└── versions.json    # Version metadata
```

#### Version Routing
```typescript
// /docs/intro → latest
// /docs/v2.0.0/intro → v2.0.0
// /docs/v1.9.0/intro → v1.9.0

const routes = [
  {
    path: '/docs/:version/:path*',
    component: '@theme/DocItem'
  },
  {
    path: '/docs/:path*',
    component: '@theme/DocItem'
  }
];
```

#### Version Selector
```typescript
function VersionDropdown() {
  const versions = useVersions();
  const activeVersion = useActiveVersion();

  return (
    <Dropdown>
      {versions.map(version => (
        <DropdownItem
          href={version.path}
          active={version === activeVersion}
        >
          {version.label}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
```

### 8. i18n System

#### Locale Structure
```
i18n/
├── en/
│   └── docusaurus-plugin-content-docs/
│       └── current/
│           ├── intro.md
│           └── guide.md
├── fr/
│   └── docusaurus-plugin-content-docs/
│       └── current/
│           ├── intro.md
│           └── guide.md
└── ja/
    └── docusaurus-plugin-content-docs/
        └── current/
```

#### Configuration
```typescript
// docusaurus.config.ts
module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr', 'ja'],
    localeConfigs: {
      en: {
        label: 'English',
        direction: 'ltr'
      },
      fr: {
        label: 'Français',
        direction: 'ltr'
      },
      ja: {
        label: '日本語',
        direction: 'ltr'
      }
    }
  }
};
```

#### Translation Files
```typescript
// translations.json
{
  "theme.common.skipToContent": "Skip to main content",
  "theme.navbar.home": "Home"
}

// Usage
<Translate id="theme.navbar.home">Home</Translate>
```

---

## Comparative Analysis

### Feature Comparison

| Feature | VitePress | Docusaurus | MarkoPress (Target) |
|---------|-----------|------------|---------------------|
| **Framework** | Vue 3 | React 18/19 | Marko.js v6 |
| **Build Tool** | Vite | Webpack 5 | @marko/run |
| **Markdown** | markdown-it | MDX | markdown-it |
| **Syntax Highlighting** | Shiki | Prism.js | Shiki |
| **Routing** | File-based + Dynamic | Plugin-driven | File-based + Dynamic |
| **Theme System** | Vue Components | React Components | Marko Components |
| **Plugin System** | Vite Ext + Hooks | Hooks-based | Hooks-based |
| **Versioning** | ❌ No | ✅ Yes | ✅ Planned |
| **i18n** | ✅ Yes | ✅ Yes | ✅ Planned |
| **HMR** | ✅ Fast | ⚠️ Moderate | ✅ Instant |
| **Build Speed** | ⚡ Fastest | 🐌 Slowest | ⚡ Fast |
| **Bundle Size** | 📦 Medium | 📦 Largest | 📦 Minimal |

### Architecture Patterns

| Aspect | VitePress | Docusaurus | MarkoPress |
|--------|-----------|------------|------------|
| **Routing** | File convention | Plugin generation | Plugin generation |
| **Content Loading** | File scanning | Plugin hooks | Plugin hooks |
| **Markdown Processing** | markdown-it plugins | MDX + Remark/Rehype | markdown-it plugins |
| **Theme Override** | Component extends | Swizzling | Slot overrides |
| **State Management** | Vue composables | React hooks | Marko state |
| **Code Splitting** | Vite automatic | Webpack chunks | @marko/run automatic |

---

## MarkoPress Implementation

### Current Status

MarkoPress already implements several core features:

#### ✅ Implemented Features

1. **File-Based Routing**
   - Content scanning from `content/` directories
   - Automatic route generation (`content/pages/` → `/`, `content/docs/` → `/docs/*`)
   - Dynamic routes via plugins

2. **Markdown Processing**
   - markdown-it with Shiki syntax highlighting
   - Custom containers (`::: tip`, `::: warning`, `::: danger`)
   - Frontmatter parsing
   - GitHub Flavored Markdown

3. **Plugin System**
   - Hooks API (`contentLoaded`, `beforeBuild`, `extendMarkdown`, etc.)
   - Built-in content plugins (pages, docs, blog)
   - Plugin configuration support

4. **Theme System**
   - Slot-based overrides
   - Default theme with components
   - Layout customization

5. **Build System**
   - @marko/run integration
   - Static site generation
   - Asset optimization

6. **Configuration**
   - TypeScript config loading
   - Site metadata
   - Theme configuration

#### 🚧 Features to Implement

### 1. Versioning System

**Implementation Plan**

```typescript
// packages/plugin-content-docs/src/versioning.ts

export interface Version {
  name: string;
  label: string;
  path: string;
  isLast: boolean;
}

export class VersionManager {
  private versions: Version[] = [];

  async loadVersions() {
    // Scan versioned content directories
    const versionDirs = await glob('content/docs/v*');

    this.versions = versionDirs.map(dir => ({
      name: basename(dir),
      label: basename(dir),
      path: `/docs/${basename(dir)}`,
      isLast: false
    }));

    // Add current version
    this.versions.push({
      name: 'current',
      label: 'Next',
      path: '/docs',
      isLast: true
    });
  }

  getVersions(): Version[] {
    return this.versions;
  }

  getCurrentVersion(): Version {
    return this.versions[this.versions.length - 1];
  }
}
```

**Route Generation**

```typescript
// Generate versioned routes
export function generateVersionedRoutes(versions: Version[]) {
  const routes = [];

  for (const version of versions) {
    const docs = await loadDocs(version.name);

    for (const doc of docs) {
      routes.push({
        path: version.isLast
          ? `/docs/${doc.slug}`
          : `/docs/${version.name}/${doc.slug}`,
        component: 'DocPage',
        meta: {
          version: version.name,
          doc: doc.id
        }
      });
    }
  }

  return routes;
}
```

**UI Component**

```marko
<!-- theme-default/src/components/VersionDropdown.marko -->
<dropdown>
  <button slot="trigger">
    ${state.activeVersion.label}
    <svg class="caret" />
  </button>

  <ul slot="content">
    <for|version of input.versions|>
      <li>
        <a href=version.path>
          ${version.label}
        </a>
      </li>
    </for>
  </ul>
</dropdown>
```

### 2. Internationalization (i18n)

**Implementation Plan**

```typescript
// packages/markopress/src/i18n/index.ts

export interface LocaleConfig {
  label: string;
  lang: string;
  direction: 'ltr' | 'rtl';
}

export class I18nManager {
  private locales: Map<string, LocaleConfig> = new Map();
  private defaultLocale: string;

  constructor(config: I18nConfig) {
    this.defaultLocale = config.defaultLocale;

    for (const [locale, cfg] of Object.entries(config.locales)) {
      this.locales.set(locale, cfg);
    }
  }

  getLocale(path: string): string {
    // Extract locale from path
    const match = path.match(/^\/([a-z]{2})\//);
    return match ? match[1] : this.defaultLocale;
  }

  getLocales(): LocaleConfig[] {
    return Array.from(this.locales.entries()).map(([code, config]) => ({
      code,
      ...config
    }));
  }

  async loadTranslationFile(locale: string, domain: string) {
    const path = `i18n/${locale}/${domain}.json`;
    return JSON.parse(await readFile(path));
  }
}
```

**Translation Function**

```typescript
// src/i18n/translate.ts

export function createTranslator(locale: string) {
  const translations = loadTranslations(locale);

  return function translate(
    id: string,
    args: Record<string, string> = {}
  ): string {
    let message = translations[id] || id;

    // Replace placeholders
    for (const [key, value] of Object.entries(args)) {
      message = message.replace(`{${key}}`, value);
    }

    return message;
  };
}
```

**Marko Component**

```marko
<!-- Translate Component -->
<translate|id, args={}|>
  ${$global.t(id, args)}
</translate>

<!-- Usage -->
<translate id="theme.navbar.home" />
<translate id="theme.common.welcome" args="{name: 'User'}" />
```

### 3. Enhanced Markdown Features

**Table of Contents**

```typescript
// packages/markopress/src/markdown/toc.ts

export interface TocItem {
  level: number;
  title: string;
  anchor: string;
  children: TocItem[];
}

export function extractTOC(markdown: string): TocItem[] {
  const headings = markdown.match(/^#{1,6}\s+(.+)$/gm) || [];

  return headings.map(heading => {
    const level = heading.match(/^#{1,6}/)![0].length;
    const title = heading.replace(/^#{1,6}\s+/, '');
    const anchor = slugify(title);

    return { level, title, anchor, children: [] };
  });
}
```

**Code Group**

```markdown
:::code-group

```bash [npm]
npm install markopress
```

```bash [pnpm]
pnpm install markopress
```

```bash [yarn]
yarn add markopress
```

:::
```

**Implementation**

```typescript
// Markdown-it plugin
export function codeGroupPlugin(md: MarkdownIt) {
  md.use(container, 'code-group', {
    render: (tokens, idx) => {
      const token = tokens[idx];
      if (token.nesting === 1) {
        return '<div class="code-group">';
      } else {
        return '</div>';
      }
    }
  });

  // Parse code block titles [label]
  md.renderer.rules.fence = function(..., info) {
    const match = info.match(/\[([^\]]+)\]$/);
    const label = match ? match[1] : '';
    // Render code block with label
  };
}
```

### 4. Search Functionality

**Implementation Plan**

```typescript
// packages/plugin-search/src/index.ts

interface SearchDocument {
  id: string;
  title: string;
  content: string;
  path: string;
}

export class SearchIndexer {
  async buildIndex(docs: SearchDocument[]) {
    // Build MiniSearch index
    const index = new MiniSearch({
      fields: ['title', 'content'],
      storeFields: ['title', 'path']
    });

    index.addAll(docs);

    // Write to file
    await writeFile('public/search-index.json', JSON.stringify(index));
  }
}
```

**Search Component**

```marko
<!-- theme-default/src/components/Search.marko -->
<div class="search">
  <input
    type="search"
    placeholder="Search docs..."
    on-input("handleInput")
  />

  <if(input.results.length > 0)>
    <ul class="search-results">
      <for|result of input.results|>
        <li>
          <a href=result.path>
            <h3>${result.title}</h3>
            <p>${result.excerpt}</p>
          </a>
        </li>
      </for>
    </ul>
  </if>
</div>

<script>
  import { loadIndex } from 'search:mini-search';

  let index = null;

  function onMount() {
    index = loadIndex();
  }

  function handleInput(event) {
    const query = event.target.value;
    const results = index.search(query);
    // Update UI
  }
</script>
```

### 5. Enhanced Plugin System

**Lifecycle Hooks**

```typescript
// packages/markopress/src/plugin/types.ts

export interface MarkoPressPlugin {
  name: string;

  // Configuration hooks
  config?: (config: UserConfig) => UserConfig;
  configResolved?: (config: ResolvedConfig) => void;

  // Content hooks
  contentLoaded?: (ctx: ContentContext) => void | Promise<void>;

  // Build hooks
  beforeBuild?: (ctx: BuildContext) => void | Promise<void>;
  afterBuild?: (ctx: BuildContext) => void | Promise<void>;
  buildEnd?: (ctx: BuildContext) => void | Promise<void>;

  // Markdown hooks
  extendMarkdown?: (md: MarkdownIt) => void;

  // Route hooks
  extendRoutes?: (routes: RouteManifest) => RouteManifest;

  // HTML hooks
  transformHead?: (tags: HeadTag[]) => HeadTag[];

  // Dev server hooks
  configureDevServer?: (server: DevServer) => void;

  // Theme hooks
  extendTheme?: (theme: ThemeConfig) => ThemeConfig;
}
```

**Plugin Example**

```typescript
// Example: Image optimization plugin
export const imageOptPlugin: MarkoPressPlugin = {
  name: 'image-optimization',

  async beforeBuild(ctx) {
    // Find all images
    const images = await glob('content/**/*.{png,jpg,jpeg,webp}');

    // Optimize images
    for (const image of images) {
      await sharp(image)
        .resize(1920, 1080, { fit: 'inside' })
        .webp({ quality: 80 })
        .toFile(image.replace(/\.\w+$/, '.webp'));
    }
  },

  extendMarkdown(md) {
    // Transform image links
    md.renderer.rules.image = function(tokens, idx) {
      const src = tokens[idx].attrGet('src');
      const webpSrc = src.replace(/\.\w+$/, '.webp');

      return `<picture>
        <source srcset="${webpSrc}" type="image/webp">
        <img src="${src}" loading="lazy">
      </picture>`;
    };
  }
};
```

---

## Implementation Roadmap

### Phase 1: Core Enhancements (Current)

- [x] File-based routing
- [x] Markdown processing with Shiki
- [x] Plugin system with hooks
- [x] Theme system with slots
- [x] Build system with @marko/run
- [ ] Enhanced markdown features (code groups, tabs)
- [ ] Table of contents generation
- [ ] Prev/next navigation

### Phase 2: Content Features

- [ ] Versioning system for docs
- [ ] Internationalization (i18n)
- [ ] Search functionality
- [ ] Tag and category system for blog
- [ ] Reading time estimation
- [ ] Content pagination

### Phase 3: UX Improvements

- [ ] Dark mode toggle
- [ ] Responsive navigation
- [ ] Scroll progress indicator
- [ ] Breadcrumb navigation
- [ ] Print-friendly styles
- [ ] Keyboard shortcuts

### Phase 4: Developer Experience

- [ ] TypeScript strict mode
- [ ] Content validation
- [ ] Broken link checker
- [ ] Linting for markdown
- [ ] CLI improvements
- [ ] Performance monitoring

### Phase 5: Advanced Features

- [ ] Multiple content sources (Git, CMS)
- [ ] Incremental build
- [ ] Edge deployment support
- [ ] API routes
- [ ] Server components
- [ ] Analytics integration

---

## Conclusion

VitePress and Docusaurus both provide excellent static site generation with different approaches:

- **VitePress** prioritizes simplicity and performance with Vite's instant HMR
- **Docusaurus** offers enterprise features like versioning and comprehensive i18n

MarkoPress combines the best of both worlds with Marko.js v6's exceptional performance:

- ✅ **Fast builds** via @marko/run
- ✅ **Instant HMR** with Marko's reactivity
- ✅ **Minimal bundles** with Marko's compiled output
- ✅ **Plugin system** inspired by Docusaurus
- ✅ **File-based routing** like VitePress

The implementation roadmap ensures MarkoPress achieves feature parity while maintaining superior performance characteristics.

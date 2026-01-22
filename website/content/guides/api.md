# API Reference

Complete API documentation for MarkoPress.

## Config API

### defineConfig

Define your MarkoPress configuration.

```typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'My Site',
    description: 'My awesome site',
  },
});
```

### MarkoPressConfig

Main configuration interface.

```typescript
interface MarkoPressConfig {
  site: SiteConfig;
  content?: ContentConfig;
  theme?: string | ThemeConfig;
  themeConfig?: ThemeOptions;
  markdown?: MarkdownConfig;
  build?: BuildConfig;
  plugins?: PluginConfig[];
}
```

### SiteConfig

Site metadata and configuration.

```typescript
interface SiteConfig {
  // Site title (required)
  title: string;

  // Site description for SEO
  description?: string;

  // Base URL (if deploying to subdirectory)
  base?: string; // Default: '/'

  // Site language
  lang?: string; // Default: 'en-US'

  // Full site URL (for sitemap, canonical URLs)
  url?: string;

  // Logo path
  logo?: string;

  // Favicon path
  favicon?: string;

  // Custom head tags
  head?: HeadTag[];
}
```

**Example:**

```typescript
export default defineConfig({
  site: {
    title: 'My Site',
    description: 'My awesome site built with MarkoPress',
    base: '/',
    lang: 'en-US',
    url: 'https://example.com',
    logo: '/logo.png',
    favicon: '/favicon.ico',
    head: [
      ['link', { rel: 'icon', href: '/favicon.ico' }],
      ['meta', { name: 'theme-color', content: '#667eea' }],
    ],
  },
});
```

### ContentConfig

Content directory configuration.

```typescript
interface ContentConfig {
  // Pages directory (→ /route)
  pages?: string; // Default: 'content/pages'

  // Docs directory (→ /docs/route)
  docs?: string; // Default: 'content/docs'

  // Blog directory (→ /blog/route)
  blog?: string; // Default: 'content/blog'

  // Custom content directories
  custom?: Record<string, string>;
}
```

**Example:**

```typescript
export default defineConfig({
  content: {
    pages: 'content/pages',
    docs: 'content/docs',
    blog: 'content/posts',
    custom: {
      recipes: 'content/recipes',  // → /recipes/route
      portfolio: 'content/work',   // → /portfolio/route
    },
  },
});
```

### ThemeConfig

Theme configuration.

```typescript
interface ThemeConfig {
  // Theme package name or path
  theme?: string; // Default: '@markopress/theme-default'

  // Theme options
  themeConfig?: ThemeOptions;
}
```

### ThemeOptions

Theme-specific options (for @markopress/theme-default).

```typescript
interface ThemeOptions {
  // Site name (overrides site.title)
  name?: string;

  // Site description (overrides site.description)
  description?: string;

  // Logo (overrides site.logo)
  logo?: string;

  // Navigation bar
  navbar?: NavbarItem[];

  // Sidebar configuration
  sidebar?: SidebarConfig;

  // Footer configuration
  footer?: FooterConfig;

  // Feature toggles
  features?: {
    darkMode?: boolean;      // Default: true
    search?: boolean;        // Default: false
    editLink?: boolean;      // Default: false
    lastUpdated?: boolean;   // Default: true
    prevNext?: boolean;      // Default: true
    sidebar?: boolean;       // Default: true
  };
}
```

**Navbar:**

```typescript
type NavbarItem = {
  text: string;        // Link text
  link: string;        // URL path
  target?: '_self' | '_blank';  // Default: '_self'
};
```

**Sidebar:**

```typescript
type SidebarConfig = Record<string, SidebarItem[]>;

interface SidebarItem {
  text?: string;        // Group title
  collapsed?: boolean;  // Default: false
  items: Array<{
    text: string;      // Link text
    link: string;      // URL path
    items?: SidebarItem[];  // Nested items
  }>;
}
```

**Footer:**

```typescript
interface FooterConfig {
  copyright?: string;  // Use {year} placeholder
  links?: Array<{
    text: string;
    link: string;
    target?: '_self' | '_blank';
  }>;
}
```

**Example:**

```typescript
export default defineConfig({
  themeConfig: {
    name: 'My Site',
    navbar: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/docs' },
      { text: 'Blog', link: '/blog' },
      { text: 'GitHub', link: 'https://github.com/user/repo', target: '_blank' },
    ],
    sidebar: {
      '/docs/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/docs/intro' },
            { text: 'Installation', link: '/docs/install' },
          ],
        },
        {
          text: 'Advanced',
          collapsed: true,
          items: [
            { text: 'Theming', link: '/docs/theming' },
            { text: 'Plugins', link: '/docs/plugins' },
          ],
        },
      ],
    },
    footer: {
      copyright: '© {year} My Site',
      links: [
        { text: 'Privacy', link: '/privacy' },
        { text: 'GitHub', link: 'https://github.com/user/repo', target: '_blank' },
      ],
    },
    features: {
      darkMode: true,
      editLink: true,
      lastUpdated: true,
      prevNext: true,
    },
  },
});
```

### MarkdownConfig

Markdown rendering configuration.

```typescript
interface MarkdownConfig {
  // Show line numbers in code blocks
  lineNumbers?: boolean; // Default: true

  // Syntax highlighting theme
  theme?: {
    light?: string; // Default: 'github-light'
    dark?: string;  // Default: 'github-dark'
  };

  // markdown-it options
  options?: {
    html?: boolean;         // Default: true
    linkify?: boolean;      // Default: true
    typographer?: boolean;  // Default: true
  };

  // Custom markdown-it plugins
  plugins?: any[];

  // Anchor link options
  anchor?: {
    permalink?: boolean;  // Default: true
    permalinkSymbol?: string; // Default: '#'
    permalinkClass?: string; // Default: 'header-anchor'
  };
}
```

**Example:**

```typescript
export default defineConfig({
  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    options: {
      html: true,
      linkify: true,
      typographer: true,
    },
  },
});
```

### BuildConfig

Build configuration.

```typescript
interface BuildConfig {
  // Output directory
  outDir?: string; // Default: 'dist'

  // Assets directory
  assetsDir?: string; // Default: 'assets'

  // Public base path
  base?: string; // Default: '/'

  // Generate source maps
  sourcemap?: boolean; // Default: false

  // Minify output
  minify?: boolean; // Default: true

  // Clean output directory before build
  clean?: boolean; // Default: true

  // Environment variables
  env?: Record<string, string>;
}
```

**Example:**

```typescript
export default defineConfig({
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    base: '/',
    sourcemap: false,
    minify: true,
    clean: true,
    env: {
      SITE_URL: 'https://example.com',
    },
  },
});
```

### PluginConfig

Plugin configuration.

```typescript
type PluginConfig = string | [string, Record<string, unknown>];
```

**Examples:**

```typescript
// Plugin without options
plugins: [
  '@markopress/plugin-content-pages',
]

// Plugin with options
plugins: [
  ['@markopress/plugin-content-blog', {
    contentDir: 'content/posts',
    prefix: '/blog',
  }],
]

// Local plugin
plugins: [
  './plugins/my-plugin.ts',
]
```

---

## Plugin API

### MarkoPressPlugin

Plugin interface.

```typescript
interface MarkoPressPlugin {
  name: string;

  // Config hook
  config?: (config: ResolvedConfig) => ResolvedConfig | Promise<ResolvedConfig>;

  // Content hook
  contentLoaded?: (ctx: ContentContext) => void | Promise<void>;

  // Build hooks
  beforeBuild?: (ctx: BuildContext) => void | Promise<void>;
  afterBuild?: (ctx: BuildContext) => void | Promise<void>;

  // Markdown hook
  extendMarkdown?: (md: MarkdownIt) => void | Promise<void>;

  // Route hook
  extendRoutes?: (routes: RouteManifest) => RouteManifest | Promise<RouteManifest>;
}
```

### PluginContext

Base context provided to all plugin hooks.

```typescript
interface PluginContext {
  config: ResolvedConfig;
  utils: {
    log: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}
```

### ContentContext

Context for content loading hook.

```typescript
interface ContentContext extends PluginContext {
  addPage: (page: PageData) => void;
  addPost: (post: PostData) => void;
  getPages: () => PageData[];
  getPosts: () => PostData[];
}
```

### BuildContext

Context for build hooks.

```typescript
interface BuildContext extends PluginContext {
  content: {
    pages: PageData[];
    docs: PageData[];
    blog: PostData[];
  };
  routes: RouteManifest;
}
```

### PageData

Page data structure.

```typescript
interface PageData {
  id: string;
  filePath: string;
  routePath: string;
  frontmatter: Record<string, unknown>;
  content: string;
  html: string;
  headers: ProcessedMarkdown['headers'];
  excerpt?: string;
}
```

### PostData

Blog post data structure (extends PageData).

```typescript
interface PostData extends PageData {
  date: Date;
  author?: string;
  tags?: string[];
  categories?: string[];
}
```

### RouteManifest

Generated routes.

```typescript
interface RouteManifest {
  [path: string]: RouteData;
}
```

### RouteData

Route data structure.

```typescript
interface RouteData {
  path: string;
  component?: string;
  layout?: string;
  redirect?: string;
  meta?: Record<string, unknown>;
}
```

---

## Content API

### ContentFile

Content file metadata.

```typescript
interface ContentFile {
  id: string;
  filePath: string;
  relativePath: string;
  type: 'page' | 'doc' | 'blog';
  urlPath: string;
  processed: ProcessedMarkdown;
}
```

### ContentManifest

All content files.

```typescript
interface ContentManifest {
  pages: ContentFile[];
  docs: ContentFile[];
  blog: ContentFile[];
  all: ContentFile[];
}
```

### ProcessedMarkdown

Processed markdown content.

```typescript
interface ProcessedMarkdown {
  content: string;
  html: string;
  frontmatter: Record<string, unknown>;
  headers: Header[];
  excerpt?: string;
}
```

### Header

Markdown header (heading).

```typescript
interface Header {
  level: number;
  title: string;
  slug: string;
}
```

---

## Theme API

### Theme

Theme interface.

```typescript
interface Theme {
  name: string;
  layout: string;
  components?: Record<string, string>;
  styles?: string[];
  layouts?: Record<string, string>;
}
```

### ResolvedTheme

Resolved theme configuration.

```typescript
interface ResolvedTheme extends Theme {
  path: string;
  options: ThemeOptions;
}
```

### loadTheme

Load a theme.

```typescript
function loadTheme(
  theme: string | Theme,
  rootDir: string
): Promise<ResolvedTheme>;
```

### loadThemeWithOverrides

Load theme with custom overrides.

```typescript
function loadThemeWithOverrides(
  theme: string | Theme,
  rootDir: string,
  overridesPath: string
): Promise<ResolvedTheme>;
```

### getLayoutPath

Get path to layout file.

```typescript
function getLayoutPath(
  theme: ResolvedTheme,
  layout: string
): string;
```

### getSlotPath

Get path to slot component.

```typescript
function getSlotPath(
  theme: ResolvedTheme,
  slot: string
): string;
```

---

## Utility Types

### HeadTag

HTML head tag.

```typescript
type HeadTag =
  | [string, Record<string, string>]
  | [string, Record<string, string>, string];
```

**Examples:**

```typescript
// Link tag
['link', { rel: 'icon', href: '/favicon.ico' }]

// Meta tag
['meta', { name: 'description', content: 'My site' }]

// Script tag
['script', { src: '/script.js' }, '']
```

### ConfigEnv

Configuration environment.

```typescript
interface ConfigEnv {
  mode: 'development' | 'production';
  command: 'dev' | 'build' | 'preview';
}
```

### ConfigFn

Configuration function.

```typescript
type ConfigFn = (env: ConfigEnv) => UserConfig | Promise<UserConfig>;
```

**Example:**

```typescript
export default defineConfig(async (env) => {
  return {
    site: {
      title: env.mode === 'development' ? 'Dev Site' : 'Prod Site',
    },
  };
});
```

---

## CLI API

### MarkoPress CLI

Command-line interface commands.

```bash
# Start development server
markopress dev

# Build for production
markopress build

# Preview production build
markopress preview

# Create new site
markopress init [directory]
```

### Dev Server Options

```typescript
interface DevServerOptions {
  port?: number;    // Default: 4173
  host?: string;    // Default: 'localhost'
  open?: boolean;   // Default: false
}
```

### Build Options

```typescript
interface BuildOptions {
  mode?: 'production' | 'development';
  sourcemap?: boolean;
  minify?: boolean;
}
```

---

## Environment Variables

### SITE_URL

Full site URL for production.

```bash
SITE_URL="https://example.com"
```

### NODE_ENV

Build mode.

```bash
NODE_ENV="production"  # or "development"
```

### PORT

Dev server port.

```bash
PORT=3000
```

---

## TypeScript Types

### Importing Types

```typescript
import type {
  MarkoPressConfig,
  SiteConfig,
  ContentConfig,
  ThemeConfig,
  MarkdownConfig,
  BuildConfig,
  PluginConfig,
  ResolvedConfig,
  UserConfig,
} from 'markopress/config';

import type {
  MarkoPressPlugin,
  PluginContext,
  ContentContext,
  BuildContext,
  PageData,
  PostData,
  RouteManifest,
} from 'markopress/plugin';

import type {
  ContentFile,
  ContentManifest,
  ContentType,
} from 'markopress/content';

import type {
  Theme,
  ResolvedTheme,
  ThemeOptions,
} from 'markopress/theme';
```

---

## Examples

### Basic Config

```typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'My Site',
    description: 'My awesome site',
  },
});
```

### Complete Config

```typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'My Site',
    description: 'My awesome site',
    base: '/',
    lang: 'en-US',
    url: 'https://example.com',
    logo: '/logo.png',
    favicon: '/favicon.ico',
  },

  content: {
    pages: 'content/pages',
    docs: 'content/docs',
    blog: 'content/blog',
  },

  theme: '@markopress/theme-default',

  themeConfig: {
    name: 'My Site',
    navbar: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/docs' },
      { text: 'Blog', link: '/blog' },
    ],
    sidebar: {
      '/docs/': [
        {
          text: 'Guide',
          items: [
            { text: 'Intro', link: '/docs/intro' },
            { text: 'Config', link: '/docs/config' },
          ],
        },
      ],
    },
  },

  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },

  build: {
    outDir: 'dist',
    minify: true,
    sourcemap: false,
  },

  plugins: [
    '@markopress/plugin-content-pages',
    '@markopress/plugin-content-docs',
    '@markopress/plugin-content-blog',
  ],
});
```

### Plugin with Hooks

```typescript
import type { MarkoPressPlugin, ContentContext } from 'markopress/plugin';

export default function myPlugin(): MarkoPressPlugin {
  return {
    name: 'my-plugin',

    config(config) {
      // Transform config
      config.site.title = 'Modified';
      return config;
    },

    contentLoaded(ctx: ContentContext) {
      // Process content
      const pages = ctx.getPages();
      for (const page of pages) {
        ctx.utils.log(`Processing: ${page.routePath}`);
      }
    },

    async beforeBuild(ctx) {
      ctx.utils.log('Build starting...');
    },

    async afterBuild(ctx) {
      ctx.utils.log('Build complete!');
    },

    extendMarkdown(md) {
      // Add markdown-it plugins
    },

    extendRoutes(routes) {
      // Add custom routes
      return routes;
    },
  };
}
```

---

## Next Steps

- 🎨 Learn about [Theming](./theming.md)
- 🔌 Build [Plugins](./plugins.md)
- 🚀 Deploy your [Site](../docs/deployment.md)

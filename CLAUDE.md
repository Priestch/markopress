# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MarkoPress is a **general-purpose static site generator** built on Marko.js v6, designed as a drop-in alternative to VitePress and Docusaurus with full content compatibility. It uses **@marko/run** as the build tool and is organized as a **pnpm workspace monorepo**.

## Marko.js 6 Reference Documentation

Complete Marko.js 6 documentation is available in `docs/marko6/`. **Read these files when working with Marko components** to understand proper syntax and patterns:

- **`docs/marko6/language-reference.md`** - Core language syntax, template variables (`input`, `$global`, `$signal`), attributes, tag variables, dynamic tags
- **`docs/marko6/custom-tags.md`** - Component discovery system, tag resolution priority, file structure patterns
- **`docs/marko6/reactivity.md`** - Compile-time reactivity system, state management, update scheduling
- **`docs/marko6/core-tags.md`** - Control flow (`<if>`, `<for>`), state (`<let>`, `<const>`, `<return>`), lifecycle, styling tags
- **`docs/marko6/native-tags.md`** - HTML element enhancements, event handlers, change handlers, two-way binding (`:=`)
- **`docs/marko6/typescript.md`** - TypeScript integration, input typing, generic components, built-in types
- **`docs/marko6/template-api.md`** - Server-side `render()` and client-side `mount()` APIs, `$global` properties
- **`docs/marko6/styling.md`** - CSS approaches, CSS Modules (`<style/styles>`), preprocessors (`.scss`, `.less`)
- **`docs/marko6/concise-syntax.md`** - **NEVER USE** - Concise syntax to avoid (indentation-based without angle brackets)
- **`docs/marko6/marko5-interop.md`** - **NEVER USE** - Marko 5 syntax to avoid (`class {}`, `style {}`, `$ scriptlet`)

### Critical Marko.js 6 Patterns

**Attribute Binding:**
- ✅ Dynamic: `<meta content=$global.description>` (no quotes)
- ❌ Wrong: `<meta content="${$global.description}">` (renders as literal string)

**Layout Rendering:**
- ✅ Routes: `<${input.content}/>` (for @marko/run layouts)
- ❌ Wrong: `<${input.renderBody}/>` (for component composition only)

**State Management:**
- `<let/count=0>` - Mutable state
- `<const/doubled=count*2>` - Derived values
- Two-way binding: `<input value:=message>`

**Event Handlers:**
- Method shorthand: `<button onClick() { alert("clicked") }>Click</button>`

**Always Use:**
- HTML mode with angle brackets `<div></div>`
- Tags API syntax (Marko 6)

**Never Use:**
- Concise syntax (indentation-based)
- Marko 5 Class API syntax

## Architecture

### Monorepo Structure

```
packages/
├── markopress/              # Core framework package
├── theme-default/           # Default theme
├── plugin-content-pages/    # Page content plugin
├── plugin-content-docs/     # Documentation plugin
└── plugin-content-blog/     # Blog plugin
```

### Core Package (`packages/markopress/`)

The main framework with the following responsibilities:

- **CLI** (`src/cli/`) - Commands: `dev`, `build`, `preview`, `init`
- **Build System** (`src/build/`) - Scans content, generates routes, runs @marko/run
- **Config** (`src/config/`) - TypeScript-based configuration loading
- **Markdown** (`src/markdown/`) - markdown-it with Shiki syntax highlighting
- **Plugin System** (`src/plugin/`) - Hooks API for extensibility
- **Theme** (`src/theme/`) - Slot-based theming system

### Plugin System

Plugins use a hooks-based API. Key hooks:

```typescript
interface MarkoPressPlugin {
  name: string;
  config?: (config: ResolvedConfig) => ResolvedConfig;
  contentLoaded?: (ctx: ContentContext) => void;
  beforeBuild?: (ctx: BuildContext) => void;
  afterBuild?: (ctx: BuildContext) => void;
  extendMarkdown?: (md: MarkdownIt) => void;
  extendRoutes?: (routes: RouteManifest) => RouteManifest;
}
```

Built-in plugins:
- **plugin-content-pages** - Scans `content/pages/` → generates `/` routes
- **plugin-content-docs** - Scans `content/docs/` → generates `/docs/*` routes
- **plugin-content-blog** - Scans `content/blog/` → generates `/blog/*` routes

### Build Process

The build system generates **static route files** from markdown content:

1. Scan content directories
2. Process markdown with frontmatter
3. Generate `+page.marko` and `+handler.js` files in `src/routes/`
4. Generate root `+layout.marko` for HTML wrapper
5. Delegate final build to `@marko/run`

**Important**: Route files are generated during build, not manually authored. Content changes require rebuilding routes.

## Common Commands

### Root Level (Demo Site)

```bash
# Development (runs @marko/run dev server on port 4173)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Start built application
npm start
```

### Package Development

```bash
# Build individual packages
cd packages/markopress && pnpm build
cd packages/theme-default && pnpm build

# Watch mode for development
cd packages/markopress && pnpm dev
```

### CLI Usage (Global)

```bash
markopress dev           # Start dev server (default: localhost:3000)
markopress dev -p 4173   # Start on custom port
markopress build         # Build for production
markopress preview       # Preview production build
markopress init [dir]    # Create new site
```

## Configuration

Configuration is loaded from `src/.markopress/` directory with the following priority:
1. `src/.markopress/config.ts`
2. `src/.markopress/config.js`
3. `src/.markopress/config.mjs`

```typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: string;
    description?: string;
    base?: string;           // Default: '/'
    url?: string;            // Full site URL (for sitemap, canonical URLs)
    logo?: string;           // Path to logo
    favicon?: string;        // Path to favicon
    lang?: string;           // Default: 'en-US'
    dir?: 'ltr' | 'rtl';     // Default: 'ltr'
    head?: HeadTag[];        // Additional meta tags
  },
  content: {
    pages?: string;          // Default: 'content/pages'
    docs?: string;           // Default: 'content/docs'
    blog?: string;           // Default: 'content/blog'
    // Custom content directories also supported
  },
  theme: {
    name?: string;           // Theme package name
    options?: Record<string, unknown>;
  },
  markdown: {
    lineNumbers?: boolean;   // Default: false
    markoTags?: {
      enabled?: boolean;     // Default: false
      tagsDir?: string;      // Default: 'src/tags'
    };
    theme?: {
      light?: string;        // Default: 'github-light'
      dark?: string;         // Default: 'github-dark'
    };
  },
  build: {
    outDir?: string;         // Default: 'dist'
    sourcemap?: boolean;
    minify?: boolean;        // Default: true
    clean?: boolean;         // Default: true
  },
  plugins?: (string | PluginConfig)[];
});
```

## src/.markopress/ Directory Structure

MarkoPress uses the `src/.markopress/` directory to centralize framework configuration:

```
src/.markopress/
├── config.{ts,js,mjs}    # Configuration file (required)
└── tags/                 # Custom Marko tags (optional)

src/routes/               # Generated routes (auto-created, do not edit)
```

- **config.{ts,js,mjs}** - Main configuration file
- **tags/** - Custom Marko components for use in markdown (when `markoTags.enabled: true`)

**Note**: Routes are generated in `src/routes/` (not `src/.markopress/routes/`) due to @marko/run conventions. Do not manually edit files in `src/routes/` as they will be overwritten.

## Content Organization

Content uses **GitHub Flavored Markdown** with YAML frontmatter. File naming determines routes:

| Directory | Route Pattern | Frontmatter |
|-----------|---------------|-------------|
| `content/pages/` | `/filename` | `title`, `description`, `draft?` |
| `content/docs/` | `/docs/filename` | `title`, `description`, `order?` |
| `content/blog/` | `/blog/filename` | `title`, `date`, `author`, `tags`, `draft?` |

Blog posts should use date-prefix naming: `YYYY-MM-D-slug.md`

**Common frontmatter fields:**
- `title` (string) - Page title
- `description` (string) - SEO description
- `draft` (boolean) - Exclude from build when true
- `order` (number) - Sidebar ordering for docs
- `date` (Date) - Publication date for blog
- `author` (string) - Author for blog
- `tags` (string[]) - Tags for blog

### Markdown Features

MarkoPress supports GitHub Flavored Markdown plus:
- **Syntax highlighting** via Shiki (customizable themes)
- **Custom containers**: `::: tip`, `::: warning`, `::: danger`
- **Emoji** via markdown-it-emoji
- **Task lists**: `- [ ]` and `- [x]`
- **Tables** with standard GitHub syntax
- **Custom Marko tags** (optional) - Use Marko components in markdown by placing `.marko` files in `src/tags/` and setting `markdown.markoTags.enabled: true`

## Theming

The default theme uses **Marko components** with a slot-based override system. Theme files are in `packages/theme-default/src/`:

- `components/` - Header, Footer, Sidebar
- `layouts/` - Page layouts
- `styles.css` - Theme styles

Users can override theme files by creating:
- `.markopress/theme/components/`
- `.markopress/theme/layouts/`
- `.markopress/theme/styles.css`

## Key Files

| File | Purpose |
|------|---------|
| `packages/markopress/src/index.ts` | Main exports |
| `packages/markopress/src/cli/index.ts` | CLI entry point |
| `packages/markopress/src/build/index.ts` | Build system core |
| `packages/markopress/src/config/loader.ts` | Config loading logic |
| `packages/markopress/src/content/scanner.ts` | Content scanning |
| `packages/markopress/src/plugin/types.ts` | Plugin type definitions |
| `packages/theme-default/src/index.ts` | Theme exports |

## Development Notes

- **TypeScript project** - Each package has its own `tsconfig.json`
- **Workspace dependencies** use `workspace:*` protocol in package.json
- **Marko components** use `.marko` extension
- **Route files** (`+page.marko`, `+handler.js`, `+layout.marko`, `+middleware.js`) follow @marko/run conventions
- **Static assets** go in `public/` directory
- **Node version requirement**: >=18.0.0
- **Dev server port**: Root demo uses 4173, CLI defaults to 3000

### @marko/run Route Conventions

| File | Purpose |
|------|---------|
| `+page.marko` | Establishes a route, renders HTML for GET requests |
| `+layout.marko` | Wraps nested pages/layouts with `<${input.content}/>` |
| `+handler.js` | Handles HTTP methods (GET, POST, etc.) |
| `+middleware.js` | Runs before handlers for all HTTP methods |

**CRITICAL:** Layouts must use `<${input.content}/>` to render page content. Do NOT use `<${input.renderBody}/>` - that's for component composition, not routing. Reference implementation: `/demo-app/src/routes/+layout.marko`

**Handler Pattern:** @marko/run handlers should:
- Set properties on the `context` object (e.g., `context.title = "...";`)
- Return `undefined` (omit explicit return) to auto-call `next()`
- OR return a `Response` object for custom responses
- Templates access context via `$global.*` (e.g., `${$global.title}`)

**Marko Attribute Binding:** Use unquoted attribute values for dynamic binding:
- ✅ CORRECT: `<meta name="description" content=$global.description>`
- ❌ WRONG: `<meta name="description" content="${$global.description}">` (renders as literal string)

### Environment Variables

```bash
SITE_URL="https://yourdomain.com"  # For sitemap, canonical URLs
PORT=4173                          # Dev server port
NODE_ENV="production"              # Build mode
```

## Auto-Generated Production Features

MarkoPress automatically generates these production-ready features:

- **Sitemap** at `/sitemap/xml` - All pages with lastmod, changefreq, priority
- **Robots.txt** at `/robots/txt` - Crawler rules with sitemap reference
- **RSS Feed** at `/api/rss/xml` - Blog posts feed
- **Open Graph tags** - Social sharing meta tags (use `public/og-image.png`)
- **Analytics** - Configure via `public/analytics.js` (GA4, Plausible, Umami)

## Testing

The repository includes a demo site at root level and a `test-project/` for testing custom configurations. Run `demo.sh` to see the full demo.

See `DEMO_GUIDE.md` for comprehensive demo instructions.

# MarkoPress Configuration Guide

Complete reference for configuring your MarkoPress site.

## Configuration File

MarkoPress looks for configuration in two locations (in order):

1. `.markopress/config.ts`
2. `markopress.config.ts`

## Basic Configuration

```typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  // Site metadata
  site: {
    title: 'My Site',
    description: 'My awesome site',
    base: '/',
    url: 'https://example.com',
    logo: '/logo.png',
  },

  // Content directories
  content: {
    pages: 'content/pages',
    docs: 'content/docs',
    blog: 'content/blog',
  },

  // Theme configuration
  theme: '@markopress/theme-default',
  themeConfig: { /* ... */ },

  // Markdown options
  markdown: { /* ... */ },

  // Build options
  build: { /* ... */ },

  // Plugins
  plugins: [/* ... */],
});
```

## Site Configuration

```typescript
site: {
  // Site title (used in title tag, OG tags, etc.)
  title: string;

  // Site description (SEO)
  description: string;

  // Base URL (if deploying to subdirectory)
  base: string; // Default: '/'

  // Full site URL (for sitemap, canonical URLs)
  url: string;

  // Site logo (absolute path or URL)
  logo: string;

  // Favicon path
  favicon: string;

  // Locale code
  lang: string; // Default: 'en-US'

  // Direction
  dir: 'ltr' | 'rtl'; // Default: 'ltr'
}
```

## Content Configuration

```typescript
content: {
  // Where to find pages (→ /route)
  pages: string; // Default: 'content/pages'

  // Where to find docs (→ /docs/route)
  docs: string; // Default: 'content/docs'

  // Where to find blog (→ /blog/route)
  blog: string; // Default: 'content/blog'

  // Custom content directories
  custom: {
    recipes: 'content/recipes', // → /recipes/route
    portfolio: 'content/portfolio', // → /portfolio/route
  }
}
```

## Theme Configuration

```typescript
theme: string; // '@markopress/theme-default' | path to custom theme

themeConfig: {
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

### Navbar

```typescript
navbar: [
  {
    text: string;        // Link text
    link: string;        // URL path
    target?: '_self' | '_blank';  // Default: '_self'
  },
  // Examples
  { text: 'Home', link: '/' },
  { text: 'Docs', link: '/docs' },
  { text: 'GitHub', link: 'https://github.com/user/repo', target: '_blank' },
]
```

### Sidebar

```typescript
sidebar: {
  '/docs/': [
    {
      text?: string;        // Group title
      collapsed?: boolean;  // Default: false
      items: [
        {
          text: string;      // Link text
          link: string;      // URL path
          items?: [...];     // Nested items
        }
      ]
    },
  ],
  '/blog/': [ /* ... */ ],
}
```

Example:

```typescript
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
}
```

### Footer

```typescript
footer: {
  // Copyright message (use {year} placeholder)
  copyright?: string; // Default: '© {year} My Site'

  // Footer links
  links?: Array<{
    text: string;
    link: string;
    target?: '_self' | '_blank';
  }>;
}
```

Example:

```typescript
footer: {
  copyright: '© {year} My Company. All rights reserved.',
  links: [
    { text: 'Privacy', link: '/privacy' },
    { text: 'Terms', link: '/terms' },
    { text: 'GitHub', link: 'https://github.com/user/repo', target: '_blank' },
  ],
}
```

## Markdown Configuration

```typescript
markdown: {
  // Show line numbers in code blocks
  lineNumbers?: boolean; // Default: true

  // Syntax highlighting theme
  theme?: {
    light: string; // Default: 'github-light'
    dark: string;  // Default: 'github-dark'
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

## Build Configuration

```typescript
build: {
  // Output directory
  outDir: string; // Default: 'dist'

  // Public base path
  base: string; // Default: '/'

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

## Plugin Configuration

```typescript
plugins: [
  // Built-in plugins
  '@markopress/plugin-content-docs',
  '@markopress/plugin-content-blog',
  '@markopress/plugin-content-pages',

  // Local plugins
  './plugins/my-plugin.ts',

  // Plugin with options
  ['@markopress/plugin-search', {
    lang: ['en', 'ja'],
  }],
]
```

## Environment Variables

Set environment variables in `.env` or when running commands:

```bash
# Site URL (for production)
SITE_URL="https://example.com"

# Build mode
NODE_ENV="production"

# Port
PORT=4173
```

Use in config:

```typescript
export default defineConfig({
  site: {
    url: process.env.SITE_URL || 'http://localhost:4173',
  },
});
```

## TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "jsx": "react",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolve": {
      "extensions": [".ts", ".tsx", ".js", ".jsx"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".markopress/**/*.ts"
  ]
}
```

## Advanced Configuration

### Custom Routes

Create custom routes in `src/routes/`:

```typescript
// src/routes/api/hello/+handler.ts
export const GET = async function() {
  return new Response(JSON.stringify({ hello: 'world' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

### Custom Components

Create custom Marko components in `src/tags/`:

```marko
// src/tags/MyComponent.marko
class {
  onCreate() {
    this.state = { count: 0 };
  }
}

<div>
  <h1>Count: ${state.count}</h1>
  <button onClick=>() => state.count++>Increment</button>
</div>
```

### Middlewares

Add custom middleware:

```typescript
// .markopress/middleware.ts
import { Middleware } from 'markopress';

export const logger: Middleware = async (context, next) => {
  console.log(`${context.request.method} ${context.request.url}`);
  return next();
};
```

## Configuration Examples

### Blog Site

```typescript
export default defineConfig({
  site: {
    title: 'My Blog',
    description: 'Tech blog and tutorials',
  },
  content: {
    blog: 'content/posts',
  },
  themeConfig: {
    navbar: [
      { text: 'Home', link: '/' },
      { text: 'Blog', link: '/blog' },
      { text: 'About', link: '/about' },
    ],
  },
});
```

### Documentation Site

```typescript
export default defineConfig({
  site: {
    title: 'My Docs',
    description: 'Product documentation',
  },
  content: {
    docs: 'content/docs',
  },
  themeConfig: {
    navbar: [
      { text: 'Docs', link: '/docs/intro' },
      { text: 'API', link: '/api' },
    ],
    sidebar: {
      '/docs/': [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/docs/intro' },
            { text: 'Quick Start', link: '/docs/quick-start' },
          ],
        },
      ],
    },
    features: {
      editLink: true,
      lastUpdated: true,
      prevNext: true,
    },
  },
});
```

### Multilingual Site

```typescript
export default defineConfig({
  site: {
    title: 'My Site',
    description: 'My awesome site',
    locales: {
      '/': {
        lang: 'en-US',
        title: 'My Site',
      },
      '/zh/': {
        lang: 'zh-CN',
        title: '我的网站',
      },
    },
  },
});
```

## Next Steps

- 🎨 Learn about [Theming](./theme.md)
- 🔌 Build [Plugins](./plugins.md)
- 🚀 Deploy your [Site](./deployment.md)

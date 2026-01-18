# MarkoPress `src/` Directory

This directory contains **custom routes and components** that you manually create. Content-based routes are auto-generated from the `content/` directory by MarkoPress.

## What Goes Here

### ✅ Manual Routes (Created by You)

- **Custom pages** - `src/routes/about/+page.marko`
- **API endpoints** - `src/routes/api/search/+handler.js`
- **Dynamic routes** - `src/routes/products/[id]/+page.marko`
- **Custom layouts** - `src/routes/+layout.marko`
- **Middleware** - `src/routes/+middleware.js`

### ✅ Custom Components

- **Route components** - `src/routes/components/` (components used in your routes)
- **Shared utilities** - `src/routes/lib/` (helper functions)
- **Marko tags** - `src/tags/` (custom tags for markdown)

### ❌ Auto-Generated Routes (DO NOT EDIT)

MarkoPress automatically generates these from your `content/` directory:

- From `content/pages/*.md` → generates root routes
- From `content/docs/**/*.md` → generates `/docs/*` routes
- From `content/blog/**/*.md` → generates `/blog/*` routes

**With catch-all routes enabled** (`build.useCatchAllRoutes: true`):
- Generated files: `src/routes/$$slug/+handler.js`, `src/routes/docs/$$slug/+handler.js`, etc.
- These are managed by MarkoPress - **do not edit manually**

**With static routes** (default):
- Individual route files are generated for each content item
- **do not edit these files** - they will be overwritten on build

## Directory Structure

```
src/
├── routes/
│   ├── +layout.marko          # Root layout (wraps all pages)
│   ├── +middleware.js         # Global middleware (optional)
│   ├── +handler.js           # Root route handler (optional)
│   │
│   ├── components/           # Your custom Marko components
│   │   ├── Header.marko
│   │   └── Footer.marko
│   │
│   ├── lib/                  # Utility functions
│   │   ├── utils.js
│   │   └── api.js
│   │
│   ├── api/                  # API endpoints
│   │   └── search/
│   │       └── +handler.js
│   │
│   └── [your-custom-routes]  # Your manual routes
│       └── about/
│           ├── +page.marko
│           └── +handler.js
│
└── tags/                     # Custom Marko tags for markdown
    ├── alert-box.marko
    └── button-link.marko
```

See full documentation in the project README.

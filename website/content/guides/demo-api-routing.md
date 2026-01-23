---
title: "API Reference: Routing"
description: "Complete guide to MarkoPress routing system and custom routes"
order: 10
prev: /guides/configuration
next: /guides/demo-api-markdown
---

# API Reference: Routing

Complete guide to the MarkoPress routing system, including file-based routing, dynamic routes, and custom API routes.

## Overview

MarkoPress uses **file-based routing** powered by `@marko/run`. Routes are automatically generated from your content structure, and you can create custom routes for API endpoints and special functionality.

## How Routing Works

### Content Routes

Content files automatically become routes:

```
content/
├── pages/
│   ├── index.md          → /
│   ├── about.md          → /about
│   └── contact.md        → /contact
├── docs/
│   ├── intro.md          → /guides/intro
│   └── guide.md          → /guides/guide
└── blog/
    └── 2024-01-15-post.md → /blog/2024-01-15-post
```

### Route Metadata

Each route has metadata:

```typescript
interface RouteData {
  path: string;              // URL path
  component?: string;        // Component path
  layout?: string;           // Layout to use
  meta?: {
    title?: string;
    description?: string;
    [key: string]: any;
  };
}
```

## File-Based Routing

### Pages

Create pages in `content/pages/`:

```markdown
---
title: "About Us"
description: "Learn about our company"
---

# About Us

We are awesome!
```

**Result:** `/about` route

### Index Pages

Create `index.md` for directory roots:

```markdown
---
title: "Documentation"
---

# Documentation

Welcome to the docs!
```

**Result:** `/docs` route (when placed in `content/guides/index.md`)

### Dynamic Routes

Create dynamic routes using `[param]` syntax:

```
content/
└── pages/
    └── posts/
        └── [slug].md    → /posts/:slug
```

Access the parameter in your component:

```marko
class {
  onInput(input) {
    const slug = input.params.slug;
    // Fetch post by slug
  }
}
```

## Custom Routes

Create custom routes in `src/routes/`.

### Route Handlers

Create `src/routes/api/hello/+handler.ts`:

```typescript
export const GET = async function() {
  return new Response(JSON.stringify({ hello: 'world' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

**Result:** `/api/hello` endpoint

### Multiple Methods

```typescript
export const GET = async function() {
  return new Response('GET request');
};

export const POST = async function(request: Request) {
  const body = await request.json();
  return new Response(JSON.stringify({ received: body }));
};
```

### Route Parameters

```typescript
// src/routes/api/posts/[id]/+handler.ts
export const GET = async function({ params }) {
  const postId = params.id;
  const post = await getPost(postId);

  return new Response(JSON.stringify(post), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

**Result:** `/api/posts/123` returns post with ID 123

### Query Parameters

```typescript
export const GET = async function({ request }) {
  const url = new URL(request.url);
  const search = url.searchParams.get('q');
  const page = url.searchParams.get('page') || '1';

  // Search and paginate
  const results = await searchPosts(search, page);

  return new Response(JSON.stringify(results));
};
```

## Route Configuration

### Route Options

Configure route behavior in `markopress.config.ts`:

```typescript
export default defineConfig({
  routes: {
    // Custom base path
    base: '/docs',

    // Trailing slash behavior
    trailingSlash: false,

    // Case sensitivity
    caseSensitive: false,
  },
});
```

### Route Aliases

Create aliases for routes:

```typescript
export default defineConfig({
  routes: {
    aliases: {
      '/old-url': '/new-url',
      '/legacy/:path': '/:path',
    },
  },
});
```

### Route Redirects

Create redirects:

```typescript
export default defineConfig({
  routes: {
    redirects: {
      '/old-post': '/new-post',
      '/legacy/:path*': '/new/:path*',
    },
  },
});
```

## Advanced Routing

### Middleware

Add middleware to routes:

```typescript
// src/routes/middleware.ts
export const authMiddleware = async ({ request }, next) => {
  const token = request.headers.get('Authorization');

  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  return next();
};

// Use in route
export const GET = [
  authMiddleware,
  async function() {
    return new Response('Protected content');
  },
];
```

### Route Guards

Protect routes:

```typescript
// src/routes/admin/+handler.ts
export const GET = async function({ request }) {
  const isAuthenticated = await checkAuth(request);

  if (!isAuthenticated) {
    return Response.redirect('/login');
  }

  return new Response('Admin dashboard');
};
```

### Error Handling

Handle errors gracefully:

```typescript
export const GET = async function() {
  try {
    const data = await fetchData();
    return new Response(JSON.stringify(data));
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to fetch data',
      message: error.message,
    }), { status: 500 });
  }
};
```

## SPA Mode

Enable Single Page Application mode:

```typescript
export default defineConfig({
  spa: true, // Enable SPA mode

  spaFallback: '/app', // Fallback route
});
```

In SPA mode, all routes are handled client-side.

## Server-Side Rendering

MarkoPress automatically SSRs your pages for optimal performance and SEO.

### Disable SSR

Disable for specific routes:

```typescript
// src/routes/+handler.ts
export const config = {
  ssr: false, // Client-side only
};
```

### Streaming

Enable streaming for slow pages:

```typescript
export const config = {
  stream: true, // Stream response
};
```

## Route Groups

Organize routes with groups:

```
src/routes/
├── (auth)/
│   ├── login/
│   └── register/
├── (dashboard)/
│   ├── overview/
│   └── settings/
└── api/
```

Parentheses `(name)` create route groups without adding to the URL path.

## Layout Routes

Create layouts that wrap routes:

```
src/routes/
├── +layout.ts           # Root layout
├── (dashboard)/
│   ├── +layout.ts       # Dashboard layout
│   ├── overview/
│   └── settings/
└── (auth)/
    ├── +layout.ts       # Auth layout
    ├── login/
    └── register/
```

`+layout.ts` files automatically wrap child routes.

## API Routes Examples

### REST API

```typescript
// src/routes/api/posts/+handler.ts

// GET /api/posts - List all posts
export const GET = async function({ request }) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '10');

  const posts = await getPosts({ page, limit });

  return new Response(JSON.stringify({
    data: posts,
    meta: { page, limit, total: posts.length },
  }));
};

// POST /api/posts - Create post
export const POST = async function({ request }) {
  const body = await request.json();
  const post = await createPost(body);

  return new Response(JSON.stringify(post), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

### Search API

```typescript
// src/routes/api/search/+handler.ts

export const GET = async function({ request }) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query) {
    return new Response(JSON.stringify({ error: 'Query required' }), {
      status: 400,
    });
  }

  const results = await searchContent(query);

  return new Response(JSON.stringify({
    query,
    results,
    count: results.length,
  }));
};
```

### RSS Feed

```typescript
// src/routes/api/rss/+handler.ts

export const GET = async function() {
  const posts = await getPosts();

  const rss = generateRSS(posts);

  return new Response(rss, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
```

### Sitemap

```typescript
// src/routes/sitemap.xml/+handler.ts

export const GET = async function() {
  const routes = await getAllRoutes();

  const sitemap = generateSitemap(routes);

  return new Response(sitemap, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
```

## Route Hooks

MarkoPress provides hooks for route lifecycle.

### Before Route

```typescript
export const beforeRoute = async function({ request }) {
  // Run before route handler
  console.log('Incoming request:', request.url);
};
```

### After Route

```typescript
export const afterRoute = async function({ response }) {
  // Run after route handler
  console.log('Response status:', response.status);
};
```

## Performance

### Route Caching

```typescript
// Cache route responses
export const config = {
  cache: {
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 86400, // 1 day
  },
};
```

### Route Prefetching

```marko
<a href=/about prefetch=true>About</a>
```

### Code Splitting

Routes are automatically code-split. Lazy load components:

```marko
import LazyComponent from './LazyComponent.marko';

<if(input.shouldLoad)>
  <LazyComponent/>
</if>
```

## Examples

### JSON API

```typescript
export const GET = async function() {
  return new Response(JSON.stringify({
    version: '1.0.0',
    name: 'MarkoPress API',
  }));
};
```

### File Upload

```typescript
export const POST = async function({ request }) {
  const formData = await request.formData();
  const file = formData.get('file');

  await saveFile(file);

  return new Response(JSON.stringify({ success: true }));
};
```

### WebSocket

```typescript
export const GET = async function({ request }) {
  const upgradeHeader = request.headers.get('Upgrade');

  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }

  // Upgrade to WebSocket
  return upgradeWebSocket(request);
};
```

## Best Practices

### 1. Use RESTful Conventions

```
GET    /api/posts      # List posts
GET    /api/posts/123  # Get post 123
POST   /api/posts      # Create post
PUT    /api/posts/123  # Update post 123
DELETE /api/posts/123  # Delete post 123
```

### 2. Handle Errors

```typescript
export const GET = async function() {
  try {
    const data = await fetchData();
    return new Response(JSON.stringify(data));
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
    }), { status: 500 });
  }
};
```

### 3. Validate Input

```typescript
export const POST = async function({ request }) {
  const body = await request.json();

  if (!body.title) {
    return new Response(JSON.stringify({
      error: 'Title is required',
    }), { status: 400 });
  }

  // Process...
};
```

### 4. Use Status Codes

```typescript
return new Response('Not found', { status: 404 });
return new Response('Unauthorized', { status: 401 });
return new Response('Forbidden', { status: 403 });
return new Response('Server error', { status: 500 });
```

## Next Steps

- 📝 Learn about [Markdown](/guides/demo-api-markdown)
- 📖 [Content Organization](/guides/demo-guides-content)
- 🔌 Build [Plugins](/guides/plugins)

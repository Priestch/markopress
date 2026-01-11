# @marko/run Reference Documentation

This document contains key information from @marko/run README that's relevant to MarkoPress development.

## Route File Types

### `+page.marko`
Establishes a route at the current directory path, served for `GET` requests with HTML content.

### `+layout.marko`
Provides a layout component that wraps nested layouts and pages. Each layout receives:
- Request data, path params, URL, route metadata as `input`
- `renderBody` which refers to the nested page being rendered

```marko
<main>
  <h1>My Products</h1>
  <${input.renderBody}/> // render the page or layout here
</main>
```

### `+handler.js` or `+handler.ts`
Establishes a route that can handle HTTP methods (`GET`, `POST`, `PUT`, `DELETE`).

**Important:** Handler functions should either:
1. Return `undefined` - automatically calls `next()` to render the page
2. Return a `Response` object
3. Explicitly call `next()` and return its result

```javascript
// Option 1: Return undefined (next() called automatically)
export async function GET(context, next) {
  // Do something before rendering
  console.log('Handling request');
  // Return undefined to automatically render page
}

// Option 2: Explicitly call next()
export async function GET(context, next) {
  const response = await next();
  return response;
}

// Option 3: Return a Response directly
export async function GET(context) {
  return new Response('Custom response', { status: 200 });
}
```

**Do NOT return plain data objects:**
```javascript
// ❌ WRONG - This returns an object that's not a Response
export async function GET(context) {
  return { title: "Hello" }; // This will cause issues!
}

// ✅ CORRECT - Return undefined to let the framework handle rendering
export async function GET(context, next) {
  // Data should be passed through other means (e.g., context.meta, global state)
  // Or use context.render() explicitly
}
```

### `+middleware.js` or `+middleware.ts`
Runs before handlers for all HTTP methods. Must export a `default` function.

## Execution Order

For a route like `/about` with this structure:
```
routes/
  about/
    +handler.js
    +layout.marko
    +middleware.js
    +page.marko
  +layout.marko
  +middleware.js
  +page.marko
```

Execution order:
1. **Middlewares** (root to leaf)
2. **Handler**
3. **Layouts** (root to leaf)
4. **Page**

The handler calls `next()` which eventually returns a Stream Response from the composed layouts and page.

## Context Object

Passed to middleware and handlers, available in Marko templates as `$global`.

### Properties
- `route` - Current route identifier
- `request` - WHATWG Request instance
- `method` - HTTP method
- `params` - Route parameters
- `meta` - Metadata from `+meta` file
- `platform` - Adapter-provided data
- `parent` - Parent context when using `context.fetch`

### Methods

#### `fetch(resource, init?)`
Creates a response by making a new request to the router. Same signature as native `fetch`.

#### `render(template, input, init?)`
Creates a response that streams the Marko template, sets `Content-Type: text/html`.

```typescript
render<T>(template: Marko.Template<T>, input: T, init?: ResponseInit): Response;
```

#### `redirect(to, status?)`
Creates a redirect response that resolves relative paths.

#### `back(fallback?, status?)`
Creates a redirect response using the request referer or fallback.

## Static Adapter

The `@marko/run-adapter-static` adapter:
- Crawls URLs to generate static HTML files
- Automatically discovers routes from file system
- Can specify additional URLs via the `urls` option

```typescript
import staticAdapter from '@marko/run-adapter-static';

marko({
  adapter: staticAdapter({
    urls: ['/', '/about', '/contact'] // Additional URLs to crawl
  })
})
```

## Current Issue in MarkoPress

The build system generates handlers that return plain objects:
```javascript
export async function GET(context) {
  return {
    title: "Page Title",
    description: "Page description"
  };
}
```

**Problem:** This returns a non-Response object, which causes the static crawler to fail with `TypeError: Cannot read properties of undefined (reading 'get')`.

**Solution:** Handlers should return `undefined` to let the framework automatically call `next()` and render the page. Data should be provided through other mechanisms.

## References

- Full documentation: `/node_modules/@marko/run/README.md`
- Adapters: `/node_modules/@marko/run-adapter-*/README.md`

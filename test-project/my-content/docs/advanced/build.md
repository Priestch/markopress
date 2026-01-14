---
title: Build Configuration
order: 30
---

# Build Configuration

Configure how MarkoPress builds your site.

## Output Directory

Customize the build output:

```javascript
build: {
  outDir: 'dist',
}
```

## Minification

Control HTML/CSS/JS minification:

```javascript
build: {
  minify: true,
  minifyHtml: true,
  minifyCss: true,
}
```

## Source Maps

Generate source maps for debugging:

```javascript
build: {
  sourcemap: true,
}
```

## Clean Build

Clean output directory before build:

```javascript
build: {
  clean: true,
}
```

## Build Performance

Optimize build performance:

- Incremental builds (default)
- Parallel processing
- Cache optimization

For large sites:
```javascript
build: {
  parallel: true,
  cache: true,
}
```

## Deployment

MarkoPress outputs static HTML ready for deployment to:
- GitHub Pages
- Netlify
- Vercel
- AWS S3
- Any static hosting

See also:
- [Advanced Features Overview](/docs/advanced/overview)
- [Configuration Guide](/docs/configuration)

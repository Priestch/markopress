# SEO Plugin

The built-in `seo` plugin generates production SEO artifacts during build.

## Features

- Generates `sitemap.xml` from built site routes.
- Generates `robots.txt` when `seo.robots` is configured.

Enable with:

```ts
import { defineConfig } from 'markopress';

export default defineConfig({
  plugins: ['seo'],
  seo: {
    sitemap: {
      hostname: 'https://example.com',
      exclude: ['/api/**', '/private/**'],
      transformItems: (items) => {
        return items.filter((item) => !item.url.includes('/draft'));
      },
    },
    robots: {
      userAgent: '*',
      allow: ['/'],
      disallow: ['/admin', '/search'],
      crawlDelay: 10,
      sitemap: '/sitemap.xml',
    },
  },
});
```

## Output

Build output is written to:

- `dist/public/sitemap.xml`
- `dist/public/robots.txt`

`robots.txt` supports the following options:

- `userAgent`: string or array (default `*`)
- `allow`: array of allowed paths
- `disallow`: array of blocked paths
- `crawlDelay`: number (seconds)
- `sitemap`: explicit sitemap URL/path (optional)

If `robots.sitemap` is not set, the plugin will emit a generated sitemap path reference when `seo.sitemap` is also configured.


# Production Features Setup Guide

MarkoPress includes production-ready features to help your site rank well in search engines and track visitor analytics.

## 🔍 SEO Features

### Sitemap.xml

If you enable the built-in `seo` plugin (`plugins: ['seo']`), MarkoPress generates a sitemap at `/sitemap.xml` that includes:
- All pages, documentation, and blog posts
- Last modification dates
- Change frequencies and priority scores

**Submit to search engines:**
- Google Search Console: `https://search.google.com/search-console`
- Bing Webmaster Tools: `https://www.bing.com/webmasters`

### Robots.txt

Generated at `/robots.txt` when `seo.robots` is configured, with:
- Allow/disallow rules per user-agent
- Reference to your sitemap
- Configurable crawl-delay and disallow rules

Enable both in one place:

```typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  plugins: ['seo'],
  seo: {
    sitemap: {
      hostname: 'https://yourdomain.com',
    },
    robots: {
      userAgent: '*',
      allow: ['/'],
      disallow: ['/admin', '/search'],
      crawlDelay: 10,
    },
  },
});
```

### Open Graph Meta Tags

Every page automatically includes Open Graph tags for social media sharing:
- `og:title` - Page title
- `og:description` - Page description
- `og:url` - Page URL (canonical)
- `og:type` - "article" for content, "website" for homepage
- `og:image` - Social share image (place `og-image.png` in `public/`)

Twitter Card tags are also included for better Twitter sharing.

**Customize social images:**
1. Create an image: `public/og-image.png` (recommended: 1200x630px)
2. Add `image` to frontmatter in any `.md` file for page-specific images

## 📊 Analytics Integration

MarkoPress supports multiple analytics providers. Configure by editing `public/analytics.js`:

### Google Analytics 4

```javascript
const gaId = 'G-XXXXXXXXXX'; // Your GA4 measurement ID
```

Get your ID: https://analytics.google.com/

### Plausible Analytics

```javascript
const plausibleDomain = 'yourdomain.com'; // Your domain
```

Sign up: https://plausible.io/

### Umami Analytics

```javascript
const umamiId = 'your-website-id'; // Your website ID
```

Sign up: https://umami.is/

### Event Tracking

Track custom events anywhere in your JavaScript:

```javascript
window.trackEvent('category', 'action', 'label', value);
```

Example:
```javascript
// Track button clicks
document.querySelector('button').addEventListener('click', () => {
  window.trackEvent('engagement', 'button_click', 'cta_button');
});

// Track downloads
window.trackEvent('download', 'pdf', 'user-guide.pdf');
```

Page views are tracked automatically on navigation.

## 🌐 Environment Variables

Set these for production deployments:

```bash
# Your site URL (for sitemap and canonical URLs)
export SITE_URL="https://yourdomain.com"

# Build and preview
SITE_URL="https://yourdomain.com" npm run build
SITE_URL="https://yourdomain.com" npm run preview
```

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Configure `SITE_URL` environment variable
- [ ] Add `public/og-image.png` (1200x630px recommended)
- [ ] Set up analytics (edit `public/analytics.js`)
- [ ] Test sitemap: `https://yourdomain.com/sitemap.xml`
- [ ] Test robots.txt: `https://yourdomain.com/robots.txt`
- [ ] Test RSS feed: `https://yourdomain.com/api/rss/xml`
- [ ] Submit sitemap to Google Search Console
- [ ] Verify analytics tracking is working
- [ ] Check Open Graph tags with: https://www.opengraph.xyz/

## 📝 Additional Resources

- **Google Search Console:** Verify ownership and monitor search performance
- **Bing Webmaster Tools:** Submit sitemap to Bing
- **Rich Results Test:** Test structured data: https://search.google.com/test/rich-results

## 🔧 Customization

### Change Sitemap Priority

The built-in SEO plugin uses default scoring rules. For custom scoring or filtering, implement your own `seo` post-build logic or replace it with a custom plugin.

### Customize Robots.txt

Configure `seo.robots` in your MarkoPress config:

```typescript
seo: {
  robots: {
    userAgent: ['*', 'ChatGPT-User'],
    disallow: ['/admin', '/private'],
    crawlDelay: 10,
  },
}
```

### Add Custom Meta Tags

Add to `src/routes/+page.marko` in the `<head>` section:

```html
<meta name="author" content="Your Name">
<meta name="keywords" content="your, keywords, here">
```

## 🎯 Performance Tips

1. **Static output** - `sitemap.xml` and `robots.txt` are generated during build and served as static assets
2. **Use CDN** - Serve static assets through a CDN
3. **Enable compression** - Build output is already gzip-compressed
4. **Monitor Core Web Vitals** - Use Google PageSpeed Insights

## 📈 Monitoring

After deployment, monitor:

- **Search Console:** Indexing status, search queries, coverage
- **Analytics:** Visitor metrics, popular pages, referral sources
- **Core Web Vitals:** LCP, FID, CLS scores

# Production Features Setup Guide

MarkoPress includes production-ready features to help your site rank well in search engines and track visitor analytics.

## 🔍 SEO Features

### Sitemap.xml

Your site automatically generates a sitemap at `/sitemap/xml` that includes:
- All pages, documentation, and blog posts
- Last modification dates
- Change frequencies (daily for pages, weekly for docs, monthly for blog)
- Priority scores (homepage: 1.0, pages: 0.9, docs: 0.8, blog: 0.7)

**Submit to search engines:**
- Google Search Console: `https://search.google.com/search-console`
- Bing Webmaster Tools: `https://www.bing.com/webmasters`

### Robots.txt

Automatically generated at `/robots/txt` with:
- Allow all crawlers
- Reference to your sitemap
- Configurable crawl-delay and disallow rules

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
- [ ] Test sitemap: `https://yourdomain.com/sitemap/xml`
- [ ] Test robots.txt: `https://yourdomain.com/robots/txt`
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

Edit `src/routes/sitemap.xml/+handler.ts` to adjust priority scores:

```typescript
if (type === 'pages') {
  priority = 1.0; // Homepage
  changefreq = 'daily';
} else if (type === 'docs') {
  priority = 0.8;
  changefreq = 'weekly';
}
```

### Customize Robots.txt

Edit `src/routes/robots.txt/+handler.ts` to add rules:

```typescript
// Disallow specific paths
Disallow: /admin/
Disallow: /private/

// Block specific crawlers
User-agent: ChatGPT-User
Disallow: /
```

### Add Custom Meta Tags

Add to `src/routes/+page.marko` in the `<head>` section:

```html
<meta name="author" content="Your Name">
<meta name="keywords" content="your, keywords, here">
```

## 🎯 Performance Tips

1. **Set proper cache headers** - Sitemap and robots.txt are cached for 1 hour
2. **Use CDN** - Serve static assets through a CDN
3. **Enable compression** - Build output is already gzip-compressed
4. **Monitor Core Web Vitals** - Use Google PageSpeed Insights

## 📈 Monitoring

After deployment, monitor:

- **Search Console:** Indexing status, search queries, coverage
- **Analytics:** Visitor metrics, popular pages, referral sources
- **Core Web Vitals:** LCP, FID, CLS scores

# Deployment Guide

Deploy your MarkoPress site to various platforms.

## Build Your Site

First, build your site for production:

```bash
npm run build
```

This creates a `dist/` directory with static files ready for deployment.

## Environment Variables

Set these for production builds:

```bash
# Site URL (for canonical URLs and sitemap)
export SITE_URL="https://yourdomain.com"

# Build
SITE_URL="https://yourdomain.com" npm run build
```

## Deploy to Vercel

### Option 1: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Build and deploy
npm run build
vercel --prod
```

### Option 2: Vercel Dashboard

1. Push your code to GitHub
2. Import project in Vercel dashboard
3. Configure build settings:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

### vercel.json

Create `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": null,
  "env": {
    "SITE_URL": "https://yourdomain.vercel.app"
  }
}
```

## Deploy to Netlify

### Option 1: Netlify CLI

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build and deploy
npm run build
netlify deploy --prod --dir=dist
```

### Option 2: Netlify Dashboard

1. Push code to GitHub
2. Import in Netlify dashboard
3. Configure:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Install command:** `npm install`

### netlify.toml

Create `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Deploy to GitHub Pages

### Option 1: Using GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: |
          SITE_URL=${{ steps.pages.outputs.base_url }} \
          npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Configure repository settings:
1. Settings → Pages
2. Source: GitHub Actions

### Option 2: Manual Deploy

```bash
# Build
npm run build

# Deploy to gh-pages branch
npx gh-pages -d dist
```

## Deploy to GitLab Pages

Create `.gitlab-ci.yml`:

```yaml
image: node:20

pages:
  stage: deploy
  cache:
    paths:
      - node_modules/
  script:
    - npm ci
    - SITE_URL="$CI_PAGES_URL" npm run build
    - mv dist public
  artifacts:
    paths:
      - public
  only:
    - main
```

## Deploy to AWS S3 + CloudFront

### Using AWS CLI

```bash
# Build
npm run build

# Sync to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

### Deployment Script

Create `scripts/deploy-s3.sh`:

```bash
#!/bin/bash

set -e

# Configuration
BUCKET="your-bucket-name"
DISTRIBUTION="YOUR_DISTRIBUTION_ID"

# Build
echo "Building..."
npm run build

# Sync to S3
echo "Deploying to S3..."
aws s3 sync dist/ s3://$BUCKET --delete

# Invalidate CloudFront
echo "Invalidating CloudFront..."
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION \
  --paths "/*"

echo "Deployed successfully!"
```

Make executable:

```bash
chmod +x scripts/deploy-s3.sh
./scripts/deploy-s3.sh
```

## Deploy to Docker

### Dockerfile

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN npm install -g @marko/run/preview

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 4173

CMD ["marko-run", "preview", "--port", "4173"]
```

### Build and Run

```bash
# Build image
docker build -t markopress-site .

# Run container
docker run -p 4173:4173 markopress-site
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  markopress:
    build: .
    ports:
      - "4173:4173"
    environment:
      - SITE_URL=https://yourdomain.com
    restart: unless-stopped
```

## Deploy to Node.js Hosting

### Prepare for Node.js Hosting

MarkoPress builds to static files, so you can deploy the `dist/` directory to any static hosting service.

However, if you want SSR, you can run the preview server:

```bash
# Install dependencies
npm install --production

# Start server
npm run preview
```

Use a process manager like PM2:

```bash
# Install PM2
npm i -g pm2

# Start
pm2 start npm --name "markopress" -- run preview

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

## Deploy to Static Hosting

### Surge.sh

```bash
# Install Surge
npm i -g surge

# Build
npm run build

# Deploy
surge dist yourdomain.surge.sh
```

### Firebase Hosting

```bash
# Install Firebase CLI
npm i -g firebase-tools

# Initialize
firebase init

# Configure firebase.json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}

# Deploy
firebase deploy
```

## CI/CD Pipelines

### GitHub Actions (Complete)

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install
        run: npm ci

      - name: Build
        run: |
          SITE_URL=${{ secrets.SITE_URL }} \
          npm run build

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

### GitLab CI (Complete)

```yaml
stages:
  - build
  - deploy

build:
  stage: build
  image: node:20
  script:
    - npm ci
    - SITE_URL="$CI_PAGES_URL" npm run build
  artifacts:
    paths:
      - dist
  only:
    - main

deploy:production:
  stage: deploy
  image: alpine:latest
  script:
    - apk add --no-cache curl
    - curl -X POST -d "" $DEPLOY_WEBHOOK
  only:
    - main
```

## Post-Deployment Checklist

After deploying:

- [ ] Test homepage loads
- [ ] Test navigation links
- [ ] Test all documentation pages
- [ ] Test blog posts
- [ ] Verify RSS feed works
- [ ] Check sitemap is accessible
- [ ] Verify robots.txt
- [ ] Test Open Graph tags (use https://www.opengraph.xyz/)
- [ ] Check analytics tracking
- [ ] Test dark mode toggle
- [ ] Verify mobile responsiveness
- [ ] Test search functionality (if enabled)
- [ ] Check 404 page (if custom)
- [ ] Verify canonical URLs
- [ ] Test social sharing cards

## Performance Optimization

### Enable Compression

Most platforms automatically compress. If not, add:

```nginx
# nginx example
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
```

### CDN Configuration

Configure your CDN:

- Cache CSS/JS for 1 year
- Cache HTML for 1 hour
- Cache images for 1 year
- Enable Brotli compression
- HTTP/2 or HTTP/3

### Analytics Setup

After deployment, set up analytics:

1. Configure `public/analytics.js`
2. Verify tracking works
3. Set up goals/events
4. Monitor performance

## Custom Domains

### DNS Configuration

Point your domain to your hosting:

**A Record:**
```
@ → YOUR_IP_ADDRESS
```

**CNAME:**
```
www → your-hosting.com
```

### SSL/HTTPS

Most platforms provide free SSL certificates (Let's Encrypt). Enable in platform settings.

## Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
rm -rf node_modules dist package-lock.json
npm install
npm run build
```

### 404 Errors

- Check `base` in config
- Verify file paths
- Check router configuration
- Test with `npm run preview`

### Wrong URLs

- Set `SITE_URL` environment variable
- Check `site.base` in config
- Verify canonical URLs

### Images Not Loading

- Ensure images are in `public/`
- Use correct paths (relative to public/)
- Check case sensitivity

## Monitoring

After deployment:

### Uptime Monitoring

- Use UptimeRobot
- Pingdom
- StatusCake

### Performance Monitoring

- Google PageSpeed Insights
- WebPageTest
- Lighthouse CI

### Error Tracking

- Sentry
- Rollbar
- Bugsnag

## Next Steps

- 📖 Read [Production Features](./production-features.md)
- 🎨 Customize [Theme](./theme.md)
- 🔌 Build [Plugins](./plugins.md)

---
title: "Adding a Blog to MarkoPress"
description: "Turn your MarkoPress site into a full-featured blog with RSS feeds, tags, and SEO"
date: 2024-02-03
author: "Michael Rodriguez"
tags: ["tutorial", "blog", "rss", "seo"]
categories: ["Tutorials"]
excerpt: "Complete guide to creating and managing a blog with MarkoPress"
readingTime: "12 min"
---

# Adding a Blog to MarkoPress

Transform your MarkoPress site into a powerful blogging platform. This comprehensive guide covers everything from creating posts to advanced features like RSS feeds, tag pages, and SEO optimization.

## What You'll Build

By the end of this tutorial, you'll have:

- ✅ Beautiful blog with automatic routing
- ✅ RSS feed for subscribers
- ✅ Tag-based organization
- ✅ SEO-optimized posts
- ✅ Author profiles
- ✅ Reading time estimates
- ✅ Social sharing integration
- ✅ Related posts section

## Prerequisites

- Completed [Building a Static Site](/blog/2024-01-15-building-static-site)
- Basic knowledge of markdown
- Text editor (VS Code, etc.)

## Understanding Blog Structure

MarkoPress blogs use file-based routing:

```
content/
└── blog/
    ├── 2024-01-15-first-post.md    # → /blog/first-post
    ├── 2024-01-20-second-post.md   # → /blog/second-post
    └── 2024-02-01-third-post.md    # → /blog/third-post
```

**URL format:** `/blog/{filename-without-date}`

## Step 1: Enable Blog Plugin

Ensure the blog plugin is enabled in your config.

### Check Configuration

Edit `markopress.config.ts`:

```typescript
import { defineConfig } from 'markopress';
export default defineConfig({
  content: {
    blog: 'content/blog', // Blog directory
  },
  plugins: [
    '@markopress/plugin-content-blog',
  ],
});
```

## Step 2: Write Your First Post

Create a blog post with frontmatter.

### Create the File

Create `content/blog/2024-02-03-my-first-post.md`:

```markdown
---
title: "My First Blog Post"
description: "Hello world! This is my first post."
date: 2024-02-03
author: "Your Name"
tags: ["announcement", "first-post"]
categories: ["News"]
excerpt: "Welcome to my blog! This is my first post using MarkoPress."
---
# My First Blog Post
Welcome to my blog! This is my first post using MarkoPress.
## Why I Started Blogging
I decided to start a blog to:
- Share my knowledge
- Connect with others
- Build an online presence
- Improve my writing
## What to Expect
I'll be writing about:
- Web development
- Design
- Technology
- Personal growth
Thanks for reading!
```

### View Your Post

Run `npm run dev` and visit `/blog/my-first-post`.

You'll see:
- Beautiful typography
- Post metadata (date, author, tags)
- Automatic routing
- Responsive layout

## Step 3: Blog Frontmatter

Use frontmatter to add metadata to posts.

### Available Fields

```yaml
---
title: "Post Title"           # Required
description: "Post description"  # Required for SEO
date: 2024-02-03             # Required (YYYY-MM-DD)
author: "Author Name"        # Optional
tags: ["tag1", "tag2"]       # Optional (creates tag pages)
categories: ["Category"]     # Optional
excerpt: "Short summary"     # Optional (for previews)
draft: false                 # Optional (excludes from build if true)
---
```

### Complete Example

```yaml
---
title: "Advanced MarkoPress Techniques"
description: "Learn advanced features and best practices"
date: 2024-02-03
author: "Jane Developer"
tags: ["tutorial", "advanced", "markopress"]
categories: ["Tutorials"]
excerpt: "Dive deep into MarkoPress advanced features"
draft: false
---
# Content here...
```

## Step 4: Create Blog Homepage

Create a landing page for your blog.

### Blog Index Page

Create `content/pages/blog.md`:

```markdown
---
title: "Blog"
description: "Latest posts and tutorials"
---
# Blog
Welcome to my blog! Here you'll find tutorials, thoughts, and updates.
## Featured Posts
### [Advanced MarkoPress Techniques](/blog/2024-02-03-advanced-techniques)
Learn advanced features and best practices for building production-ready sites.
*February 3, 2024 • 5 min read*
### [Custom Theme Development](/blog/2024-01-27-custom-themes)
Create stunning custom themes with MarkoPress's powerful theming system.
*January 27, 2024 • 8 min read*
## Recent Posts
* [Getting Started with MarkoPress](/blog/2024-01-15-getting-started) - January 15, 2024
* [SEO Best Practices](/blog/2024-01-10-seo) - January 10, 2024
* [Performance Optimization](/blog/2024-01-05-performance) - January 5, 2024
## Categories
- [Tutorials](/blog/category/tutorials) - 15 posts
- [Updates](/blog/category/updates) - 8 posts
- [Case Studies](/blog/category/case-studies) - 5 posts
## Tags
#web-development (12) • #design (8) • #tutorial (15) • #performance (6)
```

## Step 5: RSS Feed

MarkoPress automatically generates RSS feeds.

### Feed Location

Your RSS feed is available at:

```
/api/rss/xml
```

### Subscribe in Feed Reader

Users can subscribe with:
- Feedly
- NewsBlur
- Inoreader
- Any RSS reader

### Customize Feed

Edit your config to customize the feed:

```typescript
export default defineConfig({
  site: {
    title: 'My Blog',
    description: 'My awesome blog',
  },
  themeConfig: {
    // Feed info
    feed: {
      title: 'My Blog - RSS Feed',
      description: 'Latest posts from My Blog',
    },
  },
});
```

## Step 6: Tag Pages

Create pages for each tag automatically.

### Enable Tag Pages

Tags are automatically generated from frontmatter. Create posts with tags:

```yaml
---
title: "Post Title"
tags: ["tutorial", "beginner"]
---
```

### Tag Page URLs

Each tag gets a page at:

```
/blog/tags/tutorial
/blog/tags/beginner
```

### Custom Tag Layout

Create a custom layout for tag pages by overriding the blog layout.

## Step 7: Author Profiles

Add author information to posts.

### Author Metadata

```yaml
---
title: "Post Title"
author: "Jane Developer"
authorUrl: "https://twitter.com/janedev"
authorBio: "Web developer and designer"
---
```

### Multiple Authors

For sites with multiple authors, create an `authors` directory:

```
content/
├── authors/
│   ├── jane.md
│   └── john.md
└── blog/
    └── post.md
```

**`content/authors/jane.md`:**
```yaml
---
name: "Jane Developer"
bio: "Web developer and designer"
url: "https://twitter.com/janedev"
avatar: "/authors/jane.jpg"
---
```

**Reference in post:**
```yaml
---
author: "jane"
---
```

## Step 8: Reading Time

Automatically calculate reading time for posts.

### Add Reading Time Plugin

Create `plugins/reading-time.ts`:

```typescript
import type { MarkoPressPlugin, ContentContext, PostData } from 'markopress/plugin';
export default function readingTimePlugin(): MarkoPressPlugin {
  return {
    name: 'reading-time-plugin',
    contentLoaded(ctx: ContentContext) {
      const posts = ctx.getPosts();
      for (const post of posts) {
        const words = post.content.split(/\s+/).length;
        const minutes = Math.ceil(words / 200); // 200 words per minute
        post.frontmatter.readingTime = `${minutes} min read`;
        ctx.addPost(post);
      }
    },
  };
}
```

### Use in Config

```typescript
import readingTimePlugin from './plugins/reading-time';
export default defineConfig({
  plugins: [
    readingTimePlugin(),
  ],
});
```

### Display in Template

Add to your blog layout:

```marko
<if(input.post.readingTime)>
  <span class="reading-time">
    ${input.post.readingTime}
  </span>
</if>
```

## Step 9: Social Sharing

Add social sharing buttons to posts.

### Share Component

Create `src/tags/ShareButtons.marko`:

```marko
class {
  shareToTwitter() {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(input.title);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      '_blank'
    );
  }
  shareToLinkedIn() {
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      '_blank'
    );
  }
  copyLink() {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied!');
  }
}
<div class="share-buttons">
  <button onClick=>shareToTwitter()>
    Share on Twitter
  </button>
  <button onClick=>shareToLinkedIn()>
    Share on LinkedIn
  </button>
  <button onClick=>copyLink()>
    Copy Link
  </button>
</div>
<style>`
  .share-buttons {
    display: flex;
    gap: 0.5rem;
    margin-top: 2rem;
  }
  .share-buttons button {
    padding: 0.5rem 1rem;
    background: var(--bg-primary);
    border: 2px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .share-buttons button:hover {
    border-color: var(--accent-color);
  }
`</style>
```

### Use in Post Layout

```marko
<div class="blog-post">
  <h1>${input.title}</h1>
  <div class="post-content">
    <include(input.content/>
  </div>
  <components.ShareButtons title=input.title/>
</div>
```

## Step 10: SEO Optimization

Optimize your blog for search engines.

### Meta Tags

Add meta tags to post frontmatter:

```yaml
---
title: "Post Title"
description: "Post description for SEO"
---
# Content
```

MarkoPress automatically creates:

```html
<meta name="description" content="Post description">
<meta property="og:title" content="Post Title">
<meta property="og:description" content="Post description">
<meta property="og:type" content="article">
```

### Structured Data

Add JSON-LD for blog posts:

```marko
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "${input.title}",
  "description": "${input.description}",
  "datePublished": "${input.date}",
  "author": {
    "@type": "Person",
    "name": "${input.author}"
  }
}
</script>
```

### Sitemap

MarkoPress automatically includes blog posts in `sitemap.xml`.

## Step 11: Related Posts

Show related posts at the end of each post.

### Related Posts Plugin

Create `plugins/related-posts.ts`:

```typescript
import type { MarkoPressPlugin, PostData } from 'markopress/plugin';
export default function relatedPostsPlugin(): MarkoPressPlugin {
  return {
    name: 'related-posts-plugin',
    contentLoaded(ctx) {
      const posts = ctx.getPosts();
      for (const post of posts) {
        const postTags = post.tags || [];
        const related = posts
          .filter(p => p.id !== post.id)
          .filter(p => {
            const pTags = p.tags || [];
            return pTags.some(t => postTags.includes(t));
          })
          .slice(0, 3);
        post.frontmatter.relatedPosts = related;
        ctx.addPost(post);
      }
    },
  };
}
```

### Display Related Posts

```marko
<if(input.relatedPosts && input.relatedPosts.length)>
  <section class="related-posts">
    <h3>Related Posts</h3>
    <ul>
      <for|post| of=input.relatedPosts>
        <li>
          <a href=post.routePath>${post.title}</a>
        </li>
      </for>
    </ul>
  </section>
</if>
```

## Step 12: Post Series

Create multi-part tutorial series.

### Series Metadata

```yaml
---
title: "Part 1: Getting Started"
series: "Complete MarkoPress Guide"
seriesOrder: 1
---
```

### Series Plugin

```typescript
export default function seriesPlugin(): MarkoPressPlugin {
  return {
    name: 'series-plugin',
    contentLoaded(ctx) {
      const posts = ctx.getPosts();
      const seriesMap = new Map();
      for (const post of posts) {
        const series = post.frontmatter.series;
        if (!series) continue;
        if (!seriesMap.has(series)) {
          seriesMap.set(series, []);
        }
        seriesMap.get(series).push(post);
      }
      for (const [series, seriesPosts] of seriesMap) {
        for (const post of seriesPosts) {
          post.frontmatter.seriesPosts = seriesPosts;
          ctx.addPost(post);
        }
      }
    },
  };
}
```

### Display Series Navigation

```marko
<if(input.seriesPosts)>
  <nav class="series-nav">
    <h4>Series: ${input.series}</h4>
    <ol>
      <for|post| of=input.seriesPosts.sort((a, b) => a.seriesOrder - b.seriesOrder)>
        <li class=${post.id === input.id ? 'current' : ''}>
          <if(post.id === input.id)>
            <span>${post.title}</span>
          <else/>
            <a href=post.routePath>${post.title}</a>
          </if>
        </li>
      </for>
    </ol>
  </nav>
</if>
```

## Step 13: Analytics

Track blog performance.

### Google Analytics

Add to `markopress.config.ts`:

```typescript
export default defineConfig({
  themeConfig: {
    analytics: {
      googleAnalyticsId: 'GA_MEASUREMENT_ID',
    },
  },
});
```

### Plausible Analytics

```typescript
export default defineConfig({
  themeConfig: {
    analytics: {
      plausibleDomain: 'yourdomain.com',
    },
  },
});
```

## Step 14: Comments

Add comments to your blog.

### Disqus Integration

Create `src/tags/Comments.marko`:

```marko
<div id="disqus_thread"></div>
<script>
  var disqus_config = function () {
    this.page.url = '${input.url}';
    this.page.identifier = '${input.id}';
  };
  (function() {
    var d = document, s = d.createElement('script');
    s.src = 'https://YOUR-DISQUS-SHORTNAME.disqus.com/embed.js';
    s.setAttribute('data-timestamp', +new Date());
    (d.head || d.body).appendChild(s);
  })();
</script>
<noscript>
  Please enable JavaScript to view the comments.
</noscript>
```

### Use in Layout

```marko
<div class="blog-post">
  <!-- Post content -->
  <components.Comments url=input.url id=input.id/>
</div>
```

## Best Practices

### 1. Consistent URLs

Use consistent URL patterns:

```
/blog/yyyy-mm-dd-post-title
```

### 2. Optimize Images

Compress images before uploading:

```bash
# Use imageoptim or squoosh-cli
imageoptim blog-image.jpg
```

### 3. Internal Linking

Link to related posts:

```markdown
Check out [my previous post](/blog/2024-01-15-previous-post) for more details.
```

### 4. Update Old Posts

Keep content fresh by updating old posts with new information.

### 5. Use Categories Wisely

- Limit to 3-5 categories
- Make them broad enough to grow
- Use tags for specific topics

## Advanced Features

### Draft Posts

Create posts that won't be published:

```yaml
---
title: "Draft Post"
draft: true
---
```

### Scheduled Posts

Set future dates to schedule posts:

```yaml
---
title: "Future Post"
date: 2024-12-25
---
```

### Post Expiration

Add expiration dates:

```yaml
---
title: "Temporary Announcement"
expires: 2024-03-01
---
```

### Syndication

Automatically share new posts to social media using webhooks.

## Troubleshooting

### Posts Not Showing

1. Check file is in `content/blog/`
2. Verify frontmatter is valid
3. Ensure `draft: false` or no `draft` field
4. Run `npm run build` and check for errors

### RSS Feed Empty

1. Ensure blog plugin is enabled
2. Check posts have valid dates
3. Verify feed URL: `/api/rss/xml`

### Tags Not Working

1. Check tag names in frontmatter
2. Ensure tags are arrays: `["tag1", "tag2"]`
3. Rebuild the site

## Next Steps

Your blog is now ready! Here's what to do next:

1. ✅ Write your first 5 posts
2. ✅ Set up analytics
3. ✅ Add comments (optional)
4. ✅ Customize your theme
5. ✅ Share your posts

## Continue Learning

- 📖 [Theming Guide](/guides/theming)
- 🔌 [Plugin Development](/guides/plugins)
- 🚀 [Deployment Guide](/guides/deployment)
- 📊 [SEO Best Practices](/blog/2024-03-02-seo-optimization)

---

*Happy blogging! 🎉*

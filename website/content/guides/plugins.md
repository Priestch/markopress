# Plugin Development

Extend MarkoPress with custom plugins.

## Overview

MarkoPress plugins let you hook into the build process and extend functionality. The plugin system provides:

- **Content Processing** - Transform and organize content
- **Markdown Extensions** - Add custom markdown syntax and features
- **Route Generation** - Create custom routes and endpoints
- **Build Hooks** - Run code before/after builds
- **Config Transformation** - Modify build configuration

## Plugin Structure

A plugin is an object that implements the `MarkoPressPlugin` interface:

```typescript
import type { MarkoPressPlugin } from 'markopress/plugin';

const myPlugin: MarkoPressPlugin = {
  name: 'my-plugin',

  // Hook: Transform config
  config(config) {
    return config;
  },

  // Hook: Process content
  contentLoaded(ctx) {
    // Access and transform content
  },

  // Hook: Before build
  beforeBuild(ctx) {
    // Prepare for build
  },

  // Hook: After build
  afterBuild(ctx) {
    // Post-process build output
  },

  // Hook: Extend markdown
  extendMarkdown(md) {
    // Add markdown-it plugins
  },

  // Hook: Extend routes
  extendRoutes(routes) {
    // Add custom routes
    return routes;
  },
};
```

## Quick Start

### Your First Plugin

Create a plugin that logs all pages:

```typescript
// plugins/logger.ts
import type { MarkoPressPlugin, ContentContext } from 'markopress/plugin';

export default function loggerPlugin(): MarkoPressPlugin {
  return {
    name: 'logger-plugin',

    contentLoaded(ctx: ContentContext) {
      const pages = ctx.getPages();
      const posts = ctx.getPosts();

      ctx.utils.log('=== Content Loaded ===');
      ctx.utils.log(`Pages: ${pages.length}`);
      ctx.utils.log(`Posts: ${posts.length}`);

      for (const page of pages) {
        ctx.utils.log(`  - ${page.routePath}`);
      }
    },
  };
}
```

Use it in your config:

```typescript
// markopress.config.ts
import { defineConfig } from 'markopress';
import loggerPlugin from './plugins/logger';

export default defineConfig({
  plugins: [
    loggerPlugin(),
  ],
});
```

## Plugin Hooks

### Config Hook

Transform the configuration before the build starts.

```typescript
import type { MarkoPressPlugin, ResolvedConfig } from 'markopress/plugin';

export default function configPlugin(): MarkoPressPlugin {
  return {
    name: 'config-plugin',

    config(config: ResolvedConfig) {
      // Modify config
      config.site.title = 'Modified Title';

      // Add custom data
      config.site.customData = {
        apiKey: process.env.API_KEY,
      };

      return config;
    },
  };
}
```

### Content Loaded Hook

Process and transform content after it's loaded.

```typescript
import type { MarkoPressPlugin, ContentContext, PageData } from 'markopress/plugin';

export default function contentPlugin(): MarkoPressPlugin {
  return {
    name: 'content-plugin',

    contentLoaded(ctx: ContentContext) {
      const pages = ctx.getPages();

      for (const page of pages) {
        // Transform frontmatter
        page.frontmatter.lastModified = new Date().toISOString();

        // Add computed fields
        page.frontmatter.wordCount = page.content.split(/\s+/).length;

        // Add excerpt if missing
        if (!page.excerpt) {
          page.excerpt = page.content.slice(0, 200) + '...';
        }

        // Update the page
        ctx.addPage(page);
      }
    },
  };
}
```

### Build Hooks

Run code before or after the build.

```typescript
import type { MarkoPressPlugin, BuildContext } from 'markopress/plugin';
import { writeFile, mkdir } from 'fs/promises';

export default function buildPlugin(): MarkoPressPlugin {
  return {
    name: 'build-plugin',

    async beforeBuild(ctx: BuildContext) {
      ctx.utils.log('Preparing build...');

      // Generate files before build
      await mkdir('dist/generated', { recursive: true });
      await writeFile(
        'dist/generated/build-info.json',
        JSON.stringify({
          timestamp: new Date().toISOString(),
          pages: ctx.content.pages.length,
        })
      );
    },

    async afterBuild(ctx: BuildContext) {
      ctx.utils.log('Build complete!');

      // Post-process build output
      const stats = {
        pages: ctx.content.pages.length,
        posts: ctx.content.blog.length,
        routes: Object.keys(ctx.routes).length,
      };

      await writeFile(
        'dist/stats.json',
        JSON.stringify(stats, null, 2)
      );
    },
  };
}
```

### Markdown Hook

Extend markdown functionality with markdown-it plugins.

```typescript
import type { MarkoPressPlugin } from 'markopress/plugin';
import markdownItEmoji from 'markdown-it-emoji';
import markdownItFootnote from 'markdown-it-footnote';

export default function markdownPlugin(): MarkoPressPlugin {
  return {
    name: 'markdown-plugin',

    extendMarkdown(md) {
      // Add emoji support
      md.use(markdownItEmoji);

      // Add footnotes
      md.use(markdownItFootnote);

      // Custom renderer
      const defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

      md.renderer.rules.link_open = function(tokens, idx, options, env, self) {
        // Add target="_blank" to external links
        const hrefIndex = tokens[idx].attrIndex('href');
        if (hrefIndex >= 0) {
          const href = tokens[idx].attrs[hrefIndex][1];
          if (href.startsWith('http')) {
            tokens[idx].attrPush(['target', '_blank']);
            tokens[idx].attrPush(['rel', 'noopener']);
          }
        }
        return defaultRender(tokens, idx, options, env, self);
      };
    },
  };
}
```

### Custom Markdown Containers

Add custom container syntax like `:::tip`:

```typescript
import type { MarkoPressPlugin } from 'markopress/plugin';
import type MarkdownIt from 'markdown-it';

export default function containerPlugin(): MarkoPressPlugin {
  return {
    name: 'container-plugin',

    extendMarkdown(md: typeof MarkdownIt) {
      // Tip container
      md.use(require('markdown-it-container'), 'tip', {
        render: (tokens: any[], idx: number) => {
          if (tokens[idx].nesting === 1) {
            return '<div class="callout callout--tip">\n';
          }
          return '</div>\n';
        },
      });

      // Warning container
      md.use(require('markdown-it-container'), 'warning', {
        render: (tokens: any[], idx: number) => {
          if (tokens[idx].nesting === 1) {
            return '<div class="callout callout--warning">\n';
          }
          return '</div>\n';
        },
      });

      // Danger container
      md.use(require('markdown-it-container'), 'danger', {
        render: (tokens: any[], idx: number) => {
          if (tokens[idx].nesting === 1) {
            return '<div class="callout callout--danger">\n';
          }
          return '</div>\n';
        },
      });
    },
  };
}
```

Usage in markdown:

```markdown
:::tip
This is a helpful tip!
:::

:::warning
Be careful with this!
:::

:::danger
This is dangerous!
:::
```

### Routes Hook

Add custom routes to your site.

```typescript
import type { MarkoPressPlugin, RouteManifest } from 'markopress/plugin';

export default function routesPlugin(): MarkoPressPlugin {
  return {
    name: 'routes-plugin',

    extendRoutes(routes: RouteManifest) {
      // Add redirect
      routes['/old-path'] = {
        path: '/old-path',
        redirect: '/new-path',
      };

      // Add API route
      routes['/api/search'] = {
        path: '/api/search',
        component: './src/routes/api/search.marko',
      };

      // Add dynamic routes
      for (let i = 1; i <= 10; i++) {
        routes[`/page/${i}`] = {
          path: `/page/${i}`,
          component: './src/routes/page.marko',
          meta: { pageNum: i },
        };
      }

      return routes;
    },
  };
}
```

## Plugin Examples

### Reading Time Plugin

Calculate estimated reading time for blog posts:

```typescript
// plugins/reading-time.ts
import type { MarkoPressPlugin, ContentContext, PostData } from 'markopress/plugin';

interface ReadingTimePluginOptions {
  wordsPerMinute?: number;
}

export default function readingTimePlugin(
  options: ReadingTimePluginOptions = {}
): MarkoPressPlugin {
  const { wordsPerMinute = 200 } = options;

  return {
    name: 'reading-time-plugin',

    contentLoaded(ctx: ContentContext) {
      const posts = ctx.getPosts();

      for (const post of posts) {
        const words = post.content.split(/\s+/).length;
        const minutes = Math.ceil(words / wordsPerMinute);

        post.frontmatter.readingTime = `${minutes} min read`;

        ctx.addPost(post);
      }
    },
  };
}
```

### Tag Index Plugin

Generate index pages for blog tags:

```typescript
// plugins/tag-index.ts
import type { MarkoPressPlugin, ContentContext, PostData, PageData } from 'markopress/plugin';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export default function tagIndexPlugin(): MarkoPressPlugin {
  return {
    name: 'tag-index-plugin',

    async contentLoaded(ctx: ContentContext) {
      const posts = ctx.getPosts();
      const tagMap = new Map<string, PostData[]>();

      // Group posts by tags
      for (const post of posts) {
        const tags = post.tags || [];
        for (const tag of tags) {
          if (!tagMap.has(tag)) {
            tagMap.set(tag, []);
          }
          tagMap.get(tag)!.push(post);
        }
      }

      // Generate tag index pages
      for (const [tag, tagPosts] of tagMap.entries()) {
        const page: PageData = {
          id: `tag-${tag}`,
          filePath: join(ctx.config.build.outDir, 'blog', 'tags', `${tag}.html`),
          routePath: `/blog/tags/${tag}`,
          frontmatter: {
            title: `Tag: ${tag}`,
            layout: 'tag-index',
            tag,
            posts: tagPosts.map(p => ({
              title: p.frontmatter.title,
              date: p.date,
              excerpt: p.excerpt,
              url: p.routePath,
            })),
          },
          content: '',
          html: '',
          headers: [],
        };

        ctx.addPage(page);
      }

      // Generate tag list page
      const tagListPage: PageData = {
        id: 'tags-list',
        filePath: join(ctx.config.build.outDir, 'blog', 'tags', 'index.html'),
        routePath: '/blog/tags',
        frontmatter: {
          title: 'All Tags',
          layout: 'tag-list',
          tags: Array.from(tagMap.keys()).sort(),
        },
        content: '',
        html: '',
        headers: [],
      };

      ctx.addPage(tagListPage);
    },
  };
}
```

### Sitemap Plugin

Generate a custom sitemap with additional pages:

```typescript
// plugins/sitemap.ts
import type { MarkoPressPlugin, BuildContext } from 'markopress/plugin';
import { writeFile } from 'fs/promises';

export default function sitemapPlugin(): MarkoPressPlugin {
  return {
    name: 'sitemap-plugin',

    async afterBuild(ctx: BuildContext) {
      const { site } = ctx.config;
      const urls: string[] = [];

      // Add all content pages
      for (const page of ctx.content.pages) {
        urls.push(page.routePath);
      }

      // Add blog posts
      for (const post of ctx.content.blog) {
        urls.push(post.routePath);
      }

      // Add custom URLs
      urls.push('/about', '/contact', '/feed.xml');

      // Generate sitemap XML
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${site.url}${url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>`;

      await writeFile('dist/sitemap-custom.xml', xml);
      ctx.utils.log('Custom sitemap generated');
    },
  };
}
```

### Image Optimization Plugin

Optimize images in content:

```typescript
// plugins/image-optimize.ts
import type { MarkoPressPlugin, ContentContext, PageData } from 'markopress/plugin';
import sharp from 'sharp';

export default function imageOptimizePlugin(): MarkoPressPlugin {
  return {
    name: 'image-optimize-plugin',

    async contentLoaded(ctx: ContentContext) {
      const pages = ctx.getPages();

      for (const page of pages) {
        // Find image references
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        const images = Array.from(page.html.matchAll(imageRegex));

        for (const match of images) {
          const alt = match[1];
          const src = match[2];

          // Skip external images
          if (src.startsWith('http')) continue;

          // Optimize image
          const inputPath = join(process.cwd(), 'public', src);
          const outputPath = join(process.cwd(), 'dist', src);

          await sharp(inputPath)
            .resize(800, 600, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toFile(outputPath);

          ctx.utils.log(`Optimized: ${src}`);
        }
      }
    },
  };
}
```

### Search Index Plugin

Generate a search index for client-side search:

```typescript
// plugins/search-index.ts
import type { MarkoPressPlugin, BuildContext } from 'markopress/plugin';
import { writeFile } from 'fs/promises';

interface SearchDocument {
  id: string;
  title: string;
  url: string;
  content: string;
  excerpt: string;
}

export default function searchIndexPlugin(): MarkoPressPlugin {
  return {
    name: 'search-index-plugin',

    async afterBuild(ctx: BuildContext) {
      const documents: SearchDocument[] = [];

      // Index all pages
      for (const page of ctx.content.pages) {
        documents.push({
          id: page.id,
          title: page.frontmatter.title as string || 'Untitled',
          url: page.routePath,
          content: page.content,
          excerpt: page.excerpt || '',
        });
      }

      // Index blog posts
      for (const post of ctx.content.blog) {
        documents.push({
          id: post.id,
          title: post.frontmatter.title as string || 'Untitled',
          url: post.routePath,
          content: post.content,
          excerpt: post.excerpt || '',
        });
      }

      // Write search index
      await writeFile(
        'dist/search-index.json',
        JSON.stringify(documents, null, 2)
      );

      ctx.utils.log(`Search index created with ${documents.length} documents`);
    },
  };
}
```

## Plugin Configuration

Plugins can accept configuration options:

```typescript
// plugins/my-plugin.ts
export interface MyPluginOptions {
  enabled?: boolean;
  customOption?: string;
}

export default function myPlugin(
  options: MyPluginOptions = {}
): MarkoPressPlugin {
  const { enabled = true, customOption = 'default' } = options;

  return {
    name: 'my-plugin',

    config(config) {
      if (!enabled) return config;

      // Use options
      config.site.customField = customOption;

      return config;
    },
  };
}
```

Use with options:

```typescript
// markopress.config.ts
export default defineConfig({
  plugins: [
    ['my-plugin', {
      enabled: true,
      customOption: 'custom value',
    }],
  ],
});
```

## Publishing Plugins

### Package Structure

```bash
my-markopress-plugin/
├── package.json
├── README.md
├── src/
│   └── index.ts
└── tsconfig.json
```

### package.json

```json
{
  "name": "@username/markopress-plugin-myplugin",
  "version": "1.0.0",
  "description": "My awesome MarkoPress plugin",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist"
  ],
  "keywords": [
    "markopress",
    "plugin",
    "ssg"
  ],
  "peerDependencies": {
    "markopress": "^1.0.0"
  },
  "devDependencies": {
    "markopress": "^1.0.0",
    "typescript": "^5.0.0"
  }
}
```

### Plugin Entry Point

```typescript
// src/index.ts
import type { MarkoPressPlugin } from 'markopress/plugin';

export interface MyPluginOptions {
  // Plugin options
}

export default function myPlugin(
  options?: MyPluginOptions
): MarkoPressPlugin {
  return {
    name: '@username/markopress-plugin-myplugin',
    // Plugin implementation
  };
}

export type { MyPluginOptions };
```

### Naming Convention

Plugin packages should follow this naming pattern:

```
@username/markopress-plugin-{plugin-name}
markopress-plugin-{plugin-name}  # For official plugins
```

## Best Practices

### 1. Type Safety

Always use TypeScript and export types:

```typescript
export interface MyPluginOptions {
  enabled?: boolean;
}

export default function myPlugin(
  options: MyPluginOptions = {}
): MarkoPressPlugin {
  // ...
}
```

### 2. Error Handling

Handle errors gracefully:

```typescript
contentLoaded(ctx: ContentContext) {
  try {
    // Plugin logic
  } catch (error) {
    ctx.utils.error(`Plugin error: ${error}`);
    // Don't throw - let build continue
  }
}
```

### 3. Performance

Avoid heavy operations in hooks:

```typescript
async contentLoaded(ctx: ContentContext) {
  // ✅ Good: Efficient iteration
  for (const page of ctx.getPages()) {
    // Light processing
  }

  // ❌ Bad: Blocking operations
  await Promise.all(ctx.getPages().map(async (page) => {
    await heavyOperation(page); // Don't do this
  }));
}
```

### 4. Documentation

Document your plugin thoroughly:

```typescript
/**
 * My awesome plugin
 *
 * @example
 * ```ts
 * import myPlugin from '@user/markopress-plugin-my';
 *
 * export default defineConfig({
 *   plugins: [myPlugin()],
 * });
 * ```
 */
export default function myPlugin(
  options: MyPluginOptions = {}
): MarkoPressPlugin {
  // ...
}
```

## Testing Plugins

Create a test site to verify your plugin:

```typescript
// markopress.config.ts
import { defineConfig } from 'markopress';
import myPlugin from './plugins/my-plugin';

export default defineConfig({
  plugins: [
    myPlugin({
      // Test options
    }),
  ],
});
```

Run the dev server and build:

```bash
npm run dev
npm run build
```

Check for:
- ✅ Plugin loads without errors
- ✅ Hooks execute in correct order
- ✅ Content is transformed correctly
- ✅ Build output is valid

## Plugin Hook Order

Hooks execute in this order:

1. **config** - Config transformation
2. **extendMarkdown** - Markdown extension
3. **contentLoaded** - Content processing
4. **beforeBuild** - Pre-build preparation
5. **extendRoutes** - Route generation
6. **afterBuild** - Post-build processing

## API Reference

### PluginContext

```typescript
interface PluginContext {
  config: ResolvedConfig;
  utils: {
    log: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}
```

### ContentContext

```typescript
interface ContentContext extends PluginContext {
  addPage: (page: PageData) => void;
  addPost: (post: PostData) => void;
  getPages: () => PageData[];
  getPosts: () => PostData[];
}
```

### BuildContext

```typescript
interface BuildContext extends PluginContext {
  content: {
    pages: PageData[];
    docs: PageData[];
    blog: PostData[];
  };
  routes: RouteManifest;
}
```

## Examples

See the official plugins for reference:

- [@markopress/plugin-content-pages](https://github.com/markopress/plugin-content-pages)
- [@markopress/plugin-content-docs](https://github.com/markopress/plugin-content-docs)
- [@markopress/plugin-content-blog](https://github.com/markopress/plugin-content-blog)

## Next Steps

- 📖 Read [API Reference](./api.md)
- 🎨 Learn about [Theming](./theming.md)
- 🚀 Deploy your [Site](../docs/deployment.md)

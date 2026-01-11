/**
 * Blog plugin for MarkoPress
 */

import type { MarkoPressPlugin, ContentContext, PostData } from 'markopress/plugin';

export interface BlogPluginOptions {
  /**
   * Content directory for blog posts
   * @default 'content/blog'
   */
  contentDir?: string;

  /**
   * Route prefix for blog posts
   * @default '/blog'
   */
  prefix?: string;

  /**
   * Whether to generate RSS feed
   * @default true
   */
  rss?: boolean;

  /**
   * RSS feed filename
   * @default 'rss.xml'
   */
  rssFilename?: string;

  /**
   * Whether to generate tag pages
   * @default true
   */
  tags?: boolean;

  /**
   * Whether to generate category pages
   * @default true
   */
  categories?: boolean;
}

/**
 * Create blog plugin
 */
export default function blogPlugin(options: BlogPluginOptions = {}): MarkoPressPlugin {
  const {
    contentDir = 'content/blog',
    prefix = '/blog',
    rss = true,
    rssFilename = 'rss.xml',
    tags = true,
    categories = true,
  } = options;

  return {
    name: '@markopress/plugin-content-blog',

    async contentLoaded(ctx: ContentContext) {
      const blog = ctx.getPosts();

      // Sort posts by date (newest first)
      const sortedPosts = blog.sort((a, b) => {
        const dateA = new Date(a.frontmatter.date as string || 0);
        const dateB = new Date(b.frontmatter.date as string || 0);
        return dateB.getTime() - dateA.getTime();
      });

      for (const post of sortedPosts) {
        if (!post.routePath.startsWith(prefix)) {
          continue;
        }

        // Add post to content manifest
        ctx.addPage({
          id: post.id,
          filePath: post.filePath,
          routePath: post.routePath,
          frontmatter: post.frontmatter,
          content: post.content,
          html: post.html,
          headers: post.headers,
          excerpt: post.excerpt,
        });
      }

      // Generate RSS feed
      if (rss) {
        // TODO: Generate RSS feed
      }

      // Generate tag pages
      if (tags) {
        const allTags = new Set<string>();
        for (const post of sortedPosts) {
          const postTags = post.frontmatter.tags as string[] || [];
          for (const tag of postTags) {
            allTags.add(tag);
          }
        }
        // TODO: Generate tag pages
      }

      // Generate category pages
      if (categories) {
        const allCategories = new Set<string>();
        for (const post of sortedPosts) {
          const postCategories = post.frontmatter.categories as string[] || [];
          for (const category of postCategories) {
            allCategories.add(category);
          }
        }
        // TODO: Generate category pages
      }
    },
  };
}

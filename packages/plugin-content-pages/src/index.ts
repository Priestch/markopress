/**
 * Pages plugin for MarkoPress
 */

import type { MarkoPressPlugin, ContentContext, PageData } from 'markopress/plugin';

export interface PagesPluginOptions {
  /**
   * Content directory for pages
   * @default 'content/pages'
   */
  contentDir?: string;

  /**
   * Route prefix for pages
   * @default '/'
   */
  prefix?: string;
}

/**
 * Create pages plugin
 */
export default function pagesPlugin(options: PagesPluginOptions = {}): MarkoPressPlugin {
  const { contentDir = 'content/pages', prefix = '/' } = options;

  return {
    name: '@markopress/plugin-content-pages',

    async contentLoaded(ctx: ContentContext) {
      const pages = ctx.getPages();

      for (const page of pages) {
        if (!page.routePath.startsWith(prefix)) {
          continue;
        }

        // Add page to content manifest
        ctx.addPage({
          id: page.id,
          filePath: page.filePath,
          routePath: page.routePath,
          frontmatter: page.frontmatter,
          content: page.content,
          html: page.html,
          headers: page.headers,
          excerpt: page.excerpt,
        });
      }
    },
  };
}

/**
 * Documentation plugin for MarkoPress
 */

import type { MarkoPressPlugin, ContentContext, PageData } from 'markopress/plugin';

export interface DocsPluginOptions {
  /**
   * Content directory for docs
   * @default 'content/docs'
   */
  contentDir?: string;

  /**
   * Route prefix for docs
   * @default '/docs'
   */
  prefix?: string;

  /**
   * Sidebar configuration
   */
  sidebar?: Record<string, SidebarItem[]>;
}

export interface SidebarItem {
  text?: string;
  link?: string;
  items?: SidebarItem[];
  collapsed?: boolean;
}

/**
 * Create docs plugin
 */
export default function docsPlugin(options: DocsPluginOptions = {}): MarkoPressPlugin {
  const { contentDir = 'content/docs', prefix = '/docs', sidebar = {} } = options;

  return {
    name: '@markopress/plugin-content-docs',

    async contentLoaded(ctx: ContentContext) {
      const docs = ctx.getPages();

      for (const doc of docs) {
        if (!doc.routePath.startsWith(prefix)) {
          continue;
        }

        // Add doc to content manifest
        ctx.addPage({
          id: doc.id,
          filePath: doc.filePath,
          routePath: doc.routePath,
          frontmatter: doc.frontmatter,
          content: doc.content,
          html: doc.html,
          headers: doc.headers,
          excerpt: doc.excerpt,
        });
      }
    },

    extendMarkdown(md) {
      // Add doc-specific markdown extensions
      // TODO: Add custom containers for docs
    },
  };
}

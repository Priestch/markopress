import type { MarkoPressPlugin } from '../../plugin/types.js';
import type { SeoPluginFactoryOptions } from './types.js';
import { generateSitemap } from './sitemap.js';

/**
 * SEO Plugin - Generates sitemap.xml for SEO
 *
 * @example
 * // In markopress config
 * export default defineConfig({
 *   plugins: ['seo'],
 *   seo: {
 *     sitemap: {
 *       hostname: 'https://example.com',
 *       exclude: ['/api/**']
 *     }
 *   }
 * })
 */
export function seoPlugin(options?: SeoPluginFactoryOptions): MarkoPressPlugin {
  return {
    name: 'seo',

    async afterBuild(ctx) {
      // Get SEO config from plugin factory options
      const sitemapConfig = options?.sitemap;

      // Skip if sitemap not enabled
      if (!sitemapConfig) {
        console.log('[seo] Sitemap not configured, skipping');
        return;
      }

      // Generate sitemap
      await generateSitemap(ctx, sitemapConfig);
    },
  };
}

/**
 * Default export for plugin loading
 */
export default seoPlugin;

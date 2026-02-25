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

    async postBuild(ctx) {
      const { config } = ctx;

      // Get SEO config from user config
      const seoConfig = (config as any).seo;

      // Skip if sitemap not enabled
      if (!seoConfig?.sitemap) {
        console.log('[seo] Sitemap not configured, skipping');
        return;
      }

      // Generate sitemap
      await generateSitemap(ctx, seoConfig.sitemap);
    },
  };
}

/**
 * Default export for plugin loading
 */
export default seoPlugin;

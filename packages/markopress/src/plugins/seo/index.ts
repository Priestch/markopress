import type { MarkoPressPlugin } from '../../plugin/types.js';
import type { SeoPluginFactoryOptions } from './types.js';
import { generateSitemap } from './sitemap.js';
import { generateRobots } from './robots.js';

/**
 * SEO Plugin - Generates sitemap.xml and robots.txt
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
      const seoConfig = (options || (config as any).seo || {}) as any;
      const userSeoConfig = (config as any).seo;

      const hasSitemap = Boolean(seoConfig?.sitemap || userSeoConfig?.sitemap);
      const hasRobots = Boolean(seoConfig?.robots || userSeoConfig?.robots);

      // Skip if no seo features are enabled
      if (!hasSitemap && !hasRobots) {
        console.log('[seo] No SEO generation configured, skipping');
        return;
      }

      if (seoConfig?.sitemap || userSeoConfig?.sitemap) {
        // Generate sitemap
        await generateSitemap(ctx, seoConfig.sitemap || userSeoConfig.sitemap);
      }

      if (seoConfig?.robots || userSeoConfig?.robots) {
        // Generate robots.txt
        await generateRobots(ctx, seoConfig.robots || userSeoConfig.robots, seoConfig.sitemap || userSeoConfig?.sitemap);
      }
    },
  };
}

/**
 * Default export for plugin loading
 */
export default seoPlugin;

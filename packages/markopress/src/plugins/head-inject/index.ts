import type { MarkoPressPlugin } from '../../plugin/types.js';
import type { ResolvedConfig } from '../../config/index.js';
import type { HeadTag, GroupedHeadTags } from './types.js';
import { validateHeadConfig } from './validator.js';
import { transformHeadConfig } from './transformer.js';

/**
 * Head inject plugin configuration options
 */
export interface HeadInjectPluginOptions {
  /**
   * Enable/disable the plugin
   * @default true
   */
  enabled?: boolean;
}

/**
 * Head Inject Plugin
 *
 * Injects custom head tags (meta, link, script, base) into pages
 * based on site configuration (config.site.head).
 *
 * Reads head tags from config.site.head via the config hook,
 * validates and transforms them, and stores them for rendering.
 *
 * @example
 * // In markopress config
 * export default defineConfig({
 *   site: {
 *     head: [
 *       { type: 'meta', property: 'og:title', content: 'My Site' },
 *       { type: 'link', rel: 'preconnect', href: 'https://fonts.googleapis.com' }
 *     ]
 *   }
 * })
 */
export const headInjectPlugin: MarkoPressPlugin = {
  name: 'head-inject',

  /**
   * Config hook: Read and process config.site.head
   * Called during plugin loading, before content processing
   */
  config(config: ResolvedConfig): ResolvedConfig {
    // Read head tags from config.site.head
    const configHead = config.site?.head;

    if (!configHead || configHead.length === 0) {
      return config;
    }

    // Validate head configuration
    validateHeadConfig(configHead as unknown[]);

    // Transform and group head tags by position
    const groupedTags = transformHeadConfig(configHead);

    // Store for later access in templates via $global
    return {
      ...config,
      _headInject: groupedTags
    } as unknown as ResolvedConfig;
  }
};

/**
 * Default export for plugin loading
 */
export default headInjectPlugin;

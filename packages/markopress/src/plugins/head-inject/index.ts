import type { MarkoPressPlugin } from '../../plugin/types.js';
import type { ResolvedConfig } from '../../config/index.js';
import type { HeadTag as ConfigHeadTag } from '../../config/types.js';
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
 * Convert config.SiteConfig.head format to plugin HeadTag format
 * Config format: [string, Record<string, string>][]
 * Plugin format: HeadTag[] (typed objects)
 */
function convertConfigHeadToPluginHead(configHead: ConfigHeadTag[]): HeadTag[] {
  return configHead.map((tag) => {
    // Each tag is [tagName, attributesObject]
    const tagType = tag[0];
    const attrs = tag[1] as Record<string, string>;

    // Validate structure
    if (typeof tagType !== 'string' || !attrs || typeof attrs !== 'object') {
      throw new Error(`[head-inject] Invalid head tag format: ${JSON.stringify(tag)}`);
    }

    const baseAttrs = {
      position: attrs.position as 'top' | 'bottom' | undefined,
    };

    switch (tagType) {
      case 'meta': {
        return {
          type: 'meta',
          name: attrs.name,
          property: attrs.property,
          httpEquiv: attrs['http-equiv'],
          content: attrs.content as string,
          charset: attrs.charset,
          ...baseAttrs,
        } as HeadTag;
      }
      case 'link': {
        return {
          type: 'link',
          rel: attrs.rel as string,
          href: attrs.href as string,
          as: attrs.as,
          mimeType: attrs.type as string | undefined,
          media: attrs.media,
          sizes: attrs.sizes,
          crossorigin: attrs.crossorigin as 'anonymous' | 'use-credentials' | undefined,
          integrity: attrs.integrity,
          disabled: attrs.disabled ? (attrs.disabled as unknown === 'true' ? true : attrs.disabled as unknown === true) : undefined,
          title: attrs.title,
          ...baseAttrs,
        } as HeadTag;
      }
      case 'script': {
        return {
          type: 'script',
          src: attrs.src as string | undefined,
          async: attrs.async ? (attrs.async as unknown === 'true' ? true : attrs.async as unknown === true) : undefined,
          defer: attrs.defer ? (attrs.defer as unknown === 'true' ? true : attrs.defer as unknown === true) : undefined,
          scriptType: attrs.type as string | undefined,
          crossorigin: attrs.crossorigin as 'anonymous' | 'use-credentials' | undefined,
          integrity: attrs.integrity,
          nonce: attrs.nonce,
          ...baseAttrs,
        } as HeadTag;
      }
      case 'base': {
        return {
          type: 'base',
          href: attrs.href as string,
          target: attrs.target as '_blank' | '_self' | '_parent' | '_top' | undefined,
          ...baseAttrs,
        } as HeadTag;
      }
      default:
        throw new Error(`[head-inject] Unknown tag type '${tagType}' in config.site.head`);
    }
  });
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
 *   plugins: ['head-inject'],
 *   site: {
 *     head: [
 *       ['meta', { name: 'og:title', content: 'My Site' }],
 *       ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }]
 *     ]
 *   }
 * })
 */
export function headInjectPlugin(options?: HeadInjectPluginOptions): MarkoPressPlugin {
  const opts = { enabled: true, ...options };

  // Store transformed head tags globally
  let globalHeadTop: any[] = [];
  let globalHeadBottom: any[] = [];

  return {
    name: 'head-inject',

    /**
     * Config hook: Read and process config.site.head
     * Called during plugin loading, before content processing
     */
    config(config: ResolvedConfig): ResolvedConfig {
      if (!opts.enabled) {
        return config;
      }

      // Read head tags from config.site.head
      const configHead = config.site?.head;

      if (!configHead || configHead.length === 0) {
        console.log('[head-inject] No head tags in config.site.head');
        return config;
      }

      try {
        // Convert config format to plugin format
        const pluginHead = convertConfigHeadToPluginHead(configHead);

        // Validate head configuration
        validateHeadConfig(pluginHead);

        // Transform and group head tags by position
        const groupedTags = transformHeadConfig(pluginHead);

        // Store for later access in templates
        globalHeadTop = groupedTags.headTop;
        globalHeadBottom = groupedTags.headBottom;

        console.log(
          `[head-inject] Loaded ${globalHeadTop.length} top tags and ${globalHeadBottom.length} bottom tags from config`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`[head-inject] Invalid head config in config.site.head: ${errorMsg}`);
        // Clear arrays on error to prevent rendering invalid tags
        globalHeadTop = [];
        globalHeadBottom = [];
      }

      return config;
    },

    /**
     * Enhance content modules with head metadata
     * Also injects global head tags into each file for handler access
     */
    async enhanceModules(modules: any[]) {
      if (!opts.enabled) {
        return;
      }

      for (const module of modules) {
        // Process each file in the module
        for (const file of module.files) {
          // Add global head tags from config
          file.globalHeadTop = globalHeadTop;
          file.globalHeadBottom = globalHeadBottom;

          // Process file-specific head from frontmatter
          const headData = file.processed?.frontmatter?.head;

          // Skip if no head data
          if (!headData) {
            continue;
          }

          // Validate head configuration
          try {
            validateHeadConfig(headData);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.warn(
              `[head-inject] Invalid head config in ${file.id || module.id}: ${errorMsg}`
            );
            // Mark as invalid to skip rendering
            file.headInvalid = true;
            file.headError = errorMsg;
            continue;
          }

          // Transform and group head tags by position
          const groupedTags = transformHeadConfig(headData);

          // Store grouped tags in file metadata for handler to access
          file.headTop = groupedTags.headTop;
          file.headBottom = groupedTags.headBottom;
        }
      }
    },
  };
}

/**
 * Default export for plugin loading
 */
export default headInjectPlugin;

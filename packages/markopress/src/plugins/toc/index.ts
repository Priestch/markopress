/**
 * TOC Plugin for MarkoPress
 *
 * Generates table of contents from markdown headers
 * Works with any content module dynamically
 */

import type { MarkoPressPlugin } from '../../plugin/types.js';
import type { ContentModule } from '../../content/registry.js';
import type { ProcessedMarkdown } from '../../markdown/types.js';

export interface TocOptions {
  /**
   * Target module(s) to generate TOC for
   * Can be a single module ID (e.g., 'docs', 'guides') or an array of IDs
   * If not specified, works with all available modules
   */
  module?: string | string[];

  /**
   * Minimum header level to include
   * @default 2
   */
  minDepth?: number;

  /**
   * Maximum header level to include
   * @default 3
   */
  maxDepth?: number;
}

export interface TocItem {
  slug: string;
  title: string;
  level: number;
  children?: TocItem[];
}

/**
 * Create TOC plugin
 * Supports dynamic module targeting via the `module` option
 * If no module is specified, works with all available modules
 */
export default function tocPlugin(options: TocOptions = {}): MarkoPressPlugin {
  const { minDepth = 2, maxDepth = 3, module: targetModule } = options;

  const pluginConfig: MarkoPressPlugin = {
    name: 'toc',

    async enhanceModules(modules: ContentModule[]) {
      modules.forEach((module: any) => {
        // Check if this module has TOC extraction enabled via config
        // TOC is only extracted if explicitly enabled (toc: true)
        const extractToc = module.getEnhancement?.('extractToc');

        if (extractToc !== true) {
          return; // Skip TOC generation unless explicitly enabled
        }

        // Create a Map to store TOC for each file
        const tocMap = new Map<string, TocItem[]>();

        module.files.forEach((file: any) => {
          const toc = buildTocFromHeaders(
            file.processed.headers,
            minDepth,
            maxDepth
          );
          tocMap.set(file.urlPath, toc);
        });

        // Add the TOC map as an enhancement
        module.enhance('toc', tocMap);
      });
    },
  };

  // If specific modules are requested, set them
  // Otherwise, let it work with all modules by not setting the `modules` property
  if (targetModule) {
    pluginConfig.modules = Array.isArray(targetModule) ? targetModule : [targetModule];
  }

  return pluginConfig;
}

/**
 * Build TOC from markdown headers
 * Returns a hierarchical structure with nested children
 * Handles nested tree structure by recursively filtering by depth
 */
function buildTocFromHeaders(
  headers: ProcessedMarkdown['headers'],
  minDepth: number,
  maxDepth: number
): TocItem[] {
  if (!headers || headers.length === 0) {
    return [];
  }

  const result: TocItem[] = [];

  for (const header of headers) {
    // If this header is within the depth range, include it
    if (header.level >= minDepth && header.level <= maxDepth) {
      const item: TocItem = {
        slug: header.slug,
        title: header.title,
        level: header.level,
      };

      // Recursively process children
      if (header.children && header.children.length > 0) {
        const childItems = buildTocFromHeaders(header.children, minDepth, maxDepth);
        if (childItems.length > 0) {
          item.children = childItems;
        }
      }

      result.push(item);
    } else {
      // Header is outside range, but its children might be within range
      if (header.children && header.children.length > 0) {
        const childItems = buildTocFromHeaders(header.children, minDepth, maxDepth);
        result.push(...childItems);
      }
    }
  }

  return result;
}

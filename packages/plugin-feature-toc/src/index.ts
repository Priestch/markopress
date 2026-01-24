/**
 * TOC Plugin for MarkoPress
 *
 * Generates table of contents from markdown headers
 * Works with any content module dynamically
 */

import type { MarkoPressPlugin } from 'markopress/plugin';
import type { ContentModule } from 'markopress/content';
import type { ProcessedMarkdown } from 'markopress/markdown';

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
  id: string;
  text: string;
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
    name: '@markopress/plugin-feature-toc',

    async enhanceModules(modules: ContentModule[]) {
      modules.forEach(module => {
        // Create a Map to store TOC for each file
        const tocMap = new Map<string, TocItem[]>();

        module.files.forEach(file => {
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
 */
function buildTocFromHeaders(
  headers: ProcessedMarkdown['headers'],
  minDepth: number,
  maxDepth: number
): TocItem[] {
  // Filter headers by depth
  const filteredHeaders = headers.filter(h => h.level >= minDepth && h.level <= maxDepth);

  if (filteredHeaders.length === 0) {
    return [];
  }

  // Build hierarchical structure
  const result: TocItem[] = [];
  const stack: TocItem[] = [];

  for (const header of filteredHeaders) {
    const item: TocItem = {
      id: header.id,
      text: header.title,
      level: header.level,
    };

    // Pop items from stack until we find the parent level
    while (stack.length > 0 && stack[stack.length - 1].level >= header.level) {
      stack.pop();
    }

    // If stack is empty, add to root
    if (stack.length === 0) {
      result.push(item);
    } else {
      // Add as child of parent
      const parent = stack[stack.length - 1];
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(item);
    }

    // Push current item to stack
    stack.push(item);
  }

  return result;
}

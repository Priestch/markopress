/**
 * TOC Plugin for MarkoPress
 *
 * Generates table of contents from markdown headers
 */

import type { MarkoPressPlugin } from 'markopress/plugin';
import type { ContentModule } from 'markopress/content';
import type { ProcessedMarkdown } from 'markopress/markdown';

export interface TocOptions {
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
 */
export default function tocPlugin(options: TocOptions = {}): MarkoPressPlugin {
  const { minDepth = 2, maxDepth = 3 } = options;

  return {
    name: '@markopress/plugin-feature-toc',
    modules: ['docs', 'pages', 'blog'],

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

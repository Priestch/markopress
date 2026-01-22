/**
 * Vite plugin for MarkoPress - transforms Markdown to virtual Marko components
 */

import type { Plugin } from 'vite';
import type { ResolvedConfig } from '../config/index.js';
import { parseMarkdown } from '../markdown/index.js';

interface MarkoPressVitePluginOptions {
  config: ResolvedConfig;
}

const MARKDOWN_REGEX = /\.md$/;
const MARKO_VIRTUAL_PREFIX = '/@markopress/';

/**
 * Create Vite plugin for MarkoPress
 */
export function markoPressVitePlugin(options: MarkoPressVitePluginOptions): Plugin {
  const { config } = options;
  const markdownCache = new Map<string, string>();

  return {
    name: 'markopress:markdown',

    // Transform markdown files to virtual Marko components
    async transform(code, id) {
      if (!MARKDOWN_REGEX.test(id)) {
        return null;
      }

      // Skip files in node_modules
      if (id.includes('node_modules')) {
        return null;
      }

      // Check if file is in content directories
      const contentDirs = Object.values(config.content).filter((dir): dir is string => typeof dir === 'string');
      const isInContent = contentDirs.some((dir) => id.includes(dir));

      if (!isInContent) {
        return null;
      }

      try {
        // Parse markdown
        const processed = await parseMarkdown(
          code,
          config.markdown,
          { path: id, relativePath: id.replace(config.root, '') }
        );

        // Generate virtual Marko component code
        const virtualCode = generateVirtualMarkoComponent(processed, id);

        // Cache for HMR
        markdownCache.set(id, virtualCode);

        return {
          code: virtualCode,
          map: null,
        };
      } catch (error) {
        console.error(`Failed to transform markdown: ${id}`, error);
        return null;
      }
    },

    // Handle hot module replacement
    handleHotUpdate({ file }) {
      if (!MARKDOWN_REGEX.test(file)) {
        return;
      }

      // Invalidate cache
      markdownCache.delete(file);
    },
  };
}

/**
 * Generate virtual Marko component code from processed markdown
 */
function generateVirtualMarkoComponent(processed: any, filePath: string): string {
  const { frontmatter, html, headers, excerpt } = processed;

  // Create a virtual Marko component that renders the markdown
  return `
<marko-press-markdown
  frontmatter=${JSON.stringify(frontmatter)}
  html=${JSON.stringify(html)}
  headers=${JSON.stringify(headers)}
  excerpt=${JSON.stringify(excerpt)}
  filePath="${filePath}"
/>
`.trim();
}

/**
 * Resolve virtual module imports
 */
export function markoPressVirtualModulePlugin(): Plugin {
  return {
    name: 'markopress:virtual-modules',

    resolveId(id) {
      if (id.startsWith(MARKO_VIRTUAL_PREFIX)) {
        return id;
      }
      return null;
    },

    load(id) {
      if (id.startsWith(MARKO_VIRTUAL_PREFIX)) {
        // Return virtual module content
        return `export default {}`;
      }
      return null;
    },
  };
}

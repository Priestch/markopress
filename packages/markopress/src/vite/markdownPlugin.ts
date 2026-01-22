/**
 * Vite plugin for MarkoPress - transforms .md files to virtual Marko components
 * Based on VitePress architecture
 */

import type { Plugin } from 'vite';
import type { ResolvedConfig } from '../config/index.js';
import { parseMarkdown } from '../markdown/index.js';

const MARKDOWN_REGEX = /\.md$/;
const MARKDOWN_ID_PREFIX = '@markopress/markdown:';

/**
 * Create Vite plugin for transforming markdown to Marko
 */
export function createMarkdownPlugin(config: ResolvedConfig): Plugin {
  const markdownCache = new Map<string, any>();

  return {
    name: 'markopress:markdown',

    // Resolve markdown files to virtual modules
    resolveId(id) {
      if (id.startsWith(MARKDOWN_ID_PREFIX)) {
        return id;
      }
      return null;
    },

    // Load virtual markdown modules
    async load(id) {
      if (!id.startsWith(MARKDOWN_ID_PREFIX)) {
        return null;
      }

      // Extract the actual file path
      const filePath = id.slice(MARKDOWN_ID_PREFIX.length);

      try {
        // Read the markdown file
        const fs = await import('node:fs/promises');
        const content = await fs.readFile(filePath, 'utf-8');

        // Parse the markdown
        const processed = await parseMarkdown(content, config.markdown, {
          path: filePath,
          relativePath: filePath.replace(config.root, ''),
        });

        // Generate Marko component code
        const markoCode = generateMarkoComponent(processed, filePath);

        return markoCode;
      } catch (error) {
        console.error(`Failed to load markdown: ${filePath}`, error);
        return null;
      }
    },

    // Transform .md files to virtual module imports
    async transform(code, id) {
      if (!MARKDOWN_REGEX.test(id)) {
        return null;
      }

      // Skip node_modules
      if (id.includes('node_modules')) {
        return null;
      }

      // Check if file is in content directories
      const contentDirs = Object.values(config.content).filter((dir): dir is string => typeof dir === 'string');
      const isInContent = contentDirs.some((dir) => id.includes(dir));

      if (!isInContent) {
        return null;
      }

      // Return import statement to virtual module
      const virtualId = `${MARKDOWN_ID_PREFIX}${id}`;
      return `export { default } from '${virtualId}';`;
    },

    // Handle HMR
    handleHotUpdate({ file, modules }) {
      if (!MARKDOWN_REGEX.test(file)) {
        return;
      }

      // Invalidate cache
      markdownCache.delete(file);

      // Trigger HMR for dependent modules
      this.info(`[markopress] hot updated: ${file}`);
    },
  };
}

/**
 * Generate Marko component code from processed markdown
 */
function generateMarkoComponent(processed: any, filePath: string): string {
  const { frontmatter, headers, excerpt } = processed;

  return `
<marko-press-page>
  <class {
    onCreate() {
      this.frontmatter = ${JSON.stringify(frontmatter)};
      this.headers = ${JSON.stringify(headers)};
      this.excerpt = ${JSON.stringify(excerpt || '')};
    }
  }>
  <${processed.html}>
</marko-press-page>
`.trim();
}

/**
 * Create server middleware for markdown handling
 */
export function createMarkdownMiddleware(config: ResolvedConfig) {
  return async (req: any, res: any, next: any) => {
    const url = req.url;

    // Check if this is a markdown route
    if (url?.endsWith('.md')) {
      // Convert to .html route
      const htmlUrl = url.replace(/\.md$/, '.html');
      req.url = htmlUrl;
    }

    next();
  };
}

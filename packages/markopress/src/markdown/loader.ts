/**
 * Markdown loader with frontmatter parsing
 */

import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import mdAnchor from 'markdown-it-anchor';
import mdAttrs from 'markdown-it-attrs';
import * as mdEmoji from 'markdown-it-emoji';
import { createHighlighter } from 'shiki';
import { setupContainers, setupDetails } from './containers.js';
import { createEnhancedHighlighter } from './code.js';
import { preprocessIncludesWithRegions } from './includes.js';
import type { MarkdownOptions, ProcessedMarkdown, Header, MarkdownEnv } from './types.js';

// Cache highlighter instance
let highlighterInstance: Awaited<ReturnType<typeof createHighlighter>> | null = null;

/**
 * Get or create Shiki highlighter with all bundled languages
 */
async function getHighlighterInstance() {
  if (!highlighterInstance) {
    // Load all bundled languages from Shiki
    // This avoids errors from unsupported language names
    const { bundledLanguages, bundledLanguagesInfo } = await import('shiki/langs');

    // Extract language names from bundled languages
    const langNames = Object.keys(bundledLanguages);

    highlighterInstance = await createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: langNames,
    });
  }
  return highlighterInstance;
}

/**
 * Parse markdown with frontmatter
 */
export async function parseMarkdown(
  src: string,
  options: MarkdownOptions = {},
  env: MarkdownEnv = {}
): Promise<ProcessedMarkdown> {
  // Parse frontmatter
  const { data: frontmatter, content: rawContent, excerpt } = matter(src, {
    excerpt: true,
    excerpt_separator: '<!-- more -->',
  });

  // Preprocess file includes
  const content = await preprocessIncludesWithRegions(rawContent, {
    root: env.rootDir ?? process.cwd(),
    currentFile: env.filePath ?? '',
  });

  // Setup markdown-it with Shiki
  const md = await setupMarkdownIt(options);

  // Render to HTML
  const html = md.render(content, env);

  // Extract headers
  const headers = extractHeaders(content);

  return {
    frontmatter,
    content,
    html,
    excerpt,
    headers: buildHeaderTree(headers),
  };
}

/**
 * Setup markdown-it with plugins and Shiki highlighting
 */
async function setupMarkdownIt(options: MarkdownOptions): Promise<MarkdownIt> {
  const highlighter = await getHighlighterInstance();

  // Create enhanced highlighter with line features
  const enhancedHighlight = createEnhancedHighlighter(highlighter, {
    lineNumbers: options.lineNumbers ?? true,
  });

  const md = new MarkdownIt({
    html: true, // Allow HTML in markdown (authors are trusted in SSG context)
    linkify: true,
    typographer: true,
    highlight: (code, lang, attrs) => {
      if (!lang) {
        return ''; // Use default escaping
      }
      try {
        // attrs contains the meta string (e.g., "{4}" or "title='file.js'")
        return enhancedHighlight(code, lang, attrs);
      } catch (e) {
        // Fallback for unsupported languages
        return '';
      }
    },
  });

  // Add plugins
  md.use(mdAnchor, {
    permalink: mdAnchor.permalink.linkInsideHeader({
      symbol: '#',
      placement: 'before',
    }),
  });
  md.use(mdAttrs);
  md.use(mdEmoji.full || mdEmoji.bare);

  // Add custom containers (tip, warning, danger, info, note)
  setupContainers(md);

  // Add collapsible details container
  setupDetails(md);

  return md;
}

/**
 * Extract headers from markdown content
 */
function extractHeaders(content: string): Array<{ level: number; title: string; slug: string }> {
  const headers: Array<{ level: number; title: string; slug: string }> = [];
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;

  while ((match = headerRegex.exec(content)) !== null) {
    const level = match[1].length;
    const title = match[2].trim();
    const slug = slugify(title);
    headers.push({ level, title, slug });
  }

  return headers;
}

/**
 * Build header tree from flat list
 */
function buildHeaderTree(
  headers: Array<{ level: number; title: string; slug: string }>
): Header[] {
  const result: Header[] = [];
  const stack: Header[] = [];

  for (const header of headers) {
    const node: Header = {
      level: header.level,
      title: header.title,
      slug: header.slug,
      children: [],
    };

    // Pop from stack until we find the parent level
    while (stack.length > 0 && stack[stack.length - 1].level >= header.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      result.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return result;
}

/**
 * Slugify text for URL-safe IDs
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

/**
 * Validate frontmatter against VitePress/Docusaurus schema
 */
export function validateFrontmatter(
  frontmatter: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Common fields
  if (frontmatter.title !== undefined && typeof frontmatter.title !== 'string') {
    errors.push('title must be a string');
  }

  if (frontmatter.description !== undefined && typeof frontmatter.description !== 'string') {
    errors.push('description must be a string');
  }

  if (frontmatter.draft !== undefined && typeof frontmatter.draft !== 'boolean') {
    errors.push('draft must be a boolean');
  }

  // Date fields
  if (frontmatter.date !== undefined) {
    if (!(typeof frontmatter.date === 'string' || frontmatter.date instanceof Date)) {
      errors.push('date must be a string or Date');
    }
  }

  // Tags/categories
  if (frontmatter.tags !== undefined && !Array.isArray(frontmatter.tags)) {
    errors.push('tags must be an array');
  }

  if (frontmatter.categories !== undefined && !Array.isArray(frontmatter.categories)) {
    errors.push('categories must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

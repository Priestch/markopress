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
import { preserveTagsPlugin } from './preserve-tags.js';
import { globalTagValidator } from './tag-validator.js';
import type { MarkdownOptions, ProcessedMarkdown, Header, MarkdownEnv } from './types.js';

// Cache highlighter instance
let highlighterInstance: Awaited<ReturnType<typeof createHighlighter>> | null = null;

/**
 * Common languages that cover most use cases
 * Loading all 300+ languages adds ~5 seconds to build time
 */
const COMMON_LANGUAGES = [
  'javascript',
  'typescript',
  'js',
  'ts',
  'jsx',
  'tsx',
  'python',
  'py',
  'rust',
  'rs',
  'go',
  'java',
  'c',
  'cpp',
  'cs',
  'csharp',
  'php',
  'ruby',
  'rb',
  'bash',
  'sh',
  'shell',
  'html',
  'css',
  'scss',
  'json',
  'yaml',
  'yml',
  'toml',
  'markdown',
  'md',
  'sql',
  'dart',
  'kotlin',
  'swift',
  'xml',
  'vue',
  'svelte',
] as const;

/**
 * Get or create Shiki highlighter
 */
async function getHighlighterInstance(
  languages?: 'common' | 'all' | readonly string[]
): Promise<Awaited<ReturnType<typeof createHighlighter>>> {
  if (!highlighterInstance) {
    let langs: readonly string[];

    if (languages === 'all') {
      // Load all bundled languages (slow!)
      const { bundledLanguages } = await import('shiki/langs');
      langs = Object.keys(bundledLanguages);
    } else if (Array.isArray(languages)) {
      // Custom language list
      langs = languages;
    } else {
      // Default to common languages (fast)
      langs = Array.from(COMMON_LANGUAGES);
    }

    highlighterInstance = await createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: Array.from(langs),
    });
  }
  return highlighterInstance;
}

/**
 * Get or create a shared MarkdownIt instance
 * This allows reusing the same instance across multiple parseMarkdown calls
 *
 * @param options - Markdown parsing options
 * @param env - Markdown environment context
 * @returns Configured MarkdownIt instance
 */
export async function getMarkdownIt(
  options: MarkdownOptions = {},
  env: MarkdownEnv = {}
): Promise<MarkdownIt> {
  const highlighter = await getHighlighterInstance(options.highlightLanguages);

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
        // attrs contains a meta string (e.g., "{4}" or "title='file.js'")
        return enhancedHighlight(code, lang, attrs);
      } catch (e) {
        // Fallback for unsupported languages
        return '';
      }
    },
  });

  // Add plugins
  md.use(mdAnchor, {
    slugify: slugify,
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

  // Add preserve Marko tags plugin if enabled
  if (options.markoTags?.enabled) {
    md.use(preserveTagsPlugin, {
      tagsDir: options.markoTags?.tagsDir || 'tags/',
      onTagDetected: (tagName: string, lineNumber: number) => {
        // Track tag for validation at end of build
        globalTagValidator.addDetectedTag(
          tagName,
          env.filePath || 'unknown',
          lineNumber
        );
      },
    });
  }

  return md;
}

/**
 * Parse markdown with frontmatter
 */
export async function parseMarkdown(
  src: string,
  options: MarkdownOptions = {},
  env: MarkdownEnv = {},
  existingMd?: MarkdownIt
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

  // Use provided MarkdownIt or create new one
  const md = existingMd || await setupMarkdownIt(options, env);

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
 * @deprecated Use getMarkdownIt() directly for better reusability
 */
async function setupMarkdownIt(options: MarkdownOptions, env: MarkdownEnv): Promise<MarkdownIt> {
  return getMarkdownIt(options, env);
}

/**
 * Strip markdown formatting from text for cleaner TOC entries
 * Removes bold, italic, code, links, and other inline markdown
 */
function stripMarkdownFormatting(text: string): string {
  return text
    // Remove inline code: `code`
    .replace(/`([^`]+)`/g, '$1')
    // Remove bold/italic: **text**, __text__, *text*, _text_
    .replace(/\*\*\*\+([^*]+)\*\*\+/g, '$1')
    .replace(/___+([^_]+)___+/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove links: [text](url) or [text](url "title")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]+\]/g, '$1')
    .trim();
}

/**
 * Extract headers from markdown content
 * Skips code blocks (fenced and indented) to avoid extracting comments from code examples
 */
function extractHeaders(content: string): Array<{ level: number; title: string; slug: string }> {
  const headers: Array<{ level: number; title: string; slug: string }> = [];

  // Remove code blocks before processing headers
  // This prevents extracting # comments from bash/code examples
  const withoutCodeBlocks = content
    .replace(/```[\s\S]*?```/g, '') // Fenced code blocks
    .replace(/~~~[\s\S]*?~~~/g, '') // Tilde-fenced code blocks
    .replace(/^(\t| {4}).+$/gm, ''); // Indented code blocks

  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;

  while ((match = headerRegex.exec(withoutCodeBlocks)) !== null) {
    const level = match[1].length;
    const rawTitle = match[2].trim();
    const title = stripMarkdownFormatting(rawTitle);
    const slug = slugify(rawTitle); // Use raw title for slug to preserve numbering
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

    // Pop from stack until we find parent level
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
 * Preserves emojis (URL-safe) and text, removes special chars
 * Handles camelCase by inserting hyphens at word boundaries
 */
function slugify(text: string): string {
  return text
    .trim()
    // Insert hyphens between lowercase-to-uppercase transitions (camelCase)
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    // Insert hyphens between digit-to-letter transitions
    .replace(/([0-9])([a-zA-Z])/g, '$1-$2')
    // Insert hyphens between letter-to-digit transitions
    .replace(/([a-zA-Z])([0-9])/g, '$1-$2')
    .toLowerCase()
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Remove special chars but keep letters, numbers, hyphens, and emojis
    // Emojis are in Unicode ranges outside \w (word chars)
    .replace(/[^\w\u00A0-\uFFFF\-]+/g, '')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Replace multiple hyphens with single
    .replace(/-+/g, '-');
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

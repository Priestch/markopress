/**
 * Request-time markdown renderer
 * Lazy-loads MarkdownIt + Shiki on first use
 * Used by route handlers to render markdown on demand
 */

import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import { getMarkdownIt } from './loader.js';
import type { MarkdownOptions, ProcessedMarkdown, Header } from './types.js';
import { resolveImageTagsInHtml } from '../image/tag.js';

/**
 * Cached MarkdownIt instance (lazy-loaded on first use)
 */
let mdInstance: MarkdownIt | null = null;
let mdOptions: MarkdownOptions | undefined;

/**
 * Render markdown source to HTML at request time
 *
 * This function lazy-loads MarkdownIt + Shiki on first call,
 * then reuses the instance for subsequent renders.
 *
 * @param source - Raw markdown source with frontmatter
 * @param options - Markdown parsing options (only used on first call)
 * @returns Processed markdown with frontmatter, HTML, and headers
 */
export async function renderMarkdown(
  source: string,
  options?: MarkdownOptions
): Promise<ProcessedMarkdown> {
  // Lazy init MarkdownIt (one-time cost)
  if (!mdInstance) {
    // Always enable markoTags for component support
    const opts = {
      ...options,
      markoTags: {
        enabled: true,
        ...options?.markoTags
      }
    };
    mdInstance = await getMarkdownIt(opts);
    mdOptions = opts;
  }

  // Parse frontmatter
  const { data: frontmatter, content: rawContent, excerpt } = matter(source, {
    excerpt: true,
    excerpt_separator: '<!-- more -->',
  });

  // Render markdown to HTML
  const html = await resolveImageTagsInHtml(mdInstance.render(rawContent));

  // Extract headers for TOC
  const headers = extractHeaders(rawContent);

  return {
    frontmatter,
    content: rawContent,
    html,
    excerpt,
    headers: buildHeaderTree(headers),
  };
}

/**
 * Reset the cached MarkdownIt instance
 * Useful for testing or when options change
 */
export function resetRendererCache(): void {
  mdInstance = null;
  mdOptions = undefined;
}

/**
 * Get the current MarkdownIt instance if initialized
 */
export function getRendererInstance(): MarkdownIt | null {
  return mdInstance;
}

/**
 * Strip markdown formatting from text for cleaner TOC entries
 */
function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*\*\+([^*]+)\*\*\+/g, '$1')
    .replace(/___+([^_]+)___+/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]+\]/g, '$1')
    .trim();
}

/**
 * Extract headers from markdown content
 */
function extractHeaders(content: string): Array<{ level: number; title: string; slug: string }> {
  const headers: Array<{ level: number; title: string; slug: string }> = [];
  const withoutCodeBlocks = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/^(\t| {4}).+$/gm, '');

  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;

  while ((match = headerRegex.exec(withoutCodeBlocks)) !== null) {
    const level = match[1].length;
    const rawTitle = match[2].trim();
    const title = stripMarkdownFormatting(rawTitle);
    const slug = slugify(rawTitle);
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
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([0-9])([a-zA-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])([0-9])/g, '$1-$2')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u00A0-\uFFFF\-]+/g, '')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

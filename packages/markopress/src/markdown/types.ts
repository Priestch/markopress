/**
 * Markdown processing types
 */

export interface MarkdownOptions {
  lineNumbers?: boolean;
  theme?: {
    light?: string;
    dark?: string;
  };

  /**
   * Additional languages to preload for syntax highlighting.
   */
  languages?: string[];

  /**
   * Marko tags support
   */
  markoTags?: {
    /** Enable Marko tags in markdown (default: false) */
    enabled?: boolean;

    /** Directory containing Marko component files (default: 'tags/') */
    tagsDir?: string;
  };

  /** Base path for link rewriting (e.g., '/markopress'). Links are rewritten only when this is non-root. */
  base?: string;
}

export interface MarkdownProcessor {
  process(src: string, filePath?: string): Promise<ProcessedMarkdown>;
}

export interface ProcessedMarkdown {
  frontmatter: Record<string, unknown>;
  content: string;
  html: string;
  headers: Header[];
  excerpt?: string;
}

export interface Header {
  level: number;
  title: string;
  slug: string;
  children: Header[];
}

export interface MarkdownEnv {
  path?: string;
  relativePath?: string;
  rootDir?: string;
  filePath?: string;
  /** Enable TOC extraction for this file (default: false) */
  extractToc?: boolean;
}

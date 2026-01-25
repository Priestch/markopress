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
   * Syntax highlighting languages to load.
   * - 'common': Load 38 common languages (default, faster)
   * - 'all': Load all 300+ languages (slower, ~5s)
   * - string[]: Custom list of language names
   */
  highlightLanguages?: 'common' | 'all' | readonly string[];

  /**
   * Marko tags support
   */
  markoTags?: {
    /** Enable Marko tags in markdown (default: false) */
    enabled?: boolean;

    /** Directory containing Marko component files (default: 'tags/') */
    tagsDir?: string;
  };
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
}

/**
 * Markdown processing types
 */

export interface MarkdownOptions {
  lineNumbers?: boolean;
  theme?: {
    light?: string;
    dark?: string;
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
}

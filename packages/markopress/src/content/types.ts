/**
 * Content system types
 */

import type { ProcessedMarkdown } from '../markdown/index.js';

/**
 * Content file type
 */
export type ContentType = 'page' | 'doc' | 'blog';

/**
 * Content file metadata
 */
export interface ContentFile {
  id: string;
  filePath: string;
  relativePath: string;
  type: ContentType;
  urlPath: string;
  processed: ProcessedMarkdown;
}

/**
 * Content scanner options
 */
export interface ContentScannerOptions {
  dirs: {
    pages?: string;
    docs?: string;
    blog?: string;
  };
  rootDir: string;
  markdownOptions?: import('../markdown/types.js').MarkdownOptions;
}

/**
 * Content manifest
 */
export interface ContentManifest {
  pages: ContentFile[];
  docs: ContentFile[];
  blog: ContentFile[];
  all: ContentFile[];
}

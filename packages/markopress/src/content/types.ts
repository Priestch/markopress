/**
 * Content system types
 */

import type { ProcessedMarkdown } from '../markdown/index.js';
import type { ModuleOptions } from '../config/types.js';

/**
 * Content file type - generic string to support any module ID
 */
export type ContentType = string;

/**
 * Content file classification for UI/layout purposes
 */
export type ContentFileType = 'page' | 'doc' | 'blog' | 'custom';

/**
 * Content file metadata
 */
export interface ContentFile {
  id: string;
  filePath: string;
  relativePath: string;
  type?: ContentFileType;
  moduleId: string;       // The actual module ID (dynamic)
  urlPath: string;
  processed: ProcessedMarkdown;
}

/**
 * Content scanner options
 * Supports both simple string paths and extended module options
 */
export interface ContentScannerOptions {
  dirs: Record<string, string | ModuleOptions | undefined>;  // Dynamic module ID -> directory/options mapping
  rootDir: string;
  markdownOptions?: import('../markdown/types.js').MarkdownOptions;
}

/**
 * Content manifest - dynamic module-based structure
 * Each key is a module ID pointing to its content files
 */
export interface ContentManifest extends Record<string, ContentFile[]> {
  // No special keys - all keys are module IDs
}

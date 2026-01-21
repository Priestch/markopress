/**
 * Content Module system
 *
 * Modules represent collections of content that can be enhanced by plugins.
 * Multiple plugins can enhance the same module, enabling composability.
 */

import type { ContentFile } from './types.js';

/**
 * Module types supported by MarkoPress
 */
export type ModuleType = 'collection' | 'api' | 'custom';

/**
 * Module metadata
 */
export interface ModuleMetadata {
  title: string;
  description?: string;
  icon?: string;
  order?: number;
}

/**
 * Content Module - a collection of related content with plugin enhancements
 */
export interface ContentModule {
  /** Unique module identifier (e.g., 'pages', 'docs', 'blog') */
  id: string;

  /** Source directory path (e.g., 'content/docs') */
  source: string;

  /** Module type */
  type: ModuleType;

  /** All content files in this module */
  files: ContentFile[];

  /** Module metadata */
  metadata: ModuleMetadata;

  /** Plugin-added enhancements (key -> data) */
  enhancements: Map<string, unknown>;

  /**
   * Add an enhancement to this module
   * @param key - Enhancement key (e.g., 'sidenav', 'toc')
   * @param data - Enhancement data
   */
  enhance(key: string, data: unknown): void;

  /**
   * Get enhancement data from this module
   * @param key - Enhancement key
   * @returns Enhancement data or undefined if not found
   */
  getEnhancement<T>(key: string): T | undefined;
}

/**
 * Create a new ContentModule instance
 */
export function createContentModule(
  id: string,
  source: string,
  type: ModuleType,
  files: ContentFile[],
  metadata: ModuleMetadata
): ContentModule {
  const enhancements = new Map<string, unknown>();

  return {
    id,
    source,
    type,
    files,
    metadata,
    enhancements,

    enhance(key: string, data: unknown): void {
      enhancements.set(key, data);
    },

    getEnhancement<T>(key: string): T | undefined {
      return enhancements.get(key) as T | undefined;
    },
  };
}

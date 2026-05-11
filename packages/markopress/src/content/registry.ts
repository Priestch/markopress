/**
 * Content module types used by the plugin system.
 *
 * The ContentRegistry class was removed — at runtime, registry data is a plain
 * Record<string, ContentItem[]> produced by the build pipeline and written to
 * .generated/content-registry.{js,json}.
 */

import type { ContentItem } from './source.js';

/** Query filter for the registry (for future server-side query API) */
export interface ContentQuery {
  moduleId?: string;
  limit?: number;
  sort?: 'date-asc' | 'date-desc';
}

/**
 * Content module passed to plugins during enhanceModules hook.
 * Represents a content section (blog, docs, etc.) with its files and enhancement API.
 */
export interface ContentModule {
  id: string;
  dir: string;
  config: Record<string, unknown>;
  features: Record<string, unknown>;
  files: ContentModuleFile[];
  enhance(key: string, data: unknown): void;
  getEnhancement<T = unknown>(key: string): T | undefined;
  _enhancements: Map<string, unknown>;
}

/**
 * File within a content module.
 * Shape matches what the build pipeline creates at build/index.ts.
 */
export interface ContentModuleFile {
  id: string;
  slug: string;
  filePath: string;
  urlPath: string;
  directory: string;
  processed: {
    frontmatter: Record<string, unknown>;
    [key: string]: unknown;
  };
}

/** Registry data shape: module ID → array of content items */
export type ContentRegistryData = Record<string, ContentItem[]>;

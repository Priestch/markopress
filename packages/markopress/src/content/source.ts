/**
 * Content source abstraction for the content registry.
 *
 * A ContentSource represents any place content can come from —
 * local filesystem, a remote CMS, an API, etc.
 */

/**
 * A single content item with normalized metadata.
 * Produced by ContentSource.scan() and available to all pages via the registry.
 */
export interface ContentItem {
  id: string;
  moduleId: string; // 'blog', 'docs', 'guides', etc.
  metadata: {
    title?: string;
    description?: string;
    date?: string;
    author?: string;
    excerpt?: string;
    [key: string]: unknown;
  };
  urlPath: string;
}

/**
 * Adapter interface for content sources.
 *
 * - scan() is always called first — returns lightweight metadata for all items.
 * - read() is called lazily when a page needs full content for a specific item.
 */
export interface ContentSource {
  /** Unique identifier for this source (e.g., 'filesystem', 'strapi') */
  readonly id: string;

  /** List all content items with metadata. Called once during build/init. */
  scan(): Promise<ContentItem[]>;

  /** Load full content for a single item. Called on demand. */
  read(id: string): Promise<ContentItem | null>;
}

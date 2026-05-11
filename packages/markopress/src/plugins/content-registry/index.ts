/**
 * Content Registry Plugin for MarkoPress
 *
 * Enables cross-section content access — e.g., showing blog posts on the homepage.
 *
 * The build pipeline constructs registry data (Record<string, ContentItem[]>) from
 * scanned content modules and writes it to .generated/content-registry.{js,json}.
 * Handler templates load it and expose via $global.registry.
 *
 * Usage in templates:
 *   <for|post| of=$global.registry.blog>
 *     <if=post.metadata.date>
 *       <a href=post.urlPath>${post.metadata.title}</a>
 *     </if>
 *   </for>
 *
 * To add a remote CMS source, implement the ContentSource interface and
 * contribute items to the registry via the enhanceModules hook.
 */

import type { MarkoPressPlugin } from '../../plugin/types.js';

export default function contentRegistryPlugin(): MarkoPressPlugin {
  return {
    name: 'content-registry',
  };
}

// Public API for users building custom content sources
export type { ContentItem, ContentSource } from '../../content/source.js';
export type { ContentRegistryData } from '../../content/registry.js';

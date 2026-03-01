/**
 * Head injection plugin types
 * Type-safe definitions for head tags with configurable positioning
 */

export type HeadTag = MetaTag | LinkTag | ScriptTag | BaseTag;

export interface BaseHeadTag {
  /**
   * Position in head element
   * - 'top': renders in <theme-head-top/> slot (early in head)
   * - 'bottom': renders in <theme-head-bottom/> slot (late in head)
   * - undefined: defaults to 'bottom'
   */
  position?: 'top' | 'bottom';
}

// Meta tags: <meta name="..." content="...">
export interface MetaTag extends BaseHeadTag {
  type: 'meta';
  name?: string;
  property?: string;     // For Open Graph (og:*, twitter:card)
  httpEquiv?: string;    // For http-equiv="refresh", etc.
  content?: string;      // Optional - not used for charset-only meta tags
  charset?: string;      // For <meta charset="UTF-8">
}

// Link tags: <link rel="..." href="...">
export interface LinkTag extends BaseHeadTag {
  type: 'link';
  rel: string;
  href: string;
  as?: string;          // For preconnect/prefetch (script, style, font)
  mimeType?: string;    // MIME type (maps to HTML 'type' attribute)
  media?: string;       // Media query
  sizes?: string;       // For icons
  crossorigin?: 'anonymous' | 'use-credentials';
  integrity?: string;   // SRI hash
  disabled?: boolean;
  title?: string;      // For alternate stylesheets
}

// Script tags: <script src="..."> or <script>content</script>
export interface ScriptTag extends BaseHeadTag {
  type: 'script';
  src?: string;         // External script (mutually exclusive with content)
  content?: string;     // Inline script
  async?: boolean;
  defer?: boolean;
  scriptType?: string;  // module, text/javascript, etc. (maps to HTML 'type' attribute)
  crossorigin?: 'anonymous' | 'use-credentials';
  integrity?: string;   // SRI hash
  nonce?: string;       // CSP nonce
  attrs?: Record<string, unknown>; // Custom attributes (e.g., data-*)
}

// Base tag: <base href="...">
export interface BaseTag extends BaseHeadTag {
  type: 'base';
  href: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
}

// Renderable format for Marko templates
// - Self-closing tags: [tagName, attributesObject]
// - Inline content tags: [tagName, attributesObject, bodyContent]
export type RenderableHeadTag =
  | [string, Record<string, unknown>]
  | [string, Record<string, unknown>, string];

// Grouped tags by position
export interface GroupedHeadTags {
  headTop: RenderableHeadTag[];
  headBottom: RenderableHeadTag[];
}

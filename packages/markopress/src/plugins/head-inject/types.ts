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
  content: string;
  charset?: string;      // For <meta charset="UTF-8">
}

// Link tags: <link rel="..." href="...">
export interface LinkTag extends BaseHeadTag {
  type: 'link';
  rel: string;
  href: string;
  as?: string;          // For preconnect/prefetch (script, style, font)
  type?: string;        // MIME type
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
  type?: string;        // module, text/javascript, etc.
  crossorigin?: 'anonymous' | 'use-credentials';
  integrity?: string;   // SRI hash
  nonce?: string;       // CSP nonce
}

// Base tag: <base href="...">
export interface BaseTag extends BaseHeadTag {
  type: 'base';
  href: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
}

// Renderable format for Marko templates: [tagName, attributesObject]
export type RenderableHeadTag = [string, Record<string, unknown>];

// Grouped tags by position
export interface GroupedHeadTags {
  headTop: RenderableHeadTag[];
  headBottom: RenderableHeadTag[];
}

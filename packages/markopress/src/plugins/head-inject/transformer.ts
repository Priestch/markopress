/**
 * Transformer for head tags
 * Converts HeadTag objects to renderable format for Marko templates
 */

import type {
  HeadTag,
  GroupedHeadTags,
  RenderableHeadTag,
  MetaTag,
  LinkTag,
  ScriptTag,
  BaseTag,
} from './types.js';

/**
 * Remove undefined values from an object
 */
export function filterUndefined<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Transform a meta tag to renderable format
 */
function transformMetaTag(tag: MetaTag): RenderableHeadTag {
  const attrs: Record<string, unknown> = filterUndefined({
    charset: tag.charset,
    name: tag.name,
    property: tag.property,
    'http-equiv': tag.httpEquiv,
    content: tag.content,
  });
  return ['meta', attrs];
}

/**
 * Transform a link tag to renderable format
 */
function transformLinkTag(tag: LinkTag): RenderableHeadTag {
  const attrs: Record<string, unknown> = filterUndefined({
    rel: tag.rel,
    href: tag.href,
    as: tag.as,
    type: tag.mimeType, // mimeType maps to HTML 'type' attribute
    media: tag.media,
    sizes: tag.sizes,
    crossorigin: tag.crossorigin,
    integrity: tag.integrity,
    disabled: tag.disabled,
    title: tag.title,
  });
  return ['link', attrs];
}

/**
 * Transform a script tag to renderable format
 */
function transformScriptTag(tag: ScriptTag): RenderableHeadTag {
  const attrs: Record<string, unknown> = filterUndefined({
    src: tag.src,
    async: tag.async,
    defer: tag.defer,
    type: tag.scriptType, // scriptType maps to HTML 'type' attribute
    crossorigin: tag.crossorigin,
    integrity: tag.integrity,
    nonce: tag.nonce,
  });

  // Inline scripts have content
  if (tag.content) {
    return ['script', attrs, tag.content];
  }
  return ['script', attrs];
}

/**
 * Transform a base tag to renderable format
 */
function transformBaseTag(tag: BaseTag): RenderableHeadTag {
  const attrs: Record<string, unknown> = filterUndefined({
    href: tag.href,
    target: tag.target,
  });
  return ['base', attrs];
}

/**
 * Transform a single head tag to renderable format
 */
function transformHeadTag(tag: HeadTag): RenderableHeadTag {
  switch (tag.type) {
    case 'meta':
      return transformMetaTag(tag);
    case 'link':
      return transformLinkTag(tag);
    case 'script':
      return transformScriptTag(tag);
    case 'base':
      return transformBaseTag(tag);
    default:
      // Type safety: exhaustive check (should never happen with valid types)
      throw new Error(`[head-inject] Unknown tag type '${(tag as any).type}'`);
  }
}

/**
 * Transform head configuration to grouped renderable format
 */
export function transformHeadConfig(tags: HeadTag[]): GroupedHeadTags {
  const headTop: RenderableHeadTag[] = [];
  const headBottom: RenderableHeadTag[] = [];

  for (const tag of tags) {
    const renderable = transformHeadTag(tag);

    // Group by position (defaults to 'bottom')
    if (tag.position === 'top') {
      headTop.push(renderable);
    } else {
      headBottom.push(renderable);
    }
  }

  return {
    headTop,
    headBottom,
  };
}

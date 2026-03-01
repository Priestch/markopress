import type { HeadTag, MetaTag, LinkTag, ScriptTag, BaseTag } from './types.js';

class ValidationError extends Error {
  constructor(tagType: string, message: string) {
    super(`[head-inject] ${tagType} tag: ${message}`);
    this.name = 'ValidationError';
  }
}

export function validateHeadTag(tag: HeadTag): void {
  // Validate position
  if (tag.position && !['top', 'bottom'].includes(tag.position)) {
    throw new ValidationError(tag.type, `Invalid position '${tag.position}', must be 'top' or 'bottom'`);
  }

  switch (tag.type) {
    case 'meta':
      validateMetaTag(tag);
      break;
    case 'link':
      validateLinkTag(tag);
      break;
    case 'script':
      validateScriptTag(tag);
      break;
    case 'base':
      validateBaseTag(tag);
      break;
    default:
      throw new ValidationError('unknown', `Unknown tag type '${(tag as any).type}'`);
  }
}

function validateMetaTag(tag: MetaTag): void {
  // Charset is a special case: <meta charset="UTF-8"> doesn't need content
  if (tag.charset) {
    return; // Valid charset tag
  }

  // All other meta tags need content
  if (!tag.content) {
    throw new ValidationError('meta', 'Missing required attribute: content');
  }

  // Must have an identifier (name, property, or httpEquiv)
  const hasIdentifier = tag.name || tag.property || tag.httpEquiv;
  if (!hasIdentifier) {
    throw new ValidationError('meta', 'Must have one of: name, property, or httpEquiv');
  }
}

function validateLinkTag(tag: LinkTag): void {
  if (!tag.rel) {
    throw new ValidationError('link', 'Missing required attribute: rel');
  }
  if (!tag.href) {
    throw new ValidationError('link', 'Missing required attribute: href');
  }
}

function validateScriptTag(tag: ScriptTag): void {
  const hasSrc = tag.src !== undefined;
  const hasContent = tag.content !== undefined;

  if (!hasSrc && !hasContent) {
    throw new ValidationError('script', 'Must have either src or content');
  }
  if (hasSrc && hasContent) {
    throw new ValidationError('script', 'src and content are mutually exclusive');
  }
}

function validateBaseTag(tag: BaseTag): void {
  if (!tag.href) {
    throw new ValidationError('base', 'Missing required attribute: href');
  }
}

export function validateHeadConfig(config: unknown[]): void {
  // Check for old array format
  if (config.length > 0 && Array.isArray(config[0])) {
    throw new Error('[head-inject] Invalid config format. Head tags must be objects with a "type" property, not arrays. See documentation for the new format.');
  }

  // Check for multiple base tags
  let baseCount = 0;
  for (const tag of config) {
    if (typeof tag !== 'object' || tag === null) {
      throw new Error('[head-inject] Invalid head tag: must be an object');
    }
    if ((tag as HeadTag).type === 'base') {
      baseCount++;
    }
  }

  if (baseCount > 1) {
    throw new Error('[head-inject] Only one <base> tag is allowed per page');
  }

  // Validate each tag
  for (const tag of config as HeadTag[]) {
    validateHeadTag(tag);
  }
}

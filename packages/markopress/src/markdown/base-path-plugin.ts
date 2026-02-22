import type MarkdownIt from 'markdown-it';

/**
 * markdown-it plugin that prefixes absolute internal links with a base path.
 *
 * Rewrites:
 *   /features       → /markopress/features
 *   /blog/my-post   → /markopress/blog/my-post
 *
 * Does NOT rewrite:
 *   https://...     (external)
 *   //cdn.com/...   (protocol-relative)
 *   #section        (anchor)
 *   mailto:...      (non-http)
 *   paths already starting with base
 */
export function basePathPlugin(md: MarkdownIt, base: string): void {
  // Normalize: strip trailing slash, skip if root or empty
  const normalizedBase = base.replace(/\/$/, '');
  if (!normalizedBase || normalizedBase === '/') return;

  // Rewrite markdown link tokens (covers [text](/path) syntax)
  const defaultLinkOpen = md.renderer.rules.link_open ||
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const hrefIdx = tokens[idx].attrIndex('href');
    if (hrefIdx >= 0) {
      const href = tokens[idx].attrs![hrefIdx][1];
      tokens[idx].attrs![hrefIdx][1] = prefixPath(href, normalizedBase);
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  // Rewrite markdown image tokens (covers ![alt](/path) syntax)
  const defaultImage = md.renderer.rules.image ||
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const srcIdx = tokens[idx].attrIndex('src');
    if (srcIdx >= 0) {
      const src = tokens[idx].attrs![srcIdx][1];
      tokens[idx].attrs![srcIdx][1] = prefixPath(src, normalizedBase);
    }
    return defaultImage(tokens, idx, options, env, self);
  };

  // Rewrite raw HTML <a href="..."> and <img src="..."> in markdown
  const defaultHtmlBlock = md.renderer.rules.html_block ||
    ((tokens, idx) => tokens[idx].content);

  md.renderer.rules.html_block = (tokens, idx, options, env, self) => {
    tokens[idx].content = rewriteHtmlLinks(tokens[idx].content, normalizedBase);
    return defaultHtmlBlock(tokens, idx, options, env, self);
  };

  const defaultHtmlInline = md.renderer.rules.html_inline ||
    ((tokens, idx) => tokens[idx].content);

  md.renderer.rules.html_inline = (tokens, idx, options, env, self) => {
    tokens[idx].content = rewriteHtmlLinks(tokens[idx].content, normalizedBase);
    return defaultHtmlInline(tokens, idx, options, env, self);
  };
}

function prefixPath(url: string, base: string): string {
  // Only prefix absolute internal paths
  if (!url.startsWith('/')) return url;
  // Skip protocol-relative
  if (url.startsWith('//')) return url;
  // Skip if already prefixed
  if (url.startsWith(base + '/') || url === base) return url;
  return base + url;
}

function rewriteHtmlLinks(html: string, base: string): string {
  // Rewrite href="..." and src="..." in raw HTML
  return html.replace(
    /((?:href|src)\s*=\s*)(["'])(\/(?!\/)[^"']*)\2/gi,
    (_match, attr, quote, path) => {
      return attr + quote + prefixPath(path, base) + quote;
    },
  );
}

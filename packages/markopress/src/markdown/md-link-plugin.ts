import type MarkdownIt from 'markdown-it';

/**
 * markdown-it plugin that strips .md extensions from link hrefs.
 *
 * Rewrites:
 *   ./theming.md      → ./theming
 *   ../guides/api.md  → ../guides/api
 *   /guides/plugins.md → /guides/plugins
 *
 * Does NOT rewrite:
 *   https://example.com/file.md  (external)
 *   #section                     (anchor)
 */
export function mdLinkPlugin(md: MarkdownIt): void {
  const defaultLinkOpen = md.renderer.rules.link_open ||
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const hrefIdx = tokens[idx].attrIndex('href');
    if (hrefIdx >= 0) {
      const href = tokens[idx].attrs![hrefIdx][1];
      tokens[idx].attrs![hrefIdx][1] = stripMdExtension(href);
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  // Also handle raw HTML links
  const defaultHtmlBlock = md.renderer.rules.html_block ||
    ((tokens, idx) => tokens[idx].content);

  md.renderer.rules.html_block = (tokens, idx, options, env, self) => {
    tokens[idx].content = rewriteHtmlMdLinks(tokens[idx].content);
    return defaultHtmlBlock(tokens, idx, options, env, self);
  };

  const defaultHtmlInline = md.renderer.rules.html_inline ||
    ((tokens, idx) => tokens[idx].content);

  md.renderer.rules.html_inline = (tokens, idx, options, env, self) => {
    tokens[idx].content = rewriteHtmlMdLinks(tokens[idx].content);
    return defaultHtmlInline(tokens, idx, options, env, self);
  };
}

function stripMdExtension(url: string): string {
  // Skip external URLs and anchors
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//') || url.startsWith('#') || url.startsWith('mailto:')) {
    return url;
  }
  if (url.endsWith('.md')) {
    return url.slice(0, -3);
  }
  return url;
}

function rewriteHtmlMdLinks(html: string): string {
  return html.replace(
    /(href\s*=\s*)(["'])([^"']*\.md)\2/gi,
    (_match, attr, quote, href) => {
      return attr + quote + stripMdExtension(href) + quote;
    },
  );
}

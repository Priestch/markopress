import { describe, it, expect } from 'vitest';
import MarkdownIt from 'markdown-it';
import { basePathPlugin } from './base-path-plugin.js';

describe('basePathPlugin', () => {
  it('prefixes absolute internal links with base path', () => {
    const md = new MarkdownIt();
    md.use(basePathPlugin, '/markopress');

    const result = md.render('[Features](/features)');
    expect(result).toContain('href="/markopress/features"');
  });

  it('does not modify external URLs', () => {
    const md = new MarkdownIt();
    md.use(basePathPlugin, '/markopress');

    const result = md.render('[Google](https://google.com)');
    expect(result).toContain('href="https://google.com"');
  });

  it('does not modify anchor links', () => {
    const md = new MarkdownIt();
    md.use(basePathPlugin, '/markopress');

    const result = md.render('[Section](#section)');
    expect(result).toContain('href="#section"');
  });

  it('does not modify protocol-relative URLs', () => {
    const md = new MarkdownIt();
    md.use(basePathPlugin, '/markopress');

    const result = md.render('[CDN](//cdn.example.com/lib.js)');
    expect(result).toContain('href="//cdn.example.com/lib.js"');
  });

  it('does nothing when base is empty string', () => {
    const md = new MarkdownIt();
    md.use(basePathPlugin, '');

    const result = md.render('[Features](/features)');
    expect(result).toContain('href="/features"');
  });

  it('does nothing when base is /', () => {
    const md = new MarkdownIt();
    md.use(basePathPlugin, '/');

    const result = md.render('[Features](/features)');
    expect(result).toContain('href="/features"');
  });

  it('handles raw HTML links in markdown', () => {
    const md = new MarkdownIt({ html: true });
    md.use(basePathPlugin, '/markopress');

    const result = md.render('<a href="/pricing">Pricing</a>');
    expect(result).toContain('href="/markopress/pricing"');
  });

  it('prefixes image src attributes', () => {
    const md = new MarkdownIt();
    md.use(basePathPlugin, '/markopress');

    const result = md.render('![Logo](/images/logo.png)');
    expect(result).toContain('src="/markopress/images/logo.png"');
  });

  it('does not double-prefix if base already present', () => {
    const md = new MarkdownIt();
    md.use(basePathPlugin, '/markopress');

    const result = md.render('[Home](/markopress/features)');
    expect(result).toContain('href="/markopress/features"');
    expect(result).not.toContain('/markopress/markopress');
  });
});

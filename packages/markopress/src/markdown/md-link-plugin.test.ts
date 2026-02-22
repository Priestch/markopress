import { describe, it, expect } from 'vitest';
import MarkdownIt from 'markdown-it';
import { mdLinkPlugin } from './md-link-plugin.js';

describe('mdLinkPlugin', () => {
  it('strips .md extension from relative links', () => {
    const md = new MarkdownIt();
    md.use(mdLinkPlugin);

    const result = md.render('[Theming](./theming.md)');
    expect(result).toContain('href="./theming"');
  });

  it('strips .md extension from parent-relative links', () => {
    const md = new MarkdownIt();
    md.use(mdLinkPlugin);

    const result = md.render('[Deploy](../guides/deployment.md)');
    expect(result).toContain('href="../guides/deployment"');
  });

  it('strips .md extension from absolute links', () => {
    const md = new MarkdownIt();
    md.use(mdLinkPlugin);

    const result = md.render('[Plugins](/guides/plugins.md)');
    expect(result).toContain('href="/guides/plugins"');
  });

  it('does not modify external URLs ending in .md', () => {
    const md = new MarkdownIt();
    md.use(mdLinkPlugin);

    const result = md.render('[File](https://example.com/readme.md)');
    expect(result).toContain('href="https://example.com/readme.md"');
  });

  it('does not modify links without .md extension', () => {
    const md = new MarkdownIt();
    md.use(mdLinkPlugin);

    const result = md.render('[Home](/features)');
    expect(result).toContain('href="/features"');
  });

  it('handles raw HTML links with .md extension', () => {
    const md = new MarkdownIt({ html: true });
    md.use(mdLinkPlugin);

    const result = md.render('<a href="./api.md">API</a>');
    expect(result).toContain('href="./api"');
  });
});

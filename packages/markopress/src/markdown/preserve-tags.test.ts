import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';
import { preserveTagsPlugin } from './preserve-tags.js';

describe('preserveTagsPlugin', () => {
  it('preserves real tags but ignores inline code and fenced code examples', () => {
    const md = new MarkdownIt({ html: true });
    md.use(preserveTagsPlugin, {});

    const source = [
      'The `<image src="/images/demo.svg" alt="Demo" />` component renders images.',
      '',
      '<image src="/images/demo.svg" alt="Live demo" />',
      '',
      '```marko',
      '<image src="/images/demo.svg" alt="Code example" />',
      '```',
    ].join('\n');

    const html = md.render(source);

    expect(html).toContain('<image src="/images/demo.svg" alt="Live demo" />');
    expect(html).toContain('<code>&lt;image src=&quot;/images/demo.svg&quot; alt=&quot;Demo&quot; /&gt;</code>');
    expect(html).toContain('&lt;image src=&quot;/images/demo.svg&quot; alt=&quot;Code example&quot; /&gt;');
    expect(html).not.toContain('data-marko-tag');
  });

  it('does not let closing HTML blocks swallow the next fenced Marko example', () => {
    const md = new MarkdownIt({ html: true });
    md.use(preserveTagsPlugin, {});

    const source = [
      '<div style="border: 1px solid red;">',
      '  <image src="/images/demo.svg" alt="Live demo" />',
      '</div>',
      '',
      '```marko',
      '<image src="/banner.jpg" layout="fluid" placeholder="blur" />',
      '```',
    ].join('\n');

    const html = md.render(source);

    expect(html).toContain('<image src="/images/demo.svg" alt="Live demo" />');
    expect(html).toContain('<pre><code class="language-marko">&lt;image src=&quot;/banner.jpg&quot; layout=&quot;fluid&quot; placeholder=&quot;blur&quot; /&gt;');
    expect(html).not.toContain('```marko');
    expect(html).not.toContain('data-marko-tag');
  });
});

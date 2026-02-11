import { describe, expect, it, vi } from 'vitest';
import { loadMarkdownModule, markdownContentPlugin, registerMarkdownContent } from './vite-markdown-plugin.js';

describe('loadMarkdownModule', () => {
  it('uses the Marko Run dev server to load virtual modules', async () => {
    const ssrLoadModule = vi.fn(async (id: string) => ({ default: `loaded:${id}` }));
    const previous = (globalThis as { __marko_run_dev__?: unknown }).__marko_run_dev__;
    (globalThis as { __marko_run_dev__?: unknown }).__marko_run_dev__ = {
      devServers: new Set([{ ssrLoadModule }]),
    };

    try {
      const mod = await loadMarkdownModule('virtual:markdown-content/pages/index');
      expect(ssrLoadModule).toHaveBeenCalledWith('virtual:markdown-content/pages/index');
      expect(mod.default).toBe('loaded:virtual:markdown-content/pages/index');
    } finally {
      (globalThis as { __marko_run_dev__?: unknown }).__marko_run_dev__ = previous;
    }
  });
});

describe('markdownContentPlugin', () => {
  it('emits Marko source so kebab-case tags compile as components', () => {
    const plugin = markdownContentPlugin();
    plugin.configResolved?.({ root: '/tmp/site' });

    const contentId = 'pages/marko-tags-test';
    registerMarkdownContent(
      contentId,
      '<h2>Demo</h2>\n<alert-box type="warning">Hello</alert-box>'
    );

    const resolvedId = plugin.resolveId?.(`virtual:markdown-content/${contentId}`) as string;
    const source = plugin.load?.(resolvedId) as string;

    expect(source).toContain('<alert-box type="warning">Hello</alert-box>');
    expect(source).not.toContain('$!{`');
  });

  it('escapes markdown text that looks like a Marko expression', () => {
    const plugin = markdownContentPlugin();
    plugin.configResolved?.({ root: '/tmp/site' });

    const contentId = 'pages/interpolation-literal';
    registerMarkdownContent(contentId, '<p>literal ${value}</p>');

    const resolvedId = plugin.resolveId?.(`virtual:markdown-content/${contentId}`) as string;
    const source = plugin.load?.(resolvedId) as string;

    expect(source).toContain('literal &#36;{value}');
  });
});

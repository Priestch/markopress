import { describe, expect, it, vi } from 'vitest';
import { loadMarkdownModule } from './vite-markdown-plugin.js';

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

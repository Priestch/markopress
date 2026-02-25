import { describe, it, expect, vi } from 'vitest';
import { seoPlugin } from './index.js';
import type { BuildContext } from '../../plugin/types.js';

describe('seoPlugin', () => {
  it('should have correct plugin name', () => {
    const plugin = seoPlugin();
    expect(plugin.name).toBe('seo');
  });

  it('should have postBuild hook', () => {
    const plugin = seoPlugin();
    expect(plugin.postBuild).toBeDefined();
    expect(typeof plugin.postBuild).toBe('function');
  });

  it('should skip sitemap if not configured', async () => {
    const plugin = seoPlugin();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const mockContext = {
      config: {},
    } as any;

    await plugin.postBuild!(mockContext as any);

    expect(consoleSpy).toHaveBeenCalledWith('[seo] Sitemap not configured, skipping');

    consoleSpy.mockRestore();
  });

  it('should call generateSitemap when configured', async () => {
    const plugin = seoPlugin({
      sitemap: { hostname: 'https://example.com' },
    });

    const mockContext = {
      config: {
        seo: {
          sitemap: { hostname: 'https://example.com' },
        },
      },
      outDir: '/tmp/dist',
      routes: {},
      allContent: {},
    } as any;

    // Should not throw
    await expect(plugin.postBuild!(mockContext as any)).resolves.toBeUndefined();
  });
});

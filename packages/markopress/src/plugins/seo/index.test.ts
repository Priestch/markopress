import { describe, it, expect, vi } from 'vitest';
import { seoPlugin } from './index.js';
import * as robotsModule from './robots.js';
import * as sitemapModule from './sitemap.js';

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

  it('should skip when not configured', async () => {
    const plugin = seoPlugin();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const sitemapSpy = vi.spyOn(sitemapModule, 'generateSitemap').mockResolvedValue(undefined);
    const robotsSpy = vi.spyOn(robotsModule, 'generateRobots').mockResolvedValue(undefined);

    const mockContext = {
      config: {},
    } as any;

    await plugin.postBuild!(mockContext as any);

    expect(consoleSpy).toHaveBeenCalledWith('[seo] No SEO generation configured, skipping');
    expect(sitemapSpy).not.toHaveBeenCalled();
    expect(robotsSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
    sitemapSpy.mockRestore();
    robotsSpy.mockRestore();
  });

  it('should call generateSitemap when configured', async () => {
    const sitemapSpy = vi.spyOn(sitemapModule, 'generateSitemap').mockResolvedValue(undefined);

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
    expect(sitemapSpy).toHaveBeenCalledWith(mockContext, { hostname: 'https://example.com' });

    sitemapSpy.mockRestore();
  });

  it('should call generateRobots when configured', async () => {
    const robotsSpy = vi.spyOn(robotsModule, 'generateRobots').mockResolvedValue(undefined);

    const plugin = seoPlugin({
      robots: { disallow: ['/admin'] },
    });

    const mockContext = {
      config: {
        seo: {
          robots: {
            disallow: ['/admin'],
          },
        },
      },
      outDir: '/tmp/dist',
      routes: {},
      allContent: {},
    } as any;

    await expect(plugin.postBuild!(mockContext as any)).resolves.toBeUndefined();
    expect(robotsSpy).toHaveBeenCalledWith(
      mockContext,
      { disallow: ['/admin'] },
      undefined
    );

    robotsSpy.mockRestore();
  });
});

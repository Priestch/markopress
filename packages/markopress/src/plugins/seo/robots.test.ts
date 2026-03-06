import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateRobots } from './robots.js';

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      writeFile: vi.fn(),
      mkdir: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// Import mocked modules
import { promises as fs } from 'fs';

describe('generateRobots', () => {
  const mockBaseContext = {
    config: { site: { url: 'https://example.com', base: '/docs' } },
    outDir: '/tmp/dist',
    routes: {},
    assets: [],
    allContent: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate robots.txt with basic rules', async () => {
    await generateRobots(mockBaseContext, {
      userAgent: ['Googlebot', 'Bingbot'],
      allow: ['/'],
      disallow: ['/admin'],
      crawlDelay: 5,
    });

    expect(fs.writeFile).toHaveBeenCalledWith(
      '/tmp/dist/public/robots.txt',
      'User-agent: Googlebot\nAllow: /\nDisallow: /admin\nCrawl-delay: 5\n\nUser-agent: Bingbot\nAllow: /\nDisallow: /admin\nCrawl-delay: 5\n',
      'utf8'
    );
  });

  it('should include sitemap reference when sitemap options are provided', async () => {
    await generateRobots(mockBaseContext, {
      disallow: ['/private'],
    }, {
      hostname: 'https://example.com',
    });

    expect(fs.writeFile).toHaveBeenCalledWith(
      '/tmp/dist/public/robots.txt',
      expect.stringContaining('Sitemap: https://example.com/docs/sitemap.xml'),
      'utf8'
    );
  });

  it('should use explicit robots sitemap path', async () => {
    await generateRobots(mockBaseContext, {
      disallow: ['/private'],
      sitemap: 'custom-sitemap.xml',
    }, {
      hostname: 'https://example.com',
    });

    expect(fs.writeFile).toHaveBeenCalledWith(
      '/tmp/dist/public/robots.txt',
      expect.stringContaining('Sitemap: https://example.com/docs/custom-sitemap.xml'),
      'utf8'
    );
  });

  it('should generate fallback file without site url when no sitemap options are set', async () => {
    await generateRobots(
      {
        ...mockBaseContext,
        config: { site: {} },
      },
      {
        allow: ['/'],
      }
    );

    const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
    const content = writeCall[1] as string;

    expect(writeCall[0]).toBe('/tmp/dist/public/robots.txt');
    expect(content).toContain('User-agent: *');
    expect(content).not.toContain('Sitemap:');
  });
});

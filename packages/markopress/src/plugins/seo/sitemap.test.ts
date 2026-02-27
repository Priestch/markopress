import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSitemap } from './sitemap.js';
import type { ContentFile } from '../../content/types.js';
import type { AllContent } from '../../plugin/types.js';

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      stat: vi.fn(() => ({
        mtime: new Date('2024-02-24T10:00:00Z'),
      })),
    },
  };
});

// Import mocked modules
import { promises as fs } from 'fs';

describe('generateSitemap', () => {
  const mockConfig = {
    site: { url: 'https://example.com' },
  } as any;

  const mockContentFiles: ContentFile[] = [
    {
      filePath: '/content/index.md',
      urlPath: '/',
      filename: 'index.md',
      slug: 'index',
      frontmatter: {},
    },
    {
      filePath: '/content/about.md',
      urlPath: '/about',
      filename: 'about.md',
      slug: 'about',
      frontmatter: {},
    },
  ];

  const mockAllContent = {
    getPages: () => mockContentFiles,
    getDocs: () => [],
    getPosts: () => [],
    getContent: () => [],
  } as AllContent;

  const mockContext = {
    config: mockConfig,
    outDir: '/tmp/dist',
    routes: {
      '/': { path: '/' },
      '/about': { path: '/about' },
      '/api/test': { path: '/api/test' },
    },
    assets: [],
    allContent: mockAllContent,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate sitemap with routes', async () => {
    const options = {
      hostname: 'https://example.com',
      exclude: ['/api/**'],
    };

    await generateSitemap(mockContext, options);

    expect(fs.writeFile).toHaveBeenCalledWith(
      '/tmp/dist/sitemap.xml',
      expect.stringContaining('<?xml version="1.0"'),
      'utf8'
    );
  });

  it('should exclude routes matching patterns', async () => {
    const options = {
      hostname: 'https://example.com',
      exclude: ['/api/**'],
    };

    await generateSitemap(mockContext, options);

    const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
    const xmlContent = writeCall[1] as string;

    expect(xmlContent).toContain('<loc>https://example.com/</loc>');
    expect(xmlContent).toContain('<loc>https://example.com/about</loc>');
    expect(xmlContent).not.toContain('<loc>https://example.com/api/test</loc>');
  });

  it('should use config.site.url as fallback hostname', async () => {
    const options = {};

    await generateSitemap(mockContext, options);

    expect(fs.writeFile).toHaveBeenCalled();
    const xmlContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    expect(xmlContent).toContain('https://example.com');
  });

  it('should not throw error when no hostname available', async () => {
    const noUrlConfig = { site: {} } as any;
    const noUrlContext = { ...mockContext, config: noUrlConfig };

    const options = {};

    // Should not throw
    await expect(generateSitemap(noUrlContext, options)).resolves.toBeUndefined();

    // writeFile should not be called due to error
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should apply transformItems hook', async () => {
    const options = {
      hostname: 'https://example.com',
      transformItems: (items: any[]) => {
        return items.filter((item) => !item.url.includes('/about'));
      },
    };

    await generateSitemap(mockContext, options);

    const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
    const xmlContent = writeCall[1] as string;

    expect(xmlContent).toContain('<loc>https://example.com/</loc>');
    expect(xmlContent).not.toContain('<loc>https://example.com/about</loc>');
  });
});

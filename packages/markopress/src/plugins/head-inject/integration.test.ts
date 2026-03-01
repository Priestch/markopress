import { describe, it, expect } from 'vitest';
import { headInjectPlugin } from './index.js';
import type { ResolvedConfig } from '../../config/types.js';

describe('head-inject integration', () => {
  it('should process head config through full plugin lifecycle', () => {
    const mockConfig = {
      site: {
        title: 'Integration Test',
        head: [
          ['meta', { name: 'description', content: 'Test' }],
          ['link', { rel: 'icon', href: '/favicon.ico', position: 'top' }],
          ['script', { src: '/analytics.js', async: true }]
        ]
      }
    } as any;

    const plugin = headInjectPlugin();
    const result = plugin.config!(mockConfig);

    // Verify config hook returns the config object
    expect(result).toBeDefined();
    expect(result.site.title).toBe('Integration Test');
  });

  it('should handle empty head config gracefully', () => {
    const mockConfig = {
      site: {
        title: 'Test Site',
        head: []
      }
    } as any;

    const plugin = headInjectPlugin();
    const result = plugin.config!(mockConfig);

    expect(result).toBeDefined();
    expect(result.site.head).toEqual([]);
  });

  it('should handle missing head config', () => {
    const mockConfig = {
      site: {
        title: 'Test Site'
      }
    } as any;

    const plugin = headInjectPlugin();
    const result = plugin.config!(mockConfig);

    expect(result).toBeDefined();
  });

  it('should handle invalid head config without throwing', () => {
    const mockConfig = {
      site: {
        title: 'Test Site',
        head: [
          ['link', { rel: 'icon' }] as any  // Missing href (invalid)
        ]
      }
    };

    const plugin = headInjectPlugin();
    // Should not throw, but log warning
    expect(() => plugin.config!(mockConfig)).not.toThrow();
  });

  it('should handle multiple base tags validation', () => {
    const mockConfig = {
      site: {
        title: 'Test Site',
        head: [
          ['base', { href: 'https://example.com' }],
          ['base', { href: 'https://other.com' }]
        ]
      }
    };

    const plugin = headInjectPlugin();
    // Should not throw, but log warning
    expect(() => plugin.config!(mockConfig)).not.toThrow();
  });

  it('should enhance modules with head data', async () => {
    const mockConfig = {
      site: {
        title: 'Test Site',
        head: [
          ['meta', { name: 'viewport', content: 'width=device-width', position: 'top' }],
          ['link', { rel: 'stylesheet', href: '/style.css' }]
        ]
      }
    } as any;

    const mockModules = [
      {
        id: 'docs',
        files: [
          {
            id: 'docs/guide',
            slug: 'guide',
            processed: {
              frontmatter: {
                title: 'Guide'
                // Note: File-specific head tags not included in this test
                // as they require the new object format
              }
            }
          }
        ]
      }
    ];

    const plugin = headInjectPlugin();
    plugin.config!(mockConfig);
    await plugin.enhanceModules!(mockModules);

    // Verify global head tags are added to files
    const file = mockModules[0].files[0];
    expect(file.globalHeadTop).toBeDefined();
    expect(file.globalHeadBottom).toBeDefined();
    expect(file.globalHeadTop.length).toBeGreaterThan(0);
    expect(file.globalHeadBottom.length).toBeGreaterThan(0);
  });

  it('should handle modules with no head data', async () => {
    const mockConfig = {
      site: {
        title: 'Test Site',
        head: []
      }
    } as any;

    const mockModules = [
      {
        id: 'docs',
        files: [
          {
            id: 'docs/guide',
            slug: 'guide',
            processed: {
              frontmatter: {
                title: 'Guide'
              }
            }
          }
        ]
      }
    ];

    const plugin = headInjectPlugin();
    plugin.config!(mockConfig);
    await plugin.enhanceModules!(mockModules);

    const file = mockModules[0].files[0];
    // Should have empty arrays, not undefined
    expect(file.globalHeadTop).toBeDefined();
    expect(file.globalHeadBottom).toBeDefined();
  });

  it('should respect enabled option', () => {
    const mockConfig = {
      site: {
        title: 'Test Site',
        head: [['meta', { name: 'test', content: 'value' }]]
      }
    } as any;

    const pluginDisabled = headInjectPlugin({ enabled: false });
    const result = pluginDisabled.config!(mockConfig);

    expect(result).toBeDefined();
  });

  it('should handle file with no head data', async () => {
    const mockConfig = {
      site: {
        title: 'Test Site',
        head: [['meta', { name: 'viewport', content: 'width=device-width' }]]
      }
    } as any;

    const mockModules = [
      {
        id: 'docs',
        files: [
          {
            id: 'docs/guide',
            slug: 'guide',
            processed: {
              frontmatter: {
                title: 'Guide'
                // No head property
              }
            }
          }
        ]
      }
    ];

    const plugin = headInjectPlugin();
    plugin.config!(mockConfig);

    // Should not throw
    expect(() => plugin.enhanceModules!(mockModules)).not.toThrow();

    const file = mockModules[0].files[0];
    // Should have global head tags
    expect(file.globalHeadTop).toBeDefined();
    expect(file.globalHeadBottom).toBeDefined();
  });
});

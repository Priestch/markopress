/**
 * Tests for head-inject plugin
 */

import { describe, it, expect, vi } from 'vitest';
import { headInjectPlugin } from './index.js';

describe('headInjectPlugin', () => {
  it('should have correct plugin name', () => {
    const plugin = headInjectPlugin();
    expect(plugin.name).toBe('head-inject');
  });

  it('should accept options', () => {
    const plugin = headInjectPlugin({ enabled: false });
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('head-inject');
  });

  describe('enhanceModules', () => {
    it('should enhance modules with head metadata', async () => {
      const plugin = headInjectPlugin();

      const modules = [
        {
          id: 'test-module',
          files: [
            {
              id: 'test-page',
              processed: {
                frontmatter: {
                  title: 'Test Page',
                  head: [
                    {
                      type: 'meta',
                      name: 'description',
                      content: 'Test description',
                    },
                  ],
                },
              },
            },
          ],
        },
      ];

      await plugin.enhanceModules?.(modules);

      expect(modules[0].files[0].headBottom).toBeDefined();
      expect(modules[0].files[0].headBottom).toHaveLength(1);
      expect(modules[0].files[0].headBottom?.[0]).toEqual([
        'meta',
        { name: 'description', content: 'Test description' },
      ]);
    });

    it('should group head tags by position', async () => {
      const plugin = headInjectPlugin();

      const modules = [
        {
          id: 'test-module',
          files: [
            {
              id: 'test-page',
              processed: {
                frontmatter: {
                  title: 'Test Page',
                  head: [
                    {
                      type: 'meta',
                      name: 'charset',
                      charset: 'UTF-8',
                      position: 'top',
                    },
                    {
                      type: 'meta',
                      name: 'description',
                      content: 'Test description',
                      position: 'bottom',
                    },
                  ],
                },
              },
            },
          ],
        },
      ];

      await plugin.enhanceModules?.(modules);

      expect(modules[0].files[0].headTop).toHaveLength(1);
      expect(modules[0].files[0].headTop?.[0]).toEqual([
        'meta',
        { charset: 'UTF-8' },
      ]);

      expect(modules[0].files[0].headBottom).toHaveLength(1);
      expect(modules[0].files[0].headBottom?.[0]).toEqual([
        'meta',
        { name: 'description', content: 'Test description' },
      ]);
    });

    it('should default to bottom position when not specified', async () => {
      const plugin = headInjectPlugin();

      const modules = [
        {
          id: 'test-module',
          files: [
            {
              id: 'test-page',
              processed: {
                frontmatter: {
                  title: 'Test Page',
                  head: [
                    {
                      type: 'link',
                      rel: 'stylesheet',
                      href: '/styles.css',
                    },
                  ],
                },
              },
            },
          ],
        },
      ];

      await plugin.enhanceModules?.(modules);

      expect(modules[0].files[0].headBottom).toHaveLength(1);
      expect(modules[0].files[0].headTop).toHaveLength(0);
    });

    it('should handle files without head data', async () => {
      const plugin = headInjectPlugin();

      const modules = [
        {
          id: 'test-module',
          files: [
            {
              id: 'test-page',
              processed: {
                frontmatter: {
                  title: 'Test Page',
                },
              },
            },
          ],
        },
      ];

      await plugin.enhanceModules?.(modules);

      expect(modules[0].files[0].headTop).toBeUndefined();
      expect(modules[0].files[0].headBottom).toBeUndefined();
    });

    it('should handle multiple files in a module', async () => {
      const plugin = headInjectPlugin();

      const modules = [
        {
          id: 'test-module',
          files: [
            {
              id: 'page1',
              processed: {
                frontmatter: {
                  title: 'Page 1',
                  head: [
                    {
                      type: 'meta',
                      name: 'description',
                      content: 'Page 1 description',
                    },
                  ],
                },
              },
            },
            {
              id: 'page2',
              processed: {
                frontmatter: {
                  title: 'Page 2',
                  head: [
                    {
                      type: 'meta',
                      name: 'description',
                      content: 'Page 2 description',
                    },
                  ],
                },
              },
            },
          ],
        },
      ];

      await plugin.enhanceModules?.(modules);

      expect(modules[0].files[0].headBottom).toHaveLength(1);
      expect(modules[0].files[1].headBottom).toHaveLength(1);
      expect(modules[0].files[0].headBottom?.[0]).not.toEqual(
        modules[0].files[1].headBottom?.[0]
      );
    });

    it('should mark invalid head config', async () => {
      const plugin = headInjectPlugin();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const modules = [
        {
          id: 'test-module',
          files: [
            {
              id: 'test-page',
              processed: {
                frontmatter: {
                  title: 'Test Page',
                  head: [
                    {
                      type: 'meta',
                      // Missing required 'content' field
                      name: 'description',
                    } as any,
                  ],
                },
              },
            },
          ],
        },
      ];

      await plugin.enhanceModules?.(modules);

      expect(modules[0].files[0].headInvalid).toBe(true);
      expect(modules[0].files[0].headError).toBeDefined();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should skip processing when disabled', async () => {
      const plugin = headInjectPlugin({ enabled: false });

      const modules = [
        {
          id: 'test-module',
          files: [
            {
              id: 'test-page',
              processed: {
                frontmatter: {
                  title: 'Test Page',
                  head: [
                    {
                      type: 'meta',
                      name: 'description',
                      content: 'Test description',
                    },
                  ],
                },
              },
            },
          ],
        },
      ];

      await plugin.enhanceModules?.(modules);

      expect(modules[0].files[0].headTop).toBeUndefined();
      expect(modules[0].files[0].headBottom).toBeUndefined();
    });

    it('should handle all tag types', async () => {
      const plugin = headInjectPlugin();

      const modules = [
        {
          id: 'test-module',
          files: [
            {
              id: 'test-page',
              processed: {
                frontmatter: {
                  title: 'Test Page',
                  head: [
                    {
                      type: 'meta',
                      name: 'description',
                      content: 'Test description',
                    },
                    {
                      type: 'link',
                      rel: 'stylesheet',
                      href: '/styles.css',
                    },
                    {
                      type: 'script',
                      src: '/script.js',
                      async: true,
                    },
                    {
                      type: 'base',
                      href: 'https://example.com/',
                    },
                  ],
                },
              },
            },
          ],
        },
      ];

      await plugin.enhanceModules?.(modules);

      expect(modules[0].files[0].headBottom).toHaveLength(4);
      expect(modules[0].files[0].headBottom?.[0][0]).toBe('meta');
      expect(modules[0].files[0].headBottom?.[1][0]).toBe('link');
      expect(modules[0].files[0].headBottom?.[2][0]).toBe('script');
      expect(modules[0].files[0].headBottom?.[3][0]).toBe('base');
    });

    it('should handle inline scripts with content', async () => {
      const plugin = headInjectPlugin();

      const modules = [
        {
          id: 'test-module',
          files: [
            {
              id: 'test-page',
              processed: {
                frontmatter: {
                  title: 'Test Page',
                  head: [
                    {
                      type: 'script',
                      content: 'console.log("Hello, world!");',
                    },
                  ],
                },
              },
            },
          ],
        },
      ];

      await plugin.enhanceModules?.(modules);

      expect(modules[0].files[0].headBottom).toHaveLength(1);
      expect(modules[0].files[0].headBottom?.[0]).toEqual([
        'script',
        {},
        'console.log("Hello, world!");',
      ]);
    });

    it('should handle complex link tags', async () => {
      const plugin = headInjectPlugin();

      const modules = [
        {
          id: 'test-module',
          files: [
            {
              id: 'test-page',
              processed: {
                frontmatter: {
                  title: 'Test Page',
                  head: [
                    {
                      type: 'link',
                      rel: 'preconnect',
                      href: 'https://fonts.googleapis.com',
                      crossorigin: 'anonymous',
                    },
                  ],
                },
              },
            },
          ],
        },
      ];

      await plugin.enhanceModules?.(modules);

      expect(modules[0].files[0].headBottom).toHaveLength(1);
      expect(modules[0].files[0].headBottom?.[0]).toEqual([
        'link',
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
          crossorigin: 'anonymous',
        },
      ]);
    });

    it('should filter undefined values from attributes', async () => {
      const plugin = headInjectPlugin();

      const modules = [
        {
          id: 'test-module',
          files: [
            {
              id: 'test-page',
              processed: {
                frontmatter: {
                  title: 'Test Page',
                  head: [
                    {
                      type: 'link',
                      rel: 'stylesheet',
                      href: '/styles.css',
                      // Optional fields not provided
                    },
                  ],
                },
              },
            },
          ],
        },
      ];

      await plugin.enhanceModules?.(modules);

      const attrs = modules[0].files[0].headBottom?.[0][1] as Record<string, unknown>;
      expect(attrs).toEqual({
        rel: 'stylesheet',
        href: '/styles.css',
      });
      expect(attrs.as).toBeUndefined();
      expect(attrs.media).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should warn and continue on validation error', async () => {
      const plugin = headInjectPlugin();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const modules = [
        {
          id: 'test-module',
          files: [
            {
              id: 'test-page',
              processed: {
                frontmatter: {
                  title: 'Test Page',
                  head: [
                    {
                      type: 'meta',
                      // Missing content
                      name: 'description',
                    } as any,
                  ],
                },
              },
            },
          ],
        },
      ];

      await plugin.enhanceModules?.(modules);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[head-inject] Invalid head config in test-page')
      );
      expect(modules[0].files[0].headInvalid).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should handle invalid position gracefully', async () => {
      const plugin = headInjectPlugin();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const modules = [
        {
          id: 'test-module',
          files: [
            {
              id: 'test-page',
              processed: {
                frontmatter: {
                  title: 'Test Page',
                  head: [
                    {
                      type: 'meta',
                      name: 'description',
                      content: 'Test',
                      position: 'invalid' as any,
                    },
                  ],
                },
              },
            },
          ],
        },
      ];

      await plugin.enhanceModules?.(modules);

      expect(modules[0].files[0].headInvalid).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});

/**
 * Tests for head-inject plugin
 */

import { describe, it, expect } from 'vitest';
import { headInjectPlugin } from './index.js';

describe('headInjectPlugin', () => {
  it('should have correct plugin name', () => {
    expect(headInjectPlugin.name).toBe('head-inject');
  });

  it('should have config hook', () => {
    expect(headInjectPlugin.config).toBeInstanceOf(Function);
  });

  describe('config hook', () => {
    it('should process head config and store _headInject data', () => {
      const config = {
        site: {
          title: 'Test Site',
          head: [
            {
              type: 'meta',
              name: 'description',
              content: 'Test description',
            },
            {
              type: 'link',
              rel: 'icon',
              href: '/favicon.ico',
              position: 'top',
            },
          ],
        },
      } as any;

      const result = headInjectPlugin.config!(config);

      expect(result).toBeDefined();
      expect((result as any)._headInject).toBeDefined();
      expect((result as any)._headInject.headTop).toHaveLength(1);
      expect((result as any)._headInject.headBottom).toHaveLength(1);
    });

    it('should handle empty head config', () => {
      const config = {
        site: {
          title: 'Test Site',
          head: [],
        },
      } as any;

      const result = headInjectPlugin.config!(config);

      expect(result).toBeDefined();
      expect((result as any)._headInject).toBeUndefined();
    });

    it('should handle missing head config', () => {
      const config = {
        site: {
          title: 'Test Site',
        },
      } as any;

      const result = headInjectPlugin.config!(config);

      expect(result).toBeDefined();
      expect((result as any)._headInject).toBeUndefined();
    });

    it('should validate head config and throw on error', () => {
      const config = {
        site: {
          title: 'Test Site',
          head: [
            {
              type: 'link',
              rel: 'icon',
              // Missing href - invalid
            } as any,
          ],
        },
      };

      expect(() => headInjectPlugin.config!(config)).toThrow('[head-inject]');
    });

    it('should not modify other config properties', () => {
      const config = {
        site: {
          title: 'Test Site',
          description: 'Test description',
          head: [
            {
              type: 'meta',
              name: 'viewport',
              content: 'width=device-width',
            },
          ],
        },
        build: {
          outDir: 'dist',
        },
      } as any;

      const result = headInjectPlugin.config!(config);

      expect(result.site.title).toBe('Test Site');
      expect(result.site.description).toBe('Test description');
      expect(result.build.outDir).toBe('dist');
    });

    it('should group tags by position correctly', () => {
      const config = {
        site: {
          title: 'Test Site',
          head: [
            {
              type: 'meta',
              name: 'viewport',
              content: 'width=device-width',
              position: 'top',
            },
            {
              type: 'link',
              rel: 'stylesheet',
              href: '/style.css',
            },
            {
              type: 'script',
              src: '/analytics.js',
              position: 'top',
            },
            {
              type: 'script',
              content: 'console.log("test");',
            },
          ],
        },
      } as any;

      const result = headInjectPlugin.config!(config);

      expect((result as any)._headInject.headTop).toHaveLength(2);
      expect((result as any)._headInject.headBottom).toHaveLength(2);
    });
  });
});

/**
 * Tests for transformer.ts
 * TDD: Write failing tests first, then implement
 */

import { describe, test, expect } from 'vitest';
import {
  transformHeadConfig,
  filterUndefined,
} from './transformer';
import type {
  MetaTag,
  LinkTag,
  ScriptTag,
  BaseTag,
  HeadTag,
  GroupedHeadTags,
  RenderableHeadTag,
} from './types';

describe('filterUndefined', () => {
  test('should remove undefined values from object', () => {
    const input = {
      a: 1,
      b: undefined,
      c: 'test',
      d: null,
      e: false,
    };
    const expected = {
      a: 1,
      c: 'test',
      d: null,
      e: false,
    };
    expect(filterUndefined(input)).toEqual(expected);
  });

  test('should return empty object when all values are undefined', () => {
    expect(filterUndefined({ a: undefined, b: undefined })).toEqual({});
  });

  test('should return same object when no undefined values', () => {
    const input = { a: 1, b: 'test' };
    expect(filterUndefined(input)).toEqual(input);
  });
});

describe('transformHeadConfig', () => {
  test('should handle empty array', () => {
    const result = transformHeadConfig([]);
    expect(result).toEqual({
      headTop: [],
      headBottom: [],
    });
  });

  describe('Meta tag transformation', () => {
    test('should transform meta tag with name', () => {
      const meta: MetaTag = {
        type: 'meta',
        name: 'description',
        content: 'Test description',
      };
      const result = transformHeadConfig([meta]);
      expect(result.headBottom).toEqual([
        ['meta', { name: 'description', content: 'Test description' }],
      ]);
    });

    test('should transform meta tag with property (Open Graph)', () => {
      const meta: MetaTag = {
        type: 'meta',
        property: 'og:title',
        content: 'Test Title',
      };
      const result = transformHeadConfig([meta]);
      expect(result.headBottom).toEqual([
        ['meta', { property: 'og:title', content: 'Test Title' }],
      ]);
    });

    test('should transform meta tag with http-equiv', () => {
      const meta: MetaTag = {
        type: 'meta',
        httpEquiv: 'refresh',
        content: '30',
      };
      const result = transformHeadConfig([meta]);
      expect(result.headBottom).toEqual([
        ['meta', { 'http-equiv': 'refresh', content: '30' }],
      ]);
    });

    test('should transform meta tag with charset', () => {
      const meta: MetaTag = {
        type: 'meta',
        charset: 'UTF-8',
      };
      const result = transformHeadConfig([meta]);
      expect(result.headBottom).toEqual([
        ['meta', { charset: 'UTF-8' }],
      ]);
    });

    test('should transform meta tag with all attributes', () => {
      const meta: MetaTag = {
        type: 'meta',
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      };
      const result = transformHeadConfig([meta]);
      expect(result.headBottom).toEqual([
        ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      ]);
    });

    test('should filter out undefined attributes from meta tag', () => {
      const meta: MetaTag = {
        type: 'meta',
        name: 'description',
        content: 'Test',
        property: undefined, // Should be filtered out
      };
      const result = transformHeadConfig([meta]);
      expect(result.headBottom).toEqual([
        ['meta', { name: 'description', content: 'Test' }],
      ]);
    });
  });

  describe('Link tag transformation', () => {
    test('should transform basic link tag', () => {
      const link: LinkTag = {
        type: 'link',
        rel: 'stylesheet',
        href: '/styles.css',
      };
      const result = transformHeadConfig([link]);
      expect(result.headBottom).toEqual([
        ['link', { rel: 'stylesheet', href: '/styles.css' }],
      ]);
    });

    test('should transform link tag with as attribute', () => {
      const link: LinkTag = {
        type: 'link',
        rel: 'preload',
        href: '/font.woff2',
        as: 'font',
      };
      const result = transformHeadConfig([link]);
      expect(result.headBottom).toEqual([
        ['link', { rel: 'preload', href: '/font.woff2', as: 'font' }],
      ]);
    });

    test('should transform link tag with mimeType (maps to type)', () => {
      const link: LinkTag = {
        type: 'link',
        rel: 'stylesheet',
        href: '/styles.css',
        mimeType: 'text/css',
      };
      const result = transformHeadConfig([link]);
      expect(result.headBottom).toEqual([
        ['link', { rel: 'stylesheet', href: '/styles.css', type: 'text/css' }],
      ]);
    });

    test('should transform link tag with all attributes', () => {
      const link: LinkTag = {
        type: 'link',
        rel: 'preload',
        href: '/script.js',
        as: 'script',
        mimeType: 'text/javascript',
        media: 'screen and (min-width: 768px)',
        crossorigin: 'anonymous',
        integrity: 'sha384-abc123',
      };
      const result = transformHeadConfig([link]);
      expect(result.headBottom).toEqual([
        [
          'link',
          {
            rel: 'preload',
            href: '/script.js',
            as: 'script',
            type: 'text/javascript',
            media: 'screen and (min-width: 768px)',
            crossorigin: 'anonymous',
            integrity: 'sha384-abc123',
          },
        ],
      ]);
    });

    test('should handle disabled boolean attribute', () => {
      const link: LinkTag = {
        type: 'link',
        rel: 'stylesheet',
        href: '/styles.css',
        disabled: true,
      };
      const result = transformHeadConfig([link]);
      expect(result.headBottom).toEqual([
        ['link', { rel: 'stylesheet', href: '/styles.css', disabled: true }],
      ]);
    });

    test('should filter out undefined attributes from link tag', () => {
      const link: LinkTag = {
        type: 'link',
        rel: 'stylesheet',
        href: '/styles.css',
        sizes: undefined, // Should be filtered out
      };
      const result = transformHeadConfig([link]);
      expect(result.headBottom).toEqual([
        ['link', { rel: 'stylesheet', href: '/styles.css' }],
      ]);
    });
  });

  describe('Script tag transformation', () => {
    test('should transform external script tag', () => {
      const script: ScriptTag = {
        type: 'script',
        src: '/script.js',
      };
      const result = transformHeadConfig([script]);
      expect(result.headBottom).toEqual([
        ['script', { src: '/script.js' }],
      ]);
    });

    test('should transform inline script tag', () => {
      const script: ScriptTag = {
        type: 'script',
        content: 'console.log("hello");',
      };
      const result = transformHeadConfig([script]);
      expect(result.headBottom).toEqual([
        ['script', {}, 'console.log("hello");'],
      ]);
    });

    test('should transform script with async and defer', () => {
      const script: ScriptTag = {
        type: 'script',
        src: '/script.js',
        async: true,
        defer: true,
      };
      const result = transformHeadConfig([script]);
      expect(result.headBottom).toEqual([
        ['script', { src: '/script.js', async: true, defer: true }],
      ]);
    });

    test('should transform script with scriptType (maps to type)', () => {
      const script: ScriptTag = {
        type: 'script',
        src: '/module.js',
        scriptType: 'module',
      };
      const result = transformHeadConfig([script]);
      expect(result.headBottom).toEqual([
        ['script', { src: '/module.js', type: 'module' }],
      ]);
    });

    test('should transform script with all attributes', () => {
      const script: ScriptTag = {
        type: 'script',
        src: '/script.js',
        async: true,
        defer: false,
        scriptType: 'text/javascript',
        crossorigin: 'use-credentials',
        integrity: 'sha384-abc123',
        nonce: 'nonce123',
      };
      const result = transformHeadConfig([script]);
      expect(result.headBottom).toEqual([
        [
          'script',
          {
            src: '/script.js',
            async: true,
            defer: false,
            type: 'text/javascript',
            crossorigin: 'use-credentials',
            integrity: 'sha384-abc123',
            nonce: 'nonce123',
          },
        ],
      ]);
    });

    test('should filter out undefined attributes from script tag', () => {
      const script: ScriptTag = {
        type: 'script',
        src: '/script.js',
        async: undefined, // Should be filtered out
        defer: undefined, // Should be filtered out
      };
      const result = transformHeadConfig([script]);
      expect(result.headBottom).toEqual([
        ['script', { src: '/script.js' }],
      ]);
    });
  });

  describe('Base tag transformation', () => {
    test('should transform base tag', () => {
      const base: BaseTag = {
        type: 'base',
        href: 'https://example.com/',
      };
      const result = transformHeadConfig([base]);
      expect(result.headBottom).toEqual([
        ['base', { href: 'https://example.com/' }],
      ]);
    });

    test('should transform base tag with target', () => {
      const base: BaseTag = {
        type: 'base',
        href: 'https://example.com/',
        target: '_blank',
      };
      const result = transformHeadConfig([base]);
      expect(result.headBottom).toEqual([
        ['base', { href: 'https://example.com/', target: '_blank' }],
      ]);
    });

    test('should filter out undefined target', () => {
      const base: BaseTag = {
        type: 'base',
        href: 'https://example.com/',
        target: undefined,
      };
      const result = transformHeadConfig([base]);
      expect(result.headBottom).toEqual([
        ['base', { href: 'https://example.com/' }],
      ]);
    });
  });

  describe('Position grouping', () => {
    test('should group tags with position: top to headTop', () => {
      const tags: HeadTag[] = [
        {
          type: 'meta',
          charset: 'UTF-8',
          position: 'top',
        },
        {
          type: 'meta',
          name: 'viewport',
          content: 'width=device-width',
          position: 'top',
        },
      ];
      const result = transformHeadConfig(tags);
      expect(result.headTop).toHaveLength(2);
      expect(result.headBottom).toHaveLength(0);
      expect(result.headTop).toEqual([
        ['meta', { charset: 'UTF-8' }],
        ['meta', { name: 'viewport', content: 'width=device-width' }],
      ]);
    });

    test('should group tags with position: bottom to headBottom', () => {
      const tags: HeadTag[] = [
        {
          type: 'meta',
          name: 'description',
          content: 'Test',
          position: 'bottom',
        },
        {
          type: 'link',
          rel: 'stylesheet',
          href: '/styles.css',
          position: 'bottom',
        },
      ];
      const result = transformHeadConfig(tags);
      expect(result.headTop).toHaveLength(0);
      expect(result.headBottom).toHaveLength(2);
    });

    test('should default to bottom when position is undefined', () => {
      const tags: HeadTag[] = [
        {
          type: 'meta',
          name: 'description',
          content: 'Test',
          // position undefined
        },
        {
          type: 'meta',
          charset: 'UTF-8',
          position: 'top',
        },
      ];
      const result = transformHeadConfig(tags);
      expect(result.headTop).toHaveLength(1);
      expect(result.headBottom).toHaveLength(1);
      expect(result.headBottom).toEqual([
        ['meta', { name: 'description', content: 'Test' }],
      ]);
    });

    test('should mix top and bottom positions correctly', () => {
      const tags: HeadTag[] = [
        {
          type: 'meta',
          charset: 'UTF-8',
          position: 'top',
        },
        {
          type: 'meta',
          name: 'description',
          content: 'Test',
        }, // defaults to bottom
        {
          type: 'link',
          rel: 'icon',
          href: '/favicon.ico',
          position: 'top',
        },
        {
          type: 'script',
          src: '/script.js',
        }, // defaults to bottom
      ];
      const result = transformHeadConfig(tags);
      expect(result.headTop).toHaveLength(2);
      expect(result.headBottom).toHaveLength(2);
      expect(result.headTop[0]).toEqual(['meta', { charset: 'UTF-8' }]);
      expect(result.headTop[1]).toEqual(['link', { rel: 'icon', href: '/favicon.ico' }]);
      expect(result.headBottom[0]).toEqual(['meta', { name: 'description', content: 'Test' }]);
      expect(result.headBottom[1]).toEqual(['script', { src: '/script.js' }]);
    });
  });

  describe('Complex real-world scenarios', () => {
    test('should handle complete head configuration', () => {
      const tags: HeadTag[] = [
        // Top position - charset and early meta
        {
          type: 'meta',
          charset: 'UTF-8',
          position: 'top',
        },
        {
          type: 'meta',
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
          position: 'top',
        },
        // Bottom position - SEO meta
        {
          type: 'meta',
          name: 'description',
          content: 'Test site description',
        },
        {
          type: 'meta',
          property: 'og:title',
          content: 'Test Title',
        },
        // Bottom position - links
        {
          type: 'link',
          rel: 'canonical',
          href: 'https://example.com/',
        },
        {
          type: 'link',
          rel: 'icon',
          href: '/favicon.ico',
          sizes: '32x32',
        },
        // Bottom position - scripts
        {
          type: 'script',
          src: '/analytics.js',
          async: true,
        },
      ];

      const result = transformHeadConfig(tags);

      // Verify headTop
      expect(result.headTop).toHaveLength(2);
      expect(result.headTop).toEqual([
        ['meta', { charset: 'UTF-8' }],
        ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      ]);

      // Verify headBottom
      expect(result.headBottom).toHaveLength(5);
      expect(result.headBottom).toEqual([
        ['meta', { name: 'description', content: 'Test site description' }],
        ['meta', { property: 'og:title', content: 'Test Title' }],
        ['link', { rel: 'canonical', href: 'https://example.com/' }],
        ['link', { rel: 'icon', href: '/favicon.ico', sizes: '32x32' }],
        ['script', { src: '/analytics.js', async: true }],
      ]);
    });

    test('should handle preconnect links with all attributes', () => {
      const tags: HeadTag[] = [
        {
          type: 'link',
          rel: 'preconnect',
          href: 'https://cdn.example.com',
          crossorigin: 'anonymous',
          position: 'top',
        },
      ];

      const result = transformHeadConfig(tags);
      expect(result.headTop).toEqual([
        ['link', { rel: 'preconnect', href: 'https://cdn.example.com', crossorigin: 'anonymous' }],
      ]);
    });

    test('should handle module scripts with nonce', () => {
      const tags: HeadTag[] = [
        {
          type: 'script',
          src: '/app.js',
          scriptType: 'module',
          nonce: 'abc123',
        },
      ];

      const result = transformHeadConfig(tags);
      expect(result.headBottom).toEqual([
        ['script', { src: '/app.js', type: 'module', nonce: 'abc123' }],
      ]);
    });
  });

  describe('Boolean attribute handling', () => {
    test('should preserve boolean true values', () => {
      const link: LinkTag = {
        type: 'link',
        rel: 'stylesheet',
        href: '/styles.css',
        disabled: true,
      };
      const result = transformHeadConfig([link]);
      expect(result.headBottom).toEqual([
        ['link', { rel: 'stylesheet', href: '/styles.css', disabled: true }],
      ]);
    });

    test('should preserve boolean false values', () => {
      const script: ScriptTag = {
        type: 'script',
        src: '/script.js',
        async: true,
        defer: false,
      };
      const result = transformHeadConfig([script]);
      expect(result.headBottom).toEqual([
        ['script', { src: '/script.js', async: true, defer: false }],
      ]);
    });
  });
});

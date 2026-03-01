import { describe, it, expect } from 'vitest';
import { headInjectPlugin } from './index.js';
import type { ResolvedConfig } from '../../config/types.js';

describe('head-inject integration', () => {
  it('should process head config through full plugin lifecycle', () => {
    const mockConfig = {
      site: {
        title: 'Integration Test',
        head: [
          { type: 'meta', name: 'description', content: 'Test' },
          { type: 'link', rel: 'icon', href: '/favicon.ico', position: 'top' },
          { type: 'script', src: '/analytics.js', async: true }
        ]
      }
    } as any;

    const result = headInjectPlugin.config!(mockConfig);

    // Verify config hook returns the config object
    expect(result).toBeDefined();
    expect(result.site.title).toBe('Integration Test');
    // Verify _headInject data is added
    expect((result as any)._headInject).toBeDefined();
    expect((result as any)._headInject.headTop).toHaveLength(1);
    expect((result as any)._headInject.headBottom).toHaveLength(2);
  });

  it('should handle empty head config gracefully', () => {
    const mockConfig = {
      site: {
        title: 'Test Site',
        head: []
      }
    } as any;

    const result = headInjectPlugin.config!(mockConfig);

    expect(result).toBeDefined();
    expect(result.site.head).toEqual([]);
  });

  it('should handle missing head config', () => {
    const mockConfig = {
      site: {
        title: 'Test Site'
      }
    } as any;

    const result = headInjectPlugin.config!(mockConfig);

    expect(result).toBeDefined();
    expect((result as any)._headInject).toBeUndefined();
  });

  it('should validate and reject invalid head config', () => {
    const mockConfig = {
      site: {
        title: 'Test Site',
        head: [
          { type: 'link', rel: 'icon' } as any  // Missing href (invalid)
        ]
      }
    };

    // Should throw validation error
    expect(() => headInjectPlugin.config!(mockConfig)).toThrow('[head-inject]');
  });

  it('should validate and reject multiple base tags', () => {
    const mockConfig = {
      site: {
        title: 'Test Site',
        head: [
          { type: 'base', href: 'https://example.com' },
          { type: 'base', href: 'https://other.com' }
        ]
      }
    };

    // Should throw validation error
    expect(() => headInjectPlugin.config!(mockConfig)).toThrow('[head-inject]');
  });

  it('should properly group tags by position', () => {
    const mockConfig = {
      site: {
        title: 'Test Site',
        head: [
          { type: 'meta', name: 'viewport', content: 'width=device-width', position: 'top' },
          { type: 'link', rel: 'stylesheet', href: '/style.css' },
          { type: 'script', src: '/early.js', position: 'top' },
          { type: 'script', src: '/late.js' }
        ]
      }
    } as any;

    const result = headInjectPlugin.config!(mockConfig);

    const headInject = (result as any)._headInject;
    expect(headInject).toBeDefined();
    expect(headInject.headTop).toHaveLength(2);  // viewport meta and early script
    expect(headInject.headBottom).toHaveLength(2);  // stylesheet and late script
  });

  it('should transform meta tags correctly', () => {
    const mockConfig = {
      site: {
        title: 'Test Site',
        head: [
          { type: 'meta', name: 'description', content: 'Test description' },
          { type: 'meta', property: 'og:title', content: 'My Site' }
        ]
      }
    } as any;

    const result = headInjectPlugin.config!(mockConfig);

    const headBottom = (result as any)._headInject.headBottom;
    expect(headBottom).toHaveLength(2);

    // Check first meta tag
    expect(headBottom[0][0]).toBe('meta');
    expect(headBottom[0][1]).toEqual({
      name: 'description',
      content: 'Test description'
    });

    // Check second meta tag
    expect(headBottom[1][0]).toBe('meta');
    expect(headBottom[1][1]).toEqual({
      property: 'og:title',
      content: 'My Site'
    });
  });

  it('should transform script tags with content correctly', () => {
    const mockConfig = {
      site: {
        title: 'Test Site',
        head: [
          { type: 'script', content: 'console.log("test");' }
        ]
      }
    } as any;

    const result = headInjectPlugin.config!(mockConfig);

    const headBottom = (result as any)._headInject.headBottom;
    expect(headBottom).toHaveLength(1);

    // Inline scripts use 'text' attribute in Marko
    expect(headBottom[0][0]).toBe('script');
    expect(headBottom[0][1]).toEqual({
      text: 'console.log("test");'
    });
  });

  it('should filter out undefined attributes', () => {
    const mockConfig = {
      site: {
        title: 'Test Site',
        head: [
          { type: 'link', rel: 'stylesheet', href: '/style.css', as: undefined }
        ]
      }
    } as any;

    const result = headInjectPlugin.config!(mockConfig);

    const headBottom = (result as any)._headInject.headBottom;
    expect(headBottom).toHaveLength(1);
    expect(headBottom[0][1]).not.toHaveProperty('as');
  });
});

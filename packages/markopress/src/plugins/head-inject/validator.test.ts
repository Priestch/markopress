import { describe, it, expect } from 'vitest';
import { validateHeadTag, validateHeadConfig } from './validator.js';
import type { HeadTag } from './types.js';

describe('validateHeadTag', () => {
  it('should validate a valid meta tag', () => {
    const tag: HeadTag = { type: 'meta', name: 'description', content: 'Test' };
    expect(() => validateHeadTag(tag)).not.toThrow();
  });

  it('should validate a valid link tag', () => {
    const tag: HeadTag = { type: 'link', rel: 'stylesheet', href: '/style.css' };
    expect(() => validateHeadTag(tag)).not.toThrow();
  });

  it('should validate a valid script tag with src', () => {
    const tag: HeadTag = { type: 'script', src: '/script.js' };
    expect(() => validateHeadTag(tag)).not.toThrow();
  });

  it('should validate a valid script tag with content', () => {
    const tag: HeadTag = { type: 'script', content: 'console.log("hi");' };
    expect(() => validateHeadTag(tag)).not.toThrow();
  });

  it('should reject meta tag without content', () => {
    const tag: HeadTag = { type: 'meta', name: 'description' };
    expect(() => validateHeadTag(tag)).toThrow('content');
  });

  it('should reject meta tag without any identifier', () => {
    const tag: HeadTag = { type: 'meta', content: 'test' };
    expect(() => validateHeadTag(tag)).toThrow('name, property, httpEquiv, or charset');
  });

  it('should reject link tag without rel', () => {
    const tag: HeadTag = { type: 'link', href: '/style.css' };
    expect(() => validateHeadTag(tag)).toThrow('rel');
  });

  it('should reject link tag without href', () => {
    const tag: HeadTag = { type: 'link', rel: 'stylesheet' };
    expect(() => validateHeadTag(tag)).toThrow('href');
  });

  it('should reject script tag with both src and content', () => {
    const tag: HeadTag = { type: 'script', src: '/script.js', content: 'console.log("hi");' };
    expect(() => validateHeadTag(tag)).toThrow('mutually exclusive');
  });

  it('should reject script tag without src or content', () => {
    const tag: HeadTag = { type: 'script' };
    expect(() => validateHeadTag(tag)).toThrow('src or content');
  });

  it('should reject base tag without href', () => {
    const tag: HeadTag = { type: 'base' };
    expect(() => validateHeadTag(tag)).toThrow('href');
  });

  it('should reject invalid position', () => {
    const tag: HeadTag = { type: 'meta', name: 'test', content: 'test', position: 'middle' as any };
    expect(() => validateHeadTag(tag)).toThrow('position');
  });
});

describe('validateHeadConfig', () => {
  it('should pass valid config', () => {
    const config: HeadTag[] = [
      { type: 'meta', name: 'description', content: 'Test' },
      { type: 'link', rel: 'icon', href: '/favicon.ico' }
    ];
    expect(() => validateHeadConfig(config)).not.toThrow();
  });

  it('should reject multiple base tags', () => {
    const config: HeadTag[] = [
      { type: 'base', href: 'https://example.com' },
      { type: 'base', href: 'https://other.com' }
    ];
    expect(() => validateHeadConfig(config)).toThrow('Only one');
  });

  it('should reject old array format', () => {
    const config = [['meta', { name: 'test' }]] as any;
    expect(() => validateHeadConfig(config)).toThrow('Invalid config format');
  });
});

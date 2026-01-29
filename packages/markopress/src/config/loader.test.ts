import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { resolveConfig } from './loader.js';

describe('resolveConfig', () => {
  it('defaults content paths relative to app root', () => {
    const appRoot = '/repo/website/.markopress';
    const resolved = resolveConfig({ site: { title: 'Test' } }, appRoot);
    expect(resolved.content.pages).toBe('../content/pages');
  });

  it('preserves user config when content paths are explicitly set', () => {
    const appRoot = '/repo/website/.markopress';
    const resolved = resolveConfig({
      site: { title: 'Test' },
      content: { pages: 'custom/pages' }
    }, appRoot);
    expect(resolved.content.pages).toBe('custom/pages');
  });

  it('uses default blog path relative to app root', () => {
    const appRoot = '/repo/website/.markopress';
    const resolved = resolveConfig({ site: { title: 'Test' } }, appRoot);
    expect(resolved.content.blog).toBe('../content/blog');
  });
});

import { describe, it, expect } from 'vitest';
import { filePathToUrl } from './index.js';

describe('filePathToUrl', () => {
  const contentDir = '/project/content';

  it('maps root index to /', () => {
    expect(filePathToUrl(`${contentDir}/index.md`, contentDir)).toBe('/');
  });

  it('maps root about to /about', () => {
    expect(filePathToUrl(`${contentDir}/about.md`, contentDir)).toBe('/about');
  });

  it('maps docs index to /docs', () => {
    expect(filePathToUrl(`${contentDir}/docs/index.md`, contentDir)).toBe('/docs');
  });

  it('maps docs guide to /docs/guide', () => {
    expect(filePathToUrl(`${contentDir}/docs/guide.md`, contentDir)).toBe('/docs/guide');
  });

  it('maps nested path correctly', () => {
    expect(filePathToUrl(`${contentDir}/docs/advanced/config.md`, contentDir)).toBe('/docs/advanced/config');
  });
});

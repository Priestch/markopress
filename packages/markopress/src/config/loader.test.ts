import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { loadConfig, resolveConfig } from './loader.js';
import type { UserConfig } from './types.js';

describe('loadConfig', () => {
  it('applies defaults for new content format', async () => {
    const resolved = await loadConfig(process.cwd());
    expect(resolved.contentDir).toBe('content');
    expect(resolved.content.docs).toEqual({ sidebar: true });
    expect(resolved.content.blog).toEqual({ rss: true, list: true });
  });
});

describe('resolveConfig', () => {
  const appRoot = '/repo/website/.markopress';

  it('defaults contentDir to content', () => {
    const userConfig: UserConfig = { site: { title: 'Test' } };
    const resolved = resolveConfig(userConfig, appRoot);
    expect(resolved.contentDir).toBe('content');
  });

  it('preserves user-provided contentDir', () => {
    const userConfig: UserConfig = {
      site: { title: 'Test' },
      contentDir: 'my-content',
    };
    const resolved = resolveConfig(userConfig, appRoot);
    expect(resolved.contentDir).toBe('my-content');
  });

  it('applies default content features', () => {
    const userConfig: UserConfig = { site: { title: 'Test' } };
    const resolved = resolveConfig(userConfig, appRoot);
    expect(resolved.content.docs).toEqual({ sidebar: true });
    expect(resolved.content.blog).toEqual({ rss: true, list: true });
  });

  it('preserves user-provided content features', () => {
    const userConfig: UserConfig = {
      site: { title: 'Test' },
      content: {
        guides: { sidebar: true, toc: true },
      },
    };
    const resolved = resolveConfig(userConfig, appRoot);
    expect(resolved.content.guides).toEqual({ sidebar: true, toc: true });
  });
});

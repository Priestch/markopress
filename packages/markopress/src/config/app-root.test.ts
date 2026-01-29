import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { resolveAppRoot } from './app-root.js';

// Mock fs.statSync
const statSyncMock = vi.spyOn(fs, 'statSync');

describe('resolveAppRoot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    statSyncMock.mockReset();
  });

  it('resolves .markopress when present', () => {
    const cwd = path.join('/repo', 'website');
    const markopressPath = path.join(cwd, '.markopress');

    // Mock directory exists
    statSyncMock.mockImplementation((filePath) => {
      if (filePath === markopressPath) {
        return { isDirectory: () => true } as fs.Stats;
      }
      throw new Error('ENOENT');
    });

    const appRoot = resolveAppRoot({ cwd, appDirName: '.markopress' });
    expect(appRoot).toBe(markopressPath);
  });

  it('returns cwd when .markopress is not present', () => {
    const cwd = path.join('/repo', 'website');

    // Mock directory doesn't exist
    statSyncMock.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const appRoot = resolveAppRoot({ cwd, appDirName: '.notexist' });
    expect(appRoot).toBe(cwd);
  });

  it('uses process.cwd() when cwd is not provided', () => {
    // Mock directory doesn't exist
    statSyncMock.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const appRoot = resolveAppRoot();
    expect(appRoot).toBe(process.cwd());
  });

  it('defaults to .markopress as appDirName', () => {
    const cwd = path.join('/repo', 'website');
    const markopressPath = path.join(cwd, '.markopress');

    // Mock directory exists
    statSyncMock.mockImplementation((filePath) => {
      if (filePath === markopressPath) {
        return { isDirectory: () => true } as fs.Stats;
      }
      throw new Error('ENOENT');
    });

    const appRoot = resolveAppRoot({ cwd });
    expect(appRoot).toBe(markopressPath);
  });

  it('returns cwd when appDirName exists but is a file not directory', () => {
    const cwd = path.join('/repo', 'website');
    const markopressPath = path.join(cwd, '.markopress');

    // Mock exists as a file, not directory
    statSyncMock.mockImplementation((filePath) => {
      if (filePath === markopressPath) {
        return { isDirectory: () => false } as fs.Stats;
      }
      throw new Error('ENOENT');
    });

    const appRoot = resolveAppRoot({ cwd, appDirName: '.markopress' });
    expect(appRoot).toBe(cwd);
  });
});

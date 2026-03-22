import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { syncPublicAssets } from './index.js';

describe('syncPublicAssets', () => {
  let tempDir: string;
  let sourceRoot: string;
  let appRoot: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'markopress-public-sync-'));
    sourceRoot = path.join(tempDir, 'site');
    appRoot = path.join(sourceRoot, '.markopress');

    await fs.mkdir(path.join(sourceRoot, 'public', 'images'), { recursive: true });
    await fs.mkdir(path.join(appRoot, 'public'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('copies source public assets into the app root', async () => {
    await fs.writeFile(path.join(sourceRoot, 'public', 'images', 'logo.svg'), '<svg />');

    await syncPublicAssets(sourceRoot, appRoot, false);

    await expect(
      fs.readFile(path.join(appRoot, 'public', 'images', 'logo.svg'), 'utf-8')
    ).resolves.toBe('<svg />');
  });

  it('removes stale synced assets but preserves generated files', async () => {
    const sourceImagePath = path.join(sourceRoot, 'public', 'images', 'logo.svg');
    const syncedImagePath = path.join(appRoot, 'public', 'images', 'logo.svg');
    const generatedSearchIndexPath = path.join(appRoot, 'public', 'search-index.json');

    await fs.writeFile(sourceImagePath, '<svg />');
    await syncPublicAssets(sourceRoot, appRoot, false);

    await fs.writeFile(generatedSearchIndexPath, '{"generated":true}');
    await fs.rm(sourceImagePath);

    await syncPublicAssets(sourceRoot, appRoot, false);

    await expect(fs.access(syncedImagePath)).rejects.toThrow();
    await expect(fs.readFile(generatedSearchIndexPath, 'utf-8')).resolves.toBe('{"generated":true}');
  });
});

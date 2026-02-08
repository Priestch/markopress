import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { generateViteConfig } from '../build/index.js';

describe('generateViteConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'markopress-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should generate vite.config.js with preserveSymlinks enabled', async () => {
    await generateViteConfig(tempDir, false);

    const configPath = path.join(tempDir, 'vite.config.js');
    const config = await fs.readFile(configPath, 'utf-8');

    // Check that the config includes preserveSymlinks
    expect(config).toContain('preserveSymlinks: true');
    
    // Check that the comment explains why
    expect(config).toContain('pnpm workspace compatibility');
    expect(config).toContain('Marko to properly discover tags from symlinked packages');
  });

  it('should include all required imports and plugins', async () => {
    await generateViteConfig(tempDir, false);

    const configPath = path.join(tempDir, 'vite.config.js');
    const config = await fs.readFile(configPath, 'utf-8');

    expect(config).toContain("import { defineConfig } from 'vite'");
    expect(config).toContain("import marko from '@marko/run/vite'");
    expect(config).toContain("import { markdownContentPlugin } from 'markopress/build'");
    expect(config).toContain('marko()');
    expect(config).toContain('markdownContentPlugin()');
  });

  it('should not overwrite existing config with markdownContentPlugin', async () => {
    const configPath = path.join(tempDir, 'vite.config.js');
    const existingConfig = `import { defineConfig } from 'vite';
import marko from '@marko/run/vite';
import { markdownContentPlugin } from 'markopress/build';

export default defineConfig({
  plugins: [
    marko(),
    markdownContentPlugin(),
  ],
});
`;
    await fs.writeFile(configPath, existingConfig);

    await generateViteConfig(tempDir, false);

    const config = await fs.readFile(configPath, 'utf-8');
    expect(config).toBe(existingConfig);
  });
});

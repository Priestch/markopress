import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  generateBlurPlaceholder,
  getImageDimensions,
  getImageFormat,
  isValidImagePath,
} from './index.js';
import { generateResponsiveVariants, transformImage } from './transform.js';

describe('image utilities', () => {
  let tempDir: string;
  let sourceImagePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'markopress-image-'));
    sourceImagePath = path.join(tempDir, 'sample.png');

    await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 64, g: 128, b: 192 },
      },
    })
      .png()
      .toFile(sourceImagePath);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('reads image dimensions from disk', async () => {
    const metadata = await getImageDimensions(sourceImagePath);

    expect(metadata).toMatchObject({
      width: 1200,
      height: 800,
      format: 'png',
    });
    expect(metadata.aspectRatio).toBeCloseTo(1.5);
  });

  it('generates a blur placeholder data URL', async () => {
    const placeholder = await generateBlurPlaceholder(sourceImagePath, 24);

    expect(placeholder.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(placeholder.length).toBeGreaterThan(100);
  });

  it('validates local, remote, and data image paths', () => {
    expect(isValidImagePath(sourceImagePath)).toBe(true);
    expect(isValidImagePath('./images/photo.webp')).toBe(true);
    expect(isValidImagePath('https://example.com/photo.jpg')).toBe(true);
    expect(isValidImagePath('data:image/png;base64,abc')).toBe(true);
    expect(isValidImagePath('not-an-image')).toBe(false);
  });

  it('extracts normalized formats from paths and data URLs', () => {
    expect(getImageFormat('/assets/photo.JPG?x=1')).toBe('jpeg');
    expect(getImageFormat('data:image/webp;base64,abc')).toBe('webp');
    expect(getImageFormat('README.md')).toBeNull();
  });

  it('transforms images to concrete output files', async () => {
    const outputDir = path.join(tempDir, 'out');
    const result = await transformImage({
      src: sourceImagePath,
      width: 300,
      format: 'webp',
      quality: 70,
      outDir: outputDir,
    });

    expect(result.width).toBe(300);
    expect(result.height).toBe(200);
    expect(result.format).toBe('webp');
    expect(result.size).toBeGreaterThan(0);
    await fs.access(result.src);
  });

  it('generates sorted, deduplicated responsive variants', async () => {
    const outputDir = path.join(tempDir, 'variants');
    const results = await generateResponsiveVariants(
      sourceImagePath,
      [640, 320, 640],
      75,
      outputDir
    );

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.width)).toEqual([320, 640]);
    expect(results.every((result) => result.format === 'webp')).toBe(true);
  });
});

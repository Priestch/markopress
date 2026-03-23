import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveImageTag, resolveImageTagsInHtml } from './tag.js';

describe('resolveImageTag', () => {
  let tempDir: string;
  let appRoot: string;
  let publicDir: string;
  let sourceImagePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'markopress-image-tag-'));
    appRoot = path.join(tempDir, '.markopress');
    publicDir = path.join(appRoot, 'public');
    sourceImagePath = path.join(publicDir, 'images', 'sample.png');

    await fs.mkdir(path.dirname(sourceImagePath), { recursive: true });
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

  it('optimizes local fixed images into variants with srcset', async () => {
    const resolved = await resolveImageTag({
      src: '/images/sample.png',
      width: 300,
      layout: 'fixed',
      appRoot,
    });

    expect(resolved.width).toBe(300);
    expect(resolved.height).toBe(200);
    expect(resolved.src).toContain('/_markopress/image/images/');
    expect(resolved.srcset).toContain(' 300w');
    expect(resolved.srcset).toContain(' 600w');
  });

  it('generates a blur placeholder for local raster images', async () => {
    const resolved = await resolveImageTag({
      src: '/images/sample.png',
      width: 300,
      layout: 'fixed',
      placeholder: 'blur',
      appRoot,
    });

    expect(resolved.blurDataURL?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('leaves remote images unchanged', async () => {
    const resolved = await resolveImageTag({
      src: 'https://example.com/hero.jpg',
      width: 400,
      layout: 'responsive',
      appRoot,
    });

    expect(resolved.src).toBe('https://example.com/hero.jpg');
    expect(resolved.srcset).toBeUndefined();
    expect(resolved.width).toBe(400);
  });

  it('preserves explicit srcset values', async () => {
    const resolved = await resolveImageTag({
      src: '/images/sample.png',
      srcset: '/images/sample.png 1x, /images/sample@2x.png 2x',
      width: 300,
      layout: 'fixed',
      appRoot,
    });

    expect(resolved.src).toBe('/images/sample.png');
    expect(resolved.srcset).toBe('/images/sample.png 1x, /images/sample@2x.png 2x');
  });

  it('rewrites image tags in rendered html with resolved attributes', async () => {
    const html = await resolveImageTagsInHtml(
      `<div><image
  src="/images/sample.png"
  alt="Sample"
  width=300
  layout="fixed"
  style={ borderRadius: '8px' }
/></div>`,
      { appRoot }
    );

    expect(html).toContain('src="/_markopress/image/images/');
    expect(html).toContain('srcset="');
    expect(html).toContain('width=300');
    expect(html).toContain('height=200');
    expect(html).toContain("style={ borderRadius: '8px' }");
  });

  it('prefixes generated image urls with the configured base path', async () => {
    const html = await resolveImageTagsInHtml(
      `<image src="/images/sample.png" width=300 layout="fixed" />`,
      { appRoot, base: '/markopress' }
    );

    expect(html).toContain('src="/markopress/_markopress/image/images/');
    expect(html).toContain('srcset="/markopress/_markopress/image/images/');
  });

  it('resolves local images when the src already includes the base path', async () => {
    const resolved = await resolveImageTag({
      src: '/markopress/images/sample.png',
      width: 300,
      layout: 'fixed',
      appRoot,
      base: '/markopress',
    });

    expect(resolved.src).toContain('/markopress/_markopress/image/images/');
    expect(resolved.srcset).toContain('/markopress/_markopress/image/images/');
  });

  it('leaves tags with dynamic optimization props unchanged', async () => {
    const source = `<div><image
  src="/images/sample.png"
  width=input.width
  layout="fixed"
  srcset=input.srcset
/></div>`;

    const html = await resolveImageTagsInHtml(source, { appRoot });

    expect(html).toBe(source);
  });

  it('does not prefix remote images with base path', async () => {
    const resolved = await resolveImageTag({
      src: 'https://example.com/hero.jpg',
      base: '/markopress',
      appRoot,
    });

    expect(resolved.src).toBe('https://example.com/hero.jpg');
  });

  it('does not modify data URLs with base path configured', async () => {
    const resolved = await resolveImageTag({
      src: 'data:image/png;base64,iVBORw0KG',
      base: '/markopress',
      appRoot,
    });

    expect(resolved.src).toBe('data:image/png;base64,iVBORw0KG');
  });
});

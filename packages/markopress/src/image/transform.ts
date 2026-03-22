/**
 * MarkoPress Image Transformation
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getImageFormat } from './index.js';

export interface TransformOptions {
  src: string;
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpg' | 'png' | 'avif';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  outDir: string;
}

export interface TransformResult {
  src: string;
  width: number;
  height: number;
  format: string;
  size: number;
}

function assertDimensions(
  metadata: sharp.Metadata,
  src: string
): asserts metadata is sharp.Metadata & { width: number; height: number } {
  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not determine dimensions for image: ${src}`);
  }
}

function clampQuality(quality: number | undefined): number {
  return Math.max(1, Math.min(100, quality ?? 75));
}

function getTargetDimensions(
  originalWidth: number,
  originalHeight: number,
  width?: number,
  height?: number
): { width: number; height: number } {
  if (width && height) {
    return { width, height };
  }

  if (width) {
    return {
      width,
      height: Math.round((originalHeight / originalWidth) * width),
    };
  }

  if (height) {
    return {
      width: Math.round((originalWidth / originalHeight) * height),
      height,
    };
  }

  return {
    width: originalWidth,
    height: originalHeight,
  };
}

/**
 * Transform an image with specified options
 */
export async function transformImage(
  options: TransformOptions
): Promise<TransformResult> {
  const {
    src,
    width,
    height,
    quality,
    format,
    fit = 'cover',
    outDir,
  } = options;

  const sourcePath = path.resolve(src);
  const metadata = await sharp(sourcePath, { animated: true }).metadata();
  assertDimensions(metadata, src);

  const target = getTargetDimensions(
    metadata.width,
    metadata.height,
    width,
    height
  );
  const normalizedFormat =
    format ?? (getImageFormat(src) as TransformOptions['format']) ?? 'webp';
  const normalizedQuality = clampQuality(quality);

  await fs.mkdir(outDir, { recursive: true });

  const baseName = path.basename(src, path.extname(src));
  const outputExt = normalizedFormat === 'jpg' ? 'jpg' : normalizedFormat;
  const outputPath = path.join(
    outDir,
    `${baseName}-${target.width}x${target.height}.${outputExt}`
  );

  try {
    await fs.access(outputPath);
    const existingMetadata = await sharp(outputPath, { animated: true }).metadata();
    assertDimensions(existingMetadata, outputPath);
    const existingStats = await fs.stat(outputPath);

    return {
      src: outputPath,
      width: existingMetadata.width,
      height: existingMetadata.height,
      format: normalizedFormat === 'jpg' ? 'jpeg' : normalizedFormat,
      size: existingStats.size,
    };
  } catch {
    // Variant does not exist yet, continue with transform.
  }

  let pipeline = sharp(sourcePath, { animated: true })
    .rotate()
    .resize({
      width: target.width,
      height: target.height,
      fit,
      withoutEnlargement: true,
    });

  switch (normalizedFormat) {
    case 'jpg':
      pipeline = pipeline.jpeg({ quality: normalizedQuality, mozjpeg: true });
      break;
    case 'png':
      pipeline = pipeline.png({ quality: normalizedQuality, compressionLevel: 9 });
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality: normalizedQuality });
      break;
    case 'avif':
      pipeline = pipeline.avif({ quality: normalizedQuality });
      break;
    default:
      throw new Error(`Unsupported output format: ${normalizedFormat}`);
  }

  await pipeline.toFile(outputPath);

  const outputMetadata = await sharp(outputPath, { animated: true }).metadata();
  assertDimensions(outputMetadata, outputPath);
  const stats = await fs.stat(outputPath);

  return {
    src: outputPath,
    width: outputMetadata.width,
    height: outputMetadata.height,
    format: normalizedFormat === 'jpg' ? 'jpeg' : normalizedFormat,
    size: stats.size,
  };
}

/**
 * Generate multiple responsive variants of an image
 */
export async function generateResponsiveVariants(
  src: string,
  widths: number[],
  quality: number = 75,
  outDir: string
): Promise<TransformResult[]> {
  const normalizedWidths = [...new Set(widths)]
    .filter((width) => Number.isFinite(width) && width > 0)
    .sort((a, b) => a - b);
  const results: TransformResult[] = [];

  for (const width of normalizedWidths) {
    const result = await transformImage({
      src,
      width,
      quality,
      format: 'webp',
      fit: 'inside',
      outDir,
    });
    results.push(result);
  }

  return results;
}

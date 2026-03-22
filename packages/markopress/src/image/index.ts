/**
 * MarkoPress Image Utilities
 */

import path from 'node:path';
import sharp from 'sharp';

export interface ImageMetadata {
  width: number;
  height: number;
  format?: string;
  aspectRatio: number;
}

const IMAGE_FORMAT_MAP: Record<string, string> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
  gif: 'gif',
  svg: 'svg',
};

function assertDimensions(
  metadata: sharp.Metadata,
  imagePath: string
): asserts metadata is sharp.Metadata & { width: number; height: number } {
  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not determine dimensions for image: ${imagePath}`);
  }
}

/**
 * Get image dimensions from a file path
 */
export async function getImageDimensions(
  imagePath: string
): Promise<ImageMetadata> {
  const metadata = await sharp(imagePath, { animated: true }).metadata();
  assertDimensions(metadata, imagePath);

  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    aspectRatio: metadata.width / metadata.height,
  };
}

/**
 * Generate a blur placeholder from an image
 */
export async function generateBlurPlaceholder(
  imagePath: string,
  size: number = 20
): Promise<string> {
  const metadata = await sharp(imagePath, { animated: true }).metadata();
  assertDimensions(metadata, imagePath);

  const targetWidth = Math.max(1, Math.min(size, metadata.width));
  const targetHeight = Math.max(
    1,
    Math.round((metadata.height / metadata.width) * targetWidth)
  );
  const outputFormat = metadata.hasAlpha ? 'png' : 'jpeg';

  let pipeline = sharp(imagePath, { animated: true })
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .blur(12);

  const buffer =
    outputFormat === 'png'
      ? await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer()
      : await pipeline.jpeg({ quality: 40, mozjpeg: true }).toBuffer();

  return `data:image/${outputFormat};base64,${buffer.toString('base64')}`;
}

/**
 * Validate image URL/path
 */
export function isValidImagePath(imagePath: string): boolean {
  if (!imagePath) return false;
  if (imagePath.startsWith('data:image/')) return true;

  try {
    const url = new URL(imagePath);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return true;
    }
  } catch {
    // Local path, continue below.
  }

  if (
    path.isAbsolute(imagePath) ||
    imagePath.startsWith('./') ||
    imagePath.startsWith('../')
  ) {
    return true;
  }

  const cleanPath = imagePath.split(/[?#]/, 1)[0];
  return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(cleanPath);
}

/**
 * Get image format from filename
 */
export function getImageFormat(imagePath: string): string | null {
  if (!imagePath) return null;

  const dataUriMatch = imagePath.match(/^data:image\/([a-zA-Z0-9.+-]+)[;,]/);
  if (dataUriMatch) {
    return IMAGE_FORMAT_MAP[dataUriMatch[1].toLowerCase()] || dataUriMatch[1].toLowerCase();
  }

  const cleanPath = imagePath.split(/[?#]/, 1)[0];
  const ext = path.extname(cleanPath).slice(1).toLowerCase();
  return IMAGE_FORMAT_MAP[ext] || null;
}

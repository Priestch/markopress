import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { resolveAppRoot } from '../config/app-root.js';
import {
  generateBlurPlaceholder,
  getImageDimensions,
  getImageFormat,
} from './index.js';
import { transformImage } from './transform.js';
import type { TransformOptions } from './transform.js';

type ImageLayout = 'fixed' | 'fluid' | 'responsive';

export interface ResolveImageTagOptions {
  src: string;
  width?: number;
  height?: number;
  layout?: ImageLayout;
  sizes?: string;
  srcset?: string;
  placeholder?: 'blur' | 'none';
  quality?: number;
  appRoot?: string;
}

export interface ResolvedImageTagData {
  src: string;
  width?: number;
  height?: number;
  sizes?: string;
  srcset?: string;
  blurDataURL?: string;
}

type AutoOptimizeFormat = 'jpeg' | 'png' | 'webp' | 'avif';
type ParsedTagAttribute = {
  name: string;
  rawValue?: string;
};

const AUTO_OPTIMIZE_FORMATS = new Set<AutoOptimizeFormat>(['jpeg', 'png', 'webp', 'avif']);
const DEFAULT_RESPONSIVE_WIDTHS = [320, 480, 640, 768, 960, 1280, 1536, 1920];
const blurPlaceholderCache = new Map<string, Promise<string>>();

export async function resolveImageTag(
  options: ResolveImageTagOptions
): Promise<ResolvedImageTagData> {
  const {
    src,
    width,
    height,
    layout = 'responsive',
    sizes,
    srcset,
    placeholder = 'none',
    quality,
    appRoot = resolveAppRoot(),
  } = options;

  const localSource = await resolveLocalSource(src, appRoot);
  if (!localSource) {
    return {
      src,
      width,
      height,
      sizes: sizes ?? getDefaultSizes(layout, width),
      srcset,
    };
  }

  const metadata = await getImageDimensions(localSource.sourcePath);
  const { width: resolvedWidth, height: resolvedHeight } = getResolvedDimensions(
    metadata.width,
    metadata.height,
    width,
    height
  );
  const imageFormat = getImageFormat(localSource.sourcePath);

  const result: ResolvedImageTagData = {
    src,
    width: resolvedWidth,
    height: resolvedHeight,
    sizes: sizes ?? getDefaultSizes(layout, resolvedWidth),
    srcset,
  };

  if (placeholder === 'blur' && isAutoOptimizeFormat(imageFormat)) {
    result.blurDataURL = await getCachedBlurPlaceholder(localSource.sourcePath);
  }

  if (srcset || !isAutoOptimizeFormat(imageFormat)) {
    return result;
  }

  const variantWidths = getVariantWidths(layout, metadata.width, resolvedWidth);
  if (variantWidths.length === 0) {
    return result;
  }

  const outputDir = path.join(
    appRoot,
    'public',
    '_markopress',
    'image',
    getVariantSubdir(localSource.publicPath)
  );
  const format = toTransformFormat(imageFormat);
  const variants = [];

  for (const variantWidth of variantWidths) {
    variants.push(await transformImage({
      src: localSource.sourcePath,
      width: variantWidth,
      quality,
      format,
      fit: 'inside',
      outDir: outputDir,
    }));
  }

  result.src = toPublicUrl(appRoot, variants[variants.length - 1].src);
  result.srcset = variants
    .map((variant) => `${toPublicUrl(appRoot, variant.src)} ${variant.width}w`)
    .join(', ');

  return result;
}

export async function resolveImageTagsInHtml(
  html: string,
  options: Pick<ResolveImageTagOptions, 'appRoot'> = {}
): Promise<string> {
  const matches = [...html.matchAll(/<image(?=[\s/>])[\s\S]*?(?:\/>|>)/g)];
  if (matches.length === 0) {
    return html;
  }

  let output = '';
  let lastIndex = 0;

  for (const match of matches) {
    const tagSource = match[0];
    const startIndex = match.index ?? 0;

    output += html.slice(lastIndex, startIndex);
    output += await resolveImageTagMarkup(tagSource, options);
    lastIndex = startIndex + tagSource.length;
  }

  output += html.slice(lastIndex);
  return output;
}

async function resolveLocalSource(
  src: string,
  appRoot: string
): Promise<{ sourcePath: string; publicPath: string } | null> {
  if (!src || src.startsWith('data:image/')) {
    return null;
  }

  try {
    const url = new URL(src);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return null;
    }
  } catch {
    // Non-URL path, continue.
  }

  const cleanSrc = src.split(/[?#]/, 1)[0];
  const publicDir = path.join(appRoot, 'public');

  if (cleanSrc.startsWith('/')) {
    const publicPath = cleanSrc.replace(/^\/+/, '');
    const candidate = path.join(publicDir, publicPath);
    if (await fileExists(candidate)) {
      return {
        sourcePath: candidate,
        publicPath,
      };
    }
  }

  if (path.isAbsolute(cleanSrc) && await fileExists(cleanSrc)) {
    return {
      sourcePath: cleanSrc,
      publicPath: path.basename(cleanSrc),
    };
  }

  const relativeCandidate = path.resolve(cleanSrc);
  if (await fileExists(relativeCandidate)) {
    return {
      sourcePath: relativeCandidate,
      publicPath: path.basename(relativeCandidate),
    };
  }

  return null;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function getDefaultSizes(
  layout: ImageLayout,
  width?: number
): string | undefined {
  if (layout === 'fixed' && width) {
    return `${width}px`;
  }

  if (layout === 'fluid') {
    return '100vw';
  }

  if (layout === 'responsive' && width) {
    return `(max-width: ${width}px) 100vw, ${width}px`;
  }

  return undefined;
}

function getResolvedDimensions(
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

function getVariantWidths(
  layout: ImageLayout,
  originalWidth: number,
  requestedWidth?: number
): number[] {
  const widths = new Set<number>();

  if (layout === 'fixed') {
    const baseWidth = requestedWidth ?? originalWidth;
    widths.add(Math.min(baseWidth, originalWidth));
    if (baseWidth * 2 <= originalWidth) {
      widths.add(baseWidth * 2);
    } else {
      widths.add(originalWidth);
    }
  } else {
    for (const candidate of DEFAULT_RESPONSIVE_WIDTHS) {
      if (candidate < originalWidth) {
        widths.add(candidate);
      }
    }

    if (requestedWidth) {
      widths.add(Math.min(requestedWidth, originalWidth));
    }

    widths.add(originalWidth);
  }

  return [...widths]
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
}

function getVariantSubdir(publicPath: string): string {
  const relativeDir = path.dirname(publicPath);
  const sourceHash = createHash('sha1').update(publicPath).digest('hex').slice(0, 8);
  return path.join(relativeDir === '.' ? '' : relativeDir, sourceHash);
}

function isAutoOptimizeFormat(format: string | null): format is AutoOptimizeFormat {
  return format !== null && AUTO_OPTIMIZE_FORMATS.has(format as AutoOptimizeFormat);
}

function toTransformFormat(format: AutoOptimizeFormat): TransformOptions['format'] {
  return format === 'jpeg' ? 'jpg' : format;
}

function toPublicUrl(appRoot: string, filePath: string): string {
  const publicDir = path.join(appRoot, 'public');
  const relativePath = path.relative(publicDir, filePath).split(path.sep).join('/');
  return `/${relativePath}`;
}

function getCachedBlurPlaceholder(sourcePath: string): Promise<string> {
  let cached = blurPlaceholderCache.get(sourcePath);
  if (!cached) {
    cached = generateBlurPlaceholder(sourcePath);
    blurPlaceholderCache.set(sourcePath, cached);
  }
  return cached;
}

async function resolveImageTagMarkup(
  tagSource: string,
  options: Pick<ResolveImageTagOptions, 'appRoot'>
): Promise<string> {
  const parsed = parseImageTag(tagSource);
  if (!hasOnlyStaticOptimizationInputs(parsed.attributes)) {
    return tagSource;
  }

  const src = parseStringAttribute(getAttributeValue(parsed.attributes, 'src'));

  if (!src) {
    return tagSource;
  }

  const resolved = await resolveImageTag({
    src,
    width: parseNumberAttribute(getAttributeValue(parsed.attributes, 'width')),
    height: parseNumberAttribute(getAttributeValue(parsed.attributes, 'height')),
    layout: parseLayoutAttribute(getAttributeValue(parsed.attributes, 'layout')),
    sizes: parseStringAttribute(getAttributeValue(parsed.attributes, 'sizes')),
    srcset: parseStringAttribute(getAttributeValue(parsed.attributes, 'srcset')),
    placeholder: parsePlaceholderAttribute(getAttributeValue(parsed.attributes, 'placeholder')),
    quality: parseNumberAttribute(getAttributeValue(parsed.attributes, 'quality')),
    appRoot: options.appRoot,
  });

  const attributes = parsed.attributes.map((attribute) => ({ ...attribute }));
  upsertAttribute(attributes, 'src', serializeStringAttribute(resolved.src));

  if (resolved.width !== undefined) {
    upsertAttribute(attributes, 'width', String(resolved.width));
  }

  if (resolved.height !== undefined) {
    upsertAttribute(attributes, 'height', String(resolved.height));
  }

  if (resolved.sizes) {
    upsertAttribute(attributes, 'sizes', serializeStringAttribute(resolved.sizes));
  }

  if (resolved.srcset) {
    upsertAttribute(attributes, 'srcset', serializeStringAttribute(resolved.srcset));
  }

  if (resolved.blurDataURL) {
    upsertAttribute(
      attributes,
      'blurDataURL',
      serializeStringAttribute(resolved.blurDataURL)
    );
  }

  const serializedAttributes = attributes
    .map((attribute) => serializeAttribute(attribute))
    .filter(Boolean)
    .join(' ');

  return serializedAttributes
    ? `<image ${serializedAttributes}${parsed.selfClosing ? ' />' : '>'}`
    : `<image${parsed.selfClosing ? ' />' : '>'}`;
}

function parseImageTag(tagSource: string): {
  attributes: ParsedTagAttribute[];
  selfClosing: boolean;
} {
  const selfClosing = tagSource.trimEnd().endsWith('/>');
  const body = tagSource
    .replace(/^<image\b/, '')
    .replace(selfClosing ? /\/>\s*$/ : />\s*$/, '');
  const attributes: ParsedTagAttribute[] = [];
  let index = 0;

  while (index < body.length) {
    while (index < body.length && /\s/.test(body[index])) {
      index++;
    }

    if (index >= body.length || body[index] === '/') {
      break;
    }

    const nameStart = index;
    while (index < body.length && !/[\s=/]/.test(body[index])) {
      index++;
    }

    const name = body.slice(nameStart, index);
    if (!name) {
      break;
    }

    while (index < body.length && /\s/.test(body[index])) {
      index++;
    }

    let rawValue: string | undefined;
    if (body[index] === '=') {
      index++;
      while (index < body.length && /\s/.test(body[index])) {
        index++;
      }
      const parsedValue = readAttributeValue(body, index);
      rawValue = parsedValue.value;
      index = parsedValue.end;
    }

    attributes.push({ name, rawValue });
  }

  return { attributes, selfClosing };
}

function readAttributeValue(
  input: string,
  startIndex: number
): { value: string; end: number } {
  const firstChar = input[startIndex];

  if (firstChar === '"' || firstChar === '\'') {
    let index = startIndex + 1;
    while (index < input.length) {
      if (input[index] === '\\') {
        index += 2;
        continue;
      }
      if (input[index] === firstChar) {
        index++;
        break;
      }
      index++;
    }
    return {
      value: input.slice(startIndex, index),
      end: index,
    };
  }

  if (firstChar === '{') {
    let depth = 0;
    let quote: string | null = null;
    let index = startIndex;

    while (index < input.length) {
      const char = input[index];

      if (quote) {
        if (char === '\\') {
          index += 2;
          continue;
        }
        if (char === quote) {
          quote = null;
        }
        index++;
        continue;
      }

      if (char === '"' || char === '\'' || char === '`') {
        quote = char;
        index++;
        continue;
      }

      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          index++;
          break;
        }
      }

      index++;
    }

    return {
      value: input.slice(startIndex, index),
      end: index,
    };
  }

  let index = startIndex;
  while (index < input.length && !/\s/.test(input[index])) {
    index++;
  }

  return {
    value: input.slice(startIndex, index),
    end: index,
  };
}

function getAttributeValue(
  attributes: ParsedTagAttribute[],
  name: string
): string | undefined {
  return attributes.find((attribute) => attribute.name === name)?.rawValue;
}

function hasOnlyStaticOptimizationInputs(
  attributes: ParsedTagAttribute[]
): boolean {
  const validators: Array<[string, (rawValue: string) => boolean]> = [
    ['src', isStaticStringAttribute],
    ['width', isStaticNumberAttribute],
    ['height', isStaticNumberAttribute],
    ['layout', isStaticLayoutAttribute],
    ['sizes', isStaticStringAttribute],
    ['srcset', isStaticStringAttribute],
    ['placeholder', isStaticPlaceholderAttribute],
    ['quality', isStaticNumberAttribute],
  ];

  return validators.every(([name, validator]) => {
    const rawValue = getAttributeValue(attributes, name);
    return rawValue === undefined || validator(rawValue);
  });
}

function parseLayoutAttribute(rawValue?: string): ImageLayout | undefined {
  const value = parseStringAttribute(rawValue);
  if (value === 'fixed' || value === 'fluid' || value === 'responsive') {
    return value;
  }
  return undefined;
}

function parsePlaceholderAttribute(
  rawValue?: string
): ResolveImageTagOptions['placeholder'] | undefined {
  const value = parseStringAttribute(rawValue);
  if (value === 'blur' || value === 'none') {
    return value;
  }
  return undefined;
}

function parseStringAttribute(rawValue?: string): string | undefined {
  if (!rawValue) {
    return undefined;
  }

  const trimmed = rawValue.trim();
  const direct = decodeQuotedString(trimmed);
  if (direct !== undefined) {
    return direct;
  }

  const wrappedExpression = trimmed.match(/^\{\s*([\s\S]+)\s*\}$/);
  if (wrappedExpression) {
    return decodeQuotedString(wrappedExpression[1].trim());
  }

  return undefined;
}

function parseNumberAttribute(rawValue?: string): number | undefined {
  if (!rawValue) {
    return undefined;
  }

  const trimmed = rawValue.trim();
  const match = trimmed.match(/^\{\s*([-+]?\d+(?:\.\d+)?)\s*\}$|^([-+]?\d+(?:\.\d+)?)$/);
  const numericValue = match?.[1] ?? match?.[2];

  if (!numericValue) {
    const stringValue = parseStringAttribute(trimmed);
    if (!stringValue || stringValue.trim() === '') {
      return undefined;
    }
    const parsed = Number(stringValue);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  const parsed = Number(numericValue);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isStaticStringAttribute(rawValue: string): boolean {
  return parseStringAttribute(rawValue) !== undefined;
}

function isStaticNumberAttribute(rawValue: string): boolean {
  return parseNumberAttribute(rawValue) !== undefined;
}

function isStaticLayoutAttribute(rawValue: string): boolean {
  return parseLayoutAttribute(rawValue) !== undefined;
}

function isStaticPlaceholderAttribute(rawValue: string): boolean {
  return parsePlaceholderAttribute(rawValue) !== undefined;
}

function decodeQuotedString(value: string): string | undefined {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }

  if (value.startsWith('\'') && value.endsWith('\'')) {
    return value
      .slice(1, -1)
      .replace(/\\\\/g, '\\')
      .replace(/\\'/g, '\'')
      .replace(/\\"/g, '"');
  }

  return undefined;
}

function upsertAttribute(
  attributes: ParsedTagAttribute[],
  name: string,
  rawValue: string
): void {
  const existing = attributes.find((attribute) => attribute.name === name);
  if (existing) {
    existing.rawValue = rawValue;
    return;
  }

  attributes.push({ name, rawValue });
}

function serializeStringAttribute(value: string): string {
  return JSON.stringify(value);
}

function serializeAttribute(attribute: ParsedTagAttribute): string {
  if (!attribute.name) {
    return '';
  }

  if (attribute.rawValue === undefined) {
    return attribute.name;
  }

  return `${attribute.name}=${attribute.rawValue}`;
}

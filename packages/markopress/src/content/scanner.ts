/**
 * Content scanner for MarkoPress
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import fastGlob from 'fast-glob';
import type { ContentType, ContentFile, ContentScannerOptions, ContentManifest } from './types.js';
import type { MarkdownOptions } from '../markdown/types.js';
import { parseMarkdown } from '../markdown/index.js';

/**
 * Scan content directories for markdown files
 */
export async function scanContent(options: ContentScannerOptions): Promise<ContentManifest> {
  const { dirs, rootDir, markdownOptions } = options;
  const manifest: ContentManifest = {
    pages: [],
    docs: [],
    blog: [],
    all: [],
  };

  // Scan each content directory
  if (dirs.pages) {
    const pages = await scanDirectory(dirs.pages, 'page', rootDir, markdownOptions);
    manifest.pages.push(...pages);
    manifest.all.push(...pages);
  }

  if (dirs.docs) {
    const docs = await scanDirectory(dirs.docs, 'doc', rootDir, markdownOptions);
    manifest.docs.push(...docs);
    manifest.all.push(...docs);
  }

  if (dirs.blog) {
    const blog = await scanDirectory(dirs.blog, 'blog', rootDir, markdownOptions);
    manifest.blog.push(...blog);
    manifest.all.push(...blog);
  }

  return manifest;
}

/**
 * Scan a single directory for markdown files
 */
async function scanDirectory(
  dirPath: string,
  type: ContentType,
  rootDir: string,
  markdownOptions?: MarkdownOptions
): Promise<ContentFile[]> {
  const fullDirPath = path.resolve(rootDir, dirPath);

  try {
    await fs.access(fullDirPath);
  } catch {
    // Directory doesn't exist
    return [];
  }

  // Find all markdown files
  const pattern = path.join(fullDirPath, '**/*.md').replace(/\\/g, '/');
  const files = await fastGlob(pattern);

  const contentFiles: ContentFile[] = [];

  for (const filePath of files) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const processed = await parseMarkdown(content, markdownOptions, {
        rootDir,
        filePath,
      });

      // Skip draft posts
      if (processed.frontmatter.draft) {
        continue;
      }

      const relativePath = path.relative(rootDir, filePath);
      const urlPath = getUrlPath(relativePath, dirPath, type);

      contentFiles.push({
        id: generateId(relativePath),
        filePath,
        relativePath,
        type,
        urlPath,
        processed,
      });
    } catch (error) {
      console.error(`Failed to scan file: ${filePath}`, error);
    }
  }

  return contentFiles;
}

/**
 * Generate URL path from file path
 */
function getUrlPath(relativePath: string, contentDir: string, type: ContentType): string {
  // Remove content directory prefix
  let urlPath = relativePath.replace(contentDir, '');

  // Remove file extension
  urlPath = urlPath.replace(/\.md$/, '');

  // Handle index files
  if (urlPath.endsWith('/index')) {
    urlPath = urlPath.replace(/\/index$/, '') || '/';
  }

  // Add leading slash
  if (!urlPath.startsWith('/')) {
    urlPath = '/' + urlPath;
  }

  // Add prefix based on type
  if (type === 'doc' && !urlPath.startsWith('/docs')) {
    urlPath = '/docs' + urlPath;
  } else if (type === 'blog' && !urlPath.startsWith('/blog')) {
    urlPath = '/blog' + urlPath;
  }

  return urlPath;
}

/**
 * Generate unique ID from file path
 */
function generateId(filePath: string): string {
  return filePath
    .replace(/\.md$/, '')
    .replace(/[\/\\]/g, '-')
    .replace(/^-/, '');
}

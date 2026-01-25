/**
 * Content scanner for MarkoPress
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import fastGlob from 'fast-glob';
import type MarkdownIt from 'markdown-it';
import pLimit from 'p-limit';
import type { ContentType, ContentFile, ContentScannerOptions, ContentManifest } from './types.js';

/**
 * Concurrency limiter type (p-limit returns this)
 */
type Limit = <T>(fn: () => Promise<T>) => Promise<T>;
import type { MarkdownOptions } from '../markdown/types.js';
import type { ContentModule, ModuleMetadata } from './module.js';
import { createContentModule } from './module.js';
import { parseMarkdown } from '../markdown/index.js';

/**
 * Shared context for parallel content scanning
 */
export interface ScanContext {
  /** Concurrency limiter shared across all directories */
  limit: Limit;
  /** Shared MarkdownIt instance (lazy-loaded) */
  md: MarkdownIt | null;
  /** Promise for MarkdownIt creation (prevents race conditions) */
  mdPromise?: Promise<MarkdownIt>;
}

/**
 * Scan content directories for markdown files
 * Now uses dynamic module-based scanning
 */
export async function scanContent(options: ContentScannerOptions): Promise<ContentManifest> {
  const { dirs, rootDir, markdownOptions } = options;
  const manifest: ContentManifest = {} as ContentManifest;

  // Scan ALL configured directories dynamically
  for (const [moduleId, dirPath] of Object.entries(dirs)) {
    if (!dirPath) continue;

    // Determine content file type based on module ID
    const fileType = getFileType(moduleId);
    const files = await scanDirectory(dirPath, rootDir, markdownOptions, moduleId, fileType);
    manifest[moduleId] = files;
  }

  return manifest;
}

/**
 * Get content file type classification from module ID
 */
function getFileType(moduleId: string): 'page' | 'doc' | 'blog' | 'custom' {
  if (moduleId === 'pages') return 'page';
  if (moduleId === 'blog') return 'blog';
  if (moduleId === 'docs') return 'doc';
  return 'custom';
}

/**
 * Scan content modules for MarkoPress
 *
 * New module-based scanning approach. Each configured content directory
 * becomes a module that plugins can enhance.
 */
export async function scanContentModules(
  options: ContentScannerOptions,
  sharedContext?: ScanContext
): Promise<ContentModule[]> {
  const { dirs, rootDir, markdownOptions } = options;
  const modules: ContentModule[] = [];

  // Scan each configured content directory as a separate module
  for (const [key, dirPath] of Object.entries(dirs)) {
    if (!dirPath) continue;

    console.time(`Scanning ${key}`);
    const files = await scanDirectory(dirPath, rootDir, markdownOptions, key, undefined, sharedContext);
    console.timeEnd(`Scanning ${key}`);

    // Create module metadata
    const metadata: ModuleMetadata = {
      title: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize first letter
      description: `${key} content`,
    };

    // Create the module
    const module = createContentModule(
      key,
      dirPath,
      'collection',
      files,
      metadata
    );

    modules.push(module);
  }

  return modules;
}

/**
 * Scan a single directory for markdown files
 */
async function scanDirectory(
  dirPath: string,
  rootDir: string,
  markdownOptions?: MarkdownOptions,
  moduleId?: string,
  type?: 'page' | 'doc' | 'blog' | 'custom',
  sharedContext?: ScanContext
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

  // If no shared context, use sequential processing (backward compatibility)
  if (!sharedContext) {
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
        const urlPath = getUrlPath(relativePath, dirPath, moduleId);

        contentFiles.push({
          id: generateId(relativePath),
          filePath,
          relativePath,
          type,
          moduleId: moduleId || 'unknown',
          urlPath,
          processed,
        });
      } catch (error) {
        console.error(`Failed to scan file: ${filePath}`, error);
      }
    }
  } else {
    // Parallel processing with shared context
    const results = await Promise.allSettled(
      files.map((filePath) =>
        sharedContext.limit(async () => {
          const content = await fs.readFile(filePath, 'utf-8');

          // When markoTags are enabled, we cannot share MarkdownIt because
          // the tag validator needs the correct filePath for each file
          const shouldShareMd = !markdownOptions?.markoTags?.enabled;

          let sharedMd: MarkdownIt | undefined;
          if (shouldShareMd) {
            // Lazy-load MarkdownIt once across all files
            if (!sharedContext.md) {
              if (!sharedContext.mdPromise) {
                sharedContext.mdPromise = import('../markdown/index.js').then(
                  (m) => m.getMarkdownIt(markdownOptions, { rootDir, filePath })
                );
              }
              sharedContext.md = await sharedContext.mdPromise;
            }
            sharedMd = sharedContext.md;
          }

          const processed = await parseMarkdown(
            content,
            markdownOptions,
            { rootDir, filePath },
            sharedMd
          );

          // Skip draft posts
          if (processed.frontmatter.draft) {
            return null;
          }

          const relativePath = path.relative(rootDir, filePath);
          const urlPath = getUrlPath(relativePath, dirPath, moduleId);

          return {
            id: generateId(relativePath),
            filePath,
            relativePath,
            type,
            moduleId: moduleId || 'unknown',
            urlPath,
            processed,
          } as ContentFile | null;
        })
      )
    );

    // Collect successful results
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        contentFiles.push(result.value);
      } else if (result.status === 'rejected') {
        console.error(`File processing failed:`, result.reason);
      }
    }
  }

  return contentFiles;
}

/**
 * Generate URL path from file path
 */
function getUrlPath(relativePath: string, contentDir: string, moduleId?: string): string {
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

  // Add module ID prefix if provided
  // Special case: 'pages' module gets no prefix (root-level routes)
  if (moduleId && moduleId !== 'pages' && !urlPath.startsWith(`/${moduleId}`)) {
    urlPath = `/${moduleId}${urlPath}`;
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

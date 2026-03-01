/**
 * Sitemap generation for SEO plugin
 */

import { SitemapStream, streamToPromise } from 'sitemap';
import { promises as fs } from 'fs';
import { join } from 'path';

import type { ResolvedConfig } from '../../config/types.js';
import type { AllContent, RouteManifest } from '../../plugin/types.js';
import type { ContentFile } from '../../content/types.js';
import type { SitemapOptions, SitemapItem } from './types.js';

/**
 * Post-build context for sitemap generation
 */
interface PostBuildContext {
  config: ResolvedConfig;
  outDir: string;
  routes: RouteManifest;
  assets: string[];
  allContent: AllContent;
}

/**
 * Check if a URL path matches any exclusion patterns
 */
function isExcluded(urlPath: string, excludePatterns: string[]): boolean {
  for (const pattern of excludePatterns) {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(urlPath)) {
      return true;
    }
  }
  return false;
}

/**
 * Get file modification time for lastmod
 */
async function getFileModTime(filePath: string): Promise<Date | undefined> {
  try {
    const stats = await fs.stat(filePath);
    return stats.mtime;
  } catch (error) {
    // File might not exist or be inaccessible
    // Log warning but don't fail the build
    if (error instanceof Error) {
      console.warn(`[sitemap] Warning: could not get mtime for ${filePath}: ${error.message}`);
    }
    return undefined;
  }
}

/**
 * Resolve hostname from config or options
 */
function resolveHostname(config: ResolvedConfig, options?: SitemapOptions): string {
  // Priority: options.hostname > config.site.url
  if (options?.hostname) {
    return options.hostname;
  }

  // Note: site.url will be added to SiteConfig in Task 6
  // For now, access via type assertion to avoid breaking current build
  const siteConfig = config.site as { title: string; description?: string; base?: string; lang?: string; head?: unknown[]; url?: string };

  if (siteConfig.url) {
    return siteConfig.url;
  }

  throw new Error(
    'Sitemap hostname is required. Set site.url in config or provide hostname in sitemap options.'
  );
}

/**
 * Build a sitemap item from a route path
 */
async function buildSitemapItem(
  urlPath: string,
  allContent: AllContent
): Promise<SitemapItem> {
  const item: SitemapItem = {
    url: urlPath,
  };

  // Try to find matching content file for lastmod
  // Check all content types (pages, docs, posts, and custom modules)
  const pages = allContent.getPages();
  const docs = allContent.getDocs();
  const posts = allContent.getPosts();

  // Search through pages
  const pageMatch = pages.find((file) => file.urlPath === urlPath);
  if (pageMatch) {
    const modTime = await getFileModTime(pageMatch.filePath);
    if (modTime) {
      item.lastmod = modTime;
    }
    return item;
  }

  // Search through docs
  const docMatch = docs.find((file) => file.urlPath === urlPath);
  if (docMatch) {
    const modTime = await getFileModTime(docMatch.filePath);
    if (modTime) {
      item.lastmod = modTime;
    }
    return item;
  }

  // Search through posts
  const postMatch = posts.find((file) => file.urlPath === urlPath);
  if (postMatch) {
    const modTime = await getFileModTime(postMatch.filePath);
    if (modTime) {
      item.lastmod = modTime;
    }
    return item;
  }

  // No matching content file found
  return item;
}

/**
 * Generate sitemap.xml from routes
 *
 * @param ctx - Post-build context with config and routes
 * @param options - Sitemap generation options
 */
export async function generateSitemap(
  ctx: PostBuildContext,
  options: SitemapOptions = {}
): Promise<void> {
  const { config, outDir, allContent: content } = ctx;

  try {
    // Resolve hostname
    const hostname = resolveHostname(config, options);

    // Get base path for URL handling
    const base = config.site?.base || '/';

    // Default exclusion patterns
    const excludePatterns = options.exclude || ['/api/**', '/admin/**'];

    // Read static URLs from the build manifest
    // This includes all content routes, not just plugin-added routes
    // The file is at <project-root>/.markopress/src/.generated/static-urls.json
    const staticUrlsPath = join(config.root, '.markopress', 'src', '.generated', 'static-urls.json');
    let urlPaths: string[] = [];

    try {
      const staticUrlsContent = await fs.readFile(staticUrlsPath, 'utf-8');
      urlPaths = JSON.parse(staticUrlsContent);
    } catch (error) {
      // If static-urls.json doesn't exist, fall back to empty array
      // This shouldn't happen in normal builds, but we handle it gracefully
      console.warn('[sitemap] static-urls.json not found, sitemap may be incomplete');
    }

    // Build sitemap items from all static URLs
    const sitemapItems: SitemapItem[] = [];

    for (const urlPath of urlPaths) {
      // Skip excluded paths
      if (isExcluded(urlPath, excludePatterns)) {
        continue;
      }

      // Build full URL with hostname and base
      const fullUrl = `${hostname}${base}${urlPath.replace(/^\//, '')}`;

      const item = await buildSitemapItem(urlPath, content);
      item.url = fullUrl;

      sitemapItems.push(item);
    }

    // Allow user to transform items
    const finalItems = options.transformItems
      ? options.transformItems(sitemapItems)
      : sitemapItems;

    // Create sitemap stream
    const smStream = new SitemapStream({
      hostname,
      ...options.sitemapOptions,
    });

    // Write items to stream
    for (const item of finalItems) {
      smStream.write(item);
    }
    smStream.end();

    // Generate XML
    const xml = await streamToPromise(smStream).then((data) => data.toString());

    // Write to static output directory
    const outDir = ctx.outDir;
    const publicDir = join(outDir, 'public');
    const sitemapPath = join(publicDir, 'sitemap.xml');

    await fs.mkdir(publicDir, { recursive: true });
    await fs.writeFile(sitemapPath, xml, 'utf8');

    console.log(`[seo] Generated sitemap.xml with ${finalItems.length} URLs`);
  } catch (error) {
    // Don't throw - log error and continue
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[seo] Failed to generate sitemap: ${message}`);
  }
}

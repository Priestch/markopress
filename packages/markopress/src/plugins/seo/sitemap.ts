/**
 * Sitemap generation for SEO plugin
 */

import { SitemapStream, streamToPromise } from 'sitemap';
import { promises as fs } from 'fs';
import { join } from 'path';

import type { ResolvedConfig } from '../../config/types.js';
import type { BuildContext, ContentManifest } from '../../plugin/types.js';
import type { SitemapOptions, SitemapItem } from './types.js';

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
  allContent: ContentManifest,
  contentDir: string
): Promise<SitemapItem> {
  const item: SitemapItem = {
    url: urlPath,
  };

  // Try to find matching content file for lastmod
  for (const moduleId in allContent) {
    const files = allContent[moduleId];
    const match = files.find((file) => file.urlPath === urlPath);

    if (match) {
      const modTime = await getFileModTime(match.filePath);
      if (modTime) {
        item.lastmod = modTime;
      }
      break;
    }
  }

  return item;
}

/**
 * Generate sitemap.xml from routes
 *
 * @param ctx - Build context with config and routes
 * @param options - Sitemap generation options
 */
export async function generateSitemap(
  ctx: BuildContext,
  options: SitemapOptions = {}
): Promise<void> {
  const { config, routes, content } = ctx;

  try {
    // Resolve hostname
    const hostname = resolveHostname(config, options);

    // Get base path for URL handling
    const base = config.site.base || '/';

    // Default exclusion patterns
    const excludePatterns = options.exclude || ['/api/**', '/admin/**'];

    // Build sitemap items from routes
    const sitemapItems: SitemapItem[] = [];

    for (const routePath in routes) {
      const route = routes[routePath];

      // Skip excluded paths
      if (isExcluded(routePath, excludePatterns)) {
        continue;
      }

      // Build full URL with hostname and base
      const fullUrl = `${hostname}${base}${routePath.replace(/^\//, '')}`;

      const item = await buildSitemapItem(routePath, content, config.contentDir);
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

    // Write to output directory
    const outDir = config.build.outDir || 'dist';
    const sitemapPath = join(config.root, outDir, 'sitemap.xml');

    await fs.mkdir(join(config.root, outDir), { recursive: true });
    await fs.writeFile(sitemapPath, xml, 'utf8');

    ctx.utils.log(`Generated sitemap.xml with ${finalItems.length} URLs`);
  } catch (error) {
    // Don't throw - log error and continue
    const message = error instanceof Error ? error.message : String(error);
    ctx.utils.error(`Failed to generate sitemap: ${message}`);
  }
}

/**
 * Robots.txt generation for SEO plugin
 */

import { promises as fs } from 'fs';
import { join } from 'path';

import type { ResolvedConfig } from '../../config/types.js';
import type { SitemapOptions, RobotsOptions } from './types.js';

/**
 * Post-build context for robots generation
 */
interface PostBuildContext {
  config: ResolvedConfig;
  outDir: string;
  routes: Record<string, unknown>;
  assets: unknown[];
  allContent: unknown;
}

/**
 * Resolve hostname from config or sitemap options
 */
function resolveHostname(config: ResolvedConfig, sitemapOptions?: SitemapOptions): string {
  if (sitemapOptions?.hostname) {
    return sitemapOptions.hostname;
  }

  const siteConfig = config.site as { title: string; url?: string };
  if (siteConfig.url) {
    return siteConfig.url;
  }

  throw new Error(
    'Robots hostname is required. Set site.url in config or provide hostname in sitemap/robots options.'
  );
}

/**
 * Normalize user-agent config into an array
 */
function normalizeUserAgents(userAgent: RobotsOptions['userAgent']): string[] {
  if (!userAgent) {
    return ['*'];
  }

  return Array.isArray(userAgent)
    ? userAgent.filter(Boolean)
    : [userAgent];
}

/**
 * Normalize rules list and ensure deterministic ordering
 */
function normalizeRules(rules?: string[]): string[] {
  if (!rules || rules.length === 0) {
    return [];
  }

  return [...new Set(rules.map((rule) => rule.trim()).filter(Boolean))];
}

/**
 * Build sitemap URL for robots.txt
 */
function resolveSitemapUrl(
  config: ResolvedConfig,
  robotsOptions?: RobotsOptions,
  sitemapOptions?: SitemapOptions
): string | undefined {
  if (robotsOptions?.sitemap) {
    const base = (config.site?.base || '/').replace(/\/$/, '');
    const rawSitemap = robotsOptions.sitemap.trim();
    if (rawSitemap.startsWith('http://') || rawSitemap.startsWith('https://')) {
      return rawSitemap;
    }

    const normalizedPath = rawSitemap.startsWith('/')
      ? rawSitemap
      : `/${rawSitemap}`;

    let hostname: string | undefined;
    try {
      hostname = resolveHostname(config, sitemapOptions);
    } catch {
      // If hostname is not configured, fall back to root-relative path only.
      return base && base !== '/'
        ? `${base}${normalizedPath}`
        : normalizedPath;
    }

    if (!base || base === '/') {
      return `${hostname}${normalizedPath}`;
    }

    return `${hostname}${base}${normalizedPath}`;
  }

  // Only include a generated sitemap reference when sitemap options are also configured.
  if (!sitemapOptions) {
    return undefined;
  }

  const hostname = resolveHostname(config, sitemapOptions).replace(/\/$/, '');
  const base = (config.site?.base || '/').replace(/\/$/, '');
  const sitemapPath = '/sitemap.xml';

  return `${hostname}${base && base !== '/' ? `${base}${sitemapPath}` : sitemapPath}`;
}

/**
 * Generate robots.txt from seo robots options
 */
export async function generateRobots(
  ctx: PostBuildContext,
  options: RobotsOptions = {},
  sitemapOptions?: SitemapOptions
): Promise<void> {
  const { config, outDir } = ctx;

  try {
    const publicDir = join(outDir, 'public');
    await fs.mkdir(publicDir, { recursive: true });

    const userAgents = normalizeUserAgents(options.userAgent);
    const allowRules = normalizeRules(options.allow);
    const disallowRules = normalizeRules(options.disallow);

    const lines: string[] = [];

    for (const agent of userAgents) {
      lines.push(`User-agent: ${agent}`);

      for (const rule of allowRules) {
        lines.push(`Allow: ${rule}`);
      }

      for (const rule of disallowRules) {
        lines.push(`Disallow: ${rule}`);
      }

      if (typeof options.crawlDelay === 'number') {
        lines.push(`Crawl-delay: ${options.crawlDelay}`);
      }

      lines.push('');
    }

    const sitemap = resolveSitemapUrl(config, options, sitemapOptions);
    if (sitemap) {
      lines.push(`Sitemap: ${sitemap}`);
    }

    // Trim trailing blank line for a cleaner output
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    const robotsPath = join(publicDir, 'robots.txt');
    const content = lines.length > 0 ? `${lines.join('\n')}\n` : 'User-agent: *\n';
    await fs.writeFile(robotsPath, content, 'utf8');

    console.log('[seo] Generated robots.txt');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[seo] Failed to generate robots.txt: ${message}`);
  }
}

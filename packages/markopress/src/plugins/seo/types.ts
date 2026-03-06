import type { MarkoPressPlugin } from '../../plugin/types.js';

/**
 * Sitemap item following sitemaps.org protocol
 */
export interface SitemapItem {
  url: string;
  lastmod?: string | Date;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

/**
 * Sitemap generation options
 */
export interface SitemapOptions {
  /**
   * Hostname for sitemap URLs
   * Falls back to config.site.url if not provided
   */
  hostname?: string;

  /**
   * Glob patterns to exclude from sitemap
   * @default ['/api/**', '/admin/**']
   */
  exclude?: string[];

  /**
   * Transform sitemap items before writing
   * Use for adding external URLs, modifying priorities, etc.
   */
  transformItems?: (items: SitemapItem[]) => SitemapItem[];

  /**
   * Options passed to `sitemap` npm package
   */
  sitemapOptions?: {
    lastmodDateOnly?: boolean;
  };
}

export interface RobotsOptions {
  /**
   * User agent(s) to apply rules to
   * @default ['*']
   */
  userAgent?: string | string[];

  /**
   * Allowed paths for matching user agents
   */
  allow?: string[];

  /**
   * Disallowed paths for matching user agents
   */
  disallow?: string[];

  /**
   * Optional crawl delay in seconds
   */
  crawlDelay?: number;

  /**
   * Explicit sitemap URL to reference in robots.txt
   * If not provided, generated from site.url / sitemap config when available
   */
  sitemap?: string;
}

/**
 * SEO plugin configuration
 */
export interface SeoPluginConfig {
  sitemap?: SitemapOptions;
  robots?: RobotsOptions;
}

/**
 * Plugin factory options
 */
export interface SeoPluginFactoryOptions {
  sitemap?: SitemapOptions;
  robots?: RobotsOptions;
}

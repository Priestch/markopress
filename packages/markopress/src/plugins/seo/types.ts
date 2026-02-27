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

/**
 * SEO plugin configuration
 */
export interface SeoPluginConfig {
  sitemap?: SitemapOptions;
}

/**
 * Plugin factory options
 */
export interface SeoPluginFactoryOptions {
  sitemap?: SitemapOptions;
}

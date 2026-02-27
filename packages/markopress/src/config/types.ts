/**
 * Configuration types for MarkoPress
 */

import type { SeoPluginConfig } from '../plugins/seo/types.js';

export interface SiteConfig {
  title: string;
  description?: string;
  base?: string;
  lang?: string;
  head?: HeadTag[];
}

export type HeadTag = (string | Record<string, string>)[];

/**
 * Module-specific options
 *
 * @example
 * // Enable TOC for guides module only
 * { guides: { dir: 'content/guides', toc: true } }
 */
export interface ModuleOptions {
  /**
   * Directory path for this module (relative to project root)
   * Defaults to `content/{moduleId}` if not specified
   */
  dir?: string;

  /**
   * Enable table of contents extraction for this module
   *
   * When enabled, markdown headers are extracted during scanning and
   * stored for use by the TOC plugin. Set to `true` only for modules
   * where you want TOC generation.
   *
   * @default false (TOC is not extracted unless explicitly enabled)
   */
  toc?: boolean;

  /** Module type override */
  type?: 'page' | 'doc' | 'blog' | 'custom';
}

export interface ContentFeatureOptions {
  sidebar?: boolean;
  rss?: boolean;
  list?: boolean;
  toc?: boolean;
}

export type ContentDirectoryConfig = ContentFeatureOptions;

export interface NewContentConfig {
  [directory: string]: ContentDirectoryConfig;
}

/**
 * Content module configuration
 *
 * Supports any number of named modules (e.g., pages, guides, docs, blog, tutorials, etc.)
 *
 * @example
 * // Simple form - string directory path
 * content: {
 *   pages: 'content/pages',
 *   docs: 'content/docs',
 * }
 *
 * @example
 * // Extended form - with options
 * content: {
 *   pages: 'content/pages',                      // Simple path, no TOC
 *   guides: { dir: 'content/guides', toc: true }, // Enable TOC for guides
 *   blog: 'content/blog',                        // Simple path, no TOC
 * }
 *
 * @migration-guide
 * Before: content was a strict interface with only `pages`, `docs`, `blog` keys
 * After: content is a flexible Record that accepts any module name
 *
 * The `highlightLanguages` markdown option has been removed.
 * Languages are now loaded automatically based on actual usage (lazy loading).
 */
export type ContentConfig = Record<string, string | ModuleOptions | undefined>;

/**
 * Navigation link item
 */
export interface NavItem {
  text: string;
  link: string;
}

/**
 * Sidebar configuration
 */
export interface SidebarConfig {
  [path: string]: SidebarItem[] | { autoGenerate: boolean };
}

/**
 * Sidebar item
 */
export interface SidebarItem {
  text: string;
  link: string;
}

/**
 * Theme options for default theme
 */
export interface ThemeOptions {
  /** Visual style: 'default' (plain), 'vitepress' (indigo, compact), or 'docusaurus' (blue, spacious) */
  style?: 'default' | 'vitepress' | 'docusaurus';
  navbar?: NavItem[];
  sidebar?: SidebarConfig;
  [key: string]: unknown;
}

export interface ThemeConfig {
  name?: string;
  designSystem?: string;
  options?: ThemeOptions;
}

export interface MarkdownConfig {
  lineNumbers?: boolean;

  theme?: {
    light?: string;
    dark?: string;
  };

  /**
   * Marko tags support
   */
  markoTags?: {
    /** Enable Marko tags in markdown (default: false) */
    enabled?: boolean;

    /** Directory containing Marko component files (default: '.markopress/tags') */
    tagsDir?: string;
  };
}

export interface BuildConfig {
  useCatchAllRoutes?: boolean;
  outDir?: string;
  assetsDir?: string;
}

export interface SearchConfig {
  /** Enable search (default: true) */
  enabled?: boolean;
  /** Exclude pages from search by path pattern */
  exclude?: string[];
  /** Minisearch options */
  minisearch?: {
    fuzzy?: number;
    prefix?: boolean;
    boost?: {
      title?: number;
      titles?: number;
      text?: number;
    };
  };
}

export interface MarkoPressConfig {
  site: SiteConfig;
  contentDir?: string;
  content?: NewContentConfig;
  theme?: ThemeConfig;
  markdown?: MarkdownConfig;
  build?: BuildConfig;
  search?: SearchConfig;
  seo?: SeoPluginConfig;
  plugins?: (string | PluginConfig)[];
}

export interface PluginConfig {
  name: string;
  options?: Record<string, unknown>;
}

export interface UserConfig extends MarkoPressConfig {}

export interface ResolvedConfig extends Omit<Required<Omit<MarkoPressConfig, 'contentDir' | 'seo'>>, 'root'> {
  root: string;
  contentDir: string;
  content: NewContentConfig;
  build: BuildConfig;
  seo?: SeoPluginConfig;
}

export type ConfigFn = (env: ConfigEnv) => UserConfig | Promise<UserConfig>;

export interface ConfigEnv {
  mode: 'development' | 'production';
  command: 'dev' | 'build' | 'preview';
}

export type UserConfigExport = UserConfig | ConfigFn | Promise<UserConfig>;

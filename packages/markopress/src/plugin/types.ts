/**
 * Plugin system types
 */

import type MarkdownIt from 'markdown-it';
import type { ResolvedConfig } from '../config/index.js';
import type { ProcessedMarkdown } from '../markdown/index.js';
import type { ContentFile } from '../content/types.js';
import type { ContentManifest as SystemContentManifest } from '../content/types.js';
import type { ContentModule } from '../content/registry.js';

/**
 * Route configuration for plugin-generated routes
 */
export interface RouteConfig {
  path: string;
  component?: string;
  handler?: string;
  layout?: string;
  meta?: Record<string, unknown>;
  modules?: Record<string, unknown>;
}

/**
 * Content loaded by a plugin
 * Supports dynamic module-based content
 */
export type PluginContent = {
  // Backward compatibility collections
  pages?: ContentFile[];
  docs?: ContentFile[];
  blog?: ContentFile[];
  // Dynamic module collections - any module ID can be used
  [moduleId: string]: ContentFile[] | undefined;
};

/**
 * All content from all plugins
 */
export interface AllContent {
  getPages(): ContentFile[];
  getDocs(): ContentFile[];
  getPosts(): ContentFile[];
  getContent(type: string): unknown[];
}

/**
 * Actions available to plugins during content processing
 */
export interface ContentActions {
  addRoute(route: RouteConfig): void;
  addData(key: string, value: unknown): void;
  getRoute(path: string): RouteConfig | undefined;
  getAllRoutes(): RouteConfig[];
  getData(): Map<string, unknown>;
}

/**
 * Plugin hook context
 */
export interface PluginContext {
  config: ResolvedConfig;
  utils: {
    log: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

/**
 * Build context for build hooks
 */
export interface BuildContext extends PluginContext {
  content: ContentManifest;
  routes: RouteManifest;
}

/**
 * Content manifest for all loaded content
 * Alias to system content manifest for plugin compatibility
 */
export type ContentManifest = SystemContentManifest;

/**
 * Route manifest for generated routes
 */
export interface RouteManifest {
  [path: string]: RouteData;
}

/**
 * Page data from markdown files
 * Extends ContentFile for backward compatibility
 */
export interface PageData extends ContentFile {
  content: string;
  html: string;
  headers: ProcessedMarkdown['headers'];
  excerpt?: string;
}

/**
 * Blog post data
 */
export interface PostData extends PageData {
  date: Date;
  author?: string;
  tags?: string[];
  categories?: string[];
}

/**
 * Route data
 */
export interface RouteData {
  path: string;
  component?: string;
  layout?: string;
  meta?: Record<string, unknown>;
}

/**
 * Content loading context
 */
export interface ContentContext extends PluginContext {
  addPage: (page: ContentFile) => void;
  addPost: (post: ContentFile) => void;
  getPages: () => ContentFile[];
  getPosts: () => ContentFile[];
}

/**
 * Enhanced MarkoPress plugin interface with full lifecycle hooks
 */
export interface MarkoPressPlugin {
  name: string;

  // Plugin dependencies (optional array of plugin names that must load before this plugin)
  dependencies?: string[];

  // === NEW: Module enhancement hook ===
  /**
   * Declare which modules this plugin works with
   * If specified, plugin will only receive these modules in enhanceModules
   */
  modules?: string[];

  /**
   * Enhance content modules with metadata and features
   * Called after content scanning, before route generation
   * Multiple plugins can enhance the same module (composability)
   */
  enhanceModules?(modules: ContentModule[]): Promise<void> | void;

  // === NEW: Content loading hook ===
  /**
   * Load custom content from external sources
   * Called before contentLoaded, allows plugins to fetch/scan content
   */
  loadContent?(): Promise<PluginContent | null>;

  // === ENHANCED: Content processing hook ===
  /**
   * Process content after all plugins have loaded
   * Enhanced with actions object for route/data management
   */
  contentLoaded?(ctx: {
    content: PluginContent;
    allContent: AllContent;
    actions: ContentActions;
  }): Promise<void> | void;

  // === NEW: Global processing hook ===
  /**
   * Called after all plugins have processed their content
   * Perfect for cross-plugin operations, generating aggregate pages
   */
  allContentLoaded?(ctx: {
    allContent: AllContent;
    routes: RouteManifest;
    actions: ContentActions;
  }): Promise<void> | void;

  // === NEW: Post-build hook ===
  /**
   * Called after build completes successfully
   * Perfect for generating sitemaps, RSS feeds, optimizing assets
   */
  postBuild?(ctx: {
    outDir: string;
    routes: RouteManifest;
    assets: string[];
    allContent: AllContent;
  }): Promise<void> | void;

  // === EXISTING: Keep for backward compatibility ===
  config?: (config: ResolvedConfig) => ResolvedConfig | Promise<ResolvedConfig>;

  // === DEPRECATED: beforeBuild (kept for compatibility) ===
  /**
   * @deprecated Use allContentLoaded instead
   */
  beforeBuild?: (ctx: BuildContext) => void | Promise<void>;

  /**
   * @deprecated Use postBuild instead
   */
  afterBuild?: (ctx: BuildContext) => void | Promise<void>;

  extendMarkdown?: (md: MarkdownIt) => void | Promise<void>;
  extendRoutes?: (routes: RouteManifest) => RouteManifest | Promise<RouteManifest>;
}

/**
 * Plugin configuration
 */
export type PluginConfig = string | [string, Record<string, unknown>] | MarkoPressPlugin;

/**
 * Plugin system types
 */

import type MarkdownIt from 'markdown-it';
import type { ResolvedConfig } from '../config/index.js';
import type { ProcessedMarkdown } from '../markdown/index.js';

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
 */
export interface ContentManifest {
  pages: PageData[];
  docs: PageData[];
  blog: PostData[];
}

/**
 * Route manifest for generated routes
 */
export interface RouteManifest {
  [path: string]: RouteData;
}

/**
 * Page data from markdown files
 */
export interface PageData {
  id: string;
  filePath: string;
  routePath: string;
  frontmatter: Record<string, unknown>;
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
  addPage: (page: PageData) => void;
  addPost: (post: PostData) => void;
  getPages: () => PageData[];
  getPosts: () => PostData[];
}

/**
 * MarkoPress plugin interface
 */
export interface MarkoPressPlugin {
  name: string;

  // Config hooks
  config?: (config: ResolvedConfig) => ResolvedConfig | Promise<ResolvedConfig>;

  // Content hooks
  contentLoaded?: (ctx: ContentContext) => void | Promise<void>;

  // Build hooks
  beforeBuild?: (ctx: BuildContext) => void | Promise<void>;
  afterBuild?: (ctx: BuildContext) => void | Promise<void>;

  // Markdown hooks
  extendMarkdown?: (md: MarkdownIt) => void | Promise<void>;

  // Route hooks
  extendRoutes?: (routes: RouteManifest) => RouteManifest | Promise<RouteManifest>;
}

/**
 * Plugin configuration
 */
export type PluginConfig = string | [string, Record<string, unknown>] | MarkoPressPlugin;

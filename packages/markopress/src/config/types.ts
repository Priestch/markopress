/**
 * Configuration types for MarkoPress
 */

export interface SiteConfig {
  title: string;
  description?: string;
  base?: string;
  lang?: string;
  head?: HeadTag[];
}

export type HeadTag =
  | [string, Record<string, string>]
  | [string, Record<string, string>, string];

/**
 * Content module configuration
 * Can have any number of named modules (e.g., pages, guides, docs, blog, tutorials, etc.)
 */
export interface ContentConfig {
  pages?: string;  // Special: pages module gets no URL prefix (root-level routes)
  docs?: string;   // Optional: legacy 'docs' module name
  blog?: string;   // Special: blog module with date-based sorting
  // Any other module names are supported (e.g., guides, tutorials, etc.)
  [key: string]: string | undefined;
}

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

    /** Directory containing Marko component files (default: 'tags/') */
    tagsDir?: string;
  };
}

export interface BuildConfig {
  useCatchAllRoutes?: boolean;
  outDir?: string;
  assetsDir?: string;
}

export interface MarkoPressConfig {
  site: SiteConfig;
  content?: ContentConfig;
  theme?: ThemeConfig;
  markdown?: MarkdownConfig;
  build?: BuildConfig;
  plugins?: (string | PluginConfig)[];
}

export interface PluginConfig {
  name: string;
  options?: Record<string, unknown>;
}

export interface UserConfig extends MarkoPressConfig {}

export interface ResolvedConfig extends Required<MarkoPressConfig> {
  root: string;
  content: ContentConfig;  // All properties are optional, allows any module name
  build: BuildConfig;  // All properties are optional, allows custom build options
}

export type ConfigFn = (env: ConfigEnv) => UserConfig | Promise<UserConfig>;

export interface ConfigEnv {
  mode: 'development' | 'production';
  command: 'dev' | 'build' | 'preview';
}

export type UserConfigExport = UserConfig | ConfigFn | Promise<UserConfig>;

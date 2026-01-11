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

export interface ContentConfig {
  pages?: string;
  docs?: string;
  blog?: string;
}

export interface ThemeConfig {
  name?: string;
  options?: Record<string, unknown>;
}

export interface MarkdownConfig {
  lineNumbers?: boolean;
  theme?: {
    light?: string;
    dark?: string;
  };
}

export interface BuildConfig {
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
  content: Required<ContentConfig>;
  build: Required<BuildConfig>;
}

export type ConfigFn = (env: ConfigEnv) => UserConfig | Promise<UserConfig>;

export interface ConfigEnv {
  mode: 'development' | 'production';
  command: 'dev' | 'build' | 'preview';
}

export type UserConfigExport = UserConfig | ConfigFn | Promise<UserConfig>;

/**
 * Configuration loader for MarkoPress
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { ZodError } from 'zod';
import { validateConfigSafe } from './validation.js';
import type {
  UserConfig,
  ResolvedConfig,
  ConfigEnv,
  HeadTag,
} from './types.js';

const DEFAULT_CONFIG: Omit<ResolvedConfig, 'root'> = {
  site: {
    title: 'MarkoPress Site',
    description: '',
    base: '/',
    lang: 'en-US',
    head: [],
  },
  contentDir: 'content',
  content: {
    docs: { sidebar: true },
    blog: { rss: true, list: true },
  },
  theme: {
    name: '@markopress/theme-default',
    options: {},
  },
  markdown: {
    lineNumbers: false,
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
  build: {
    useCatchAllRoutes: true,
    outDir: 'dist',
    assetsDir: 'assets',
  },
  search: {
    enabled: true,
  },
  plugins: [],
};

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (sourceValue === undefined) {
      continue;
    }

    if (isObject(targetValue) && isObject(sourceValue)) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      result[key] = sourceValue as any;
    }
  }

  return result;
}

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validate configuration using Zod schema
 * @returns Validated configuration or errors
 */
function validateConfig(config: UserConfig): { valid: boolean; errors: string[]; data?: UserConfig } {
  const result = validateConfigSafe(config);

  if (!result.success) {
    return {
      valid: false,
      errors: result.errors.map((err: { path: string; message: string }) => `${err.path}: ${err.message}`),
    };
  }

  return {
    valid: true,
    errors: [],
    data: result.data as UserConfig, // Cast to UserConfig to handle Zod's passthrough index signature
  };
}

/**
 * Find and load the configuration file
 */
export async function loadConfigFromFile(
  root: string,
  env: ConfigEnv
): Promise<{ file: string; config: UserConfig } | null> {
  // Check for config files at the root level
  // When root is already the app root (e.g., website/.markopress), look for config.*
  // When root is the project root (e.g., website/), look for .markopress/config.*
  const configFiles = [
    'config.ts',
    'config.js',
    'config.mjs',
    '.markopress/config.ts',
    '.markopress/config.js',
    '.markopress/config.mjs',
  ];

  for (const file of configFiles) {
    const filePath = path.resolve(root, file);
    try {
      await fs.access(filePath);

      // Use pathToFileURL for better cross-platform support
      const fileUrl = pathToFileURL(filePath).href;

      // Add timestamp to bypass module cache during development
      const importUrl = `${fileUrl}?t=${Date.now()}`;

      const configModule = await import(importUrl);
      const configExport = configModule.default;

      if (!configExport) {
        throw new Error(`Config file ${file} must have a default export`);
      }

      let config: UserConfig;
      if (typeof configExport === 'function') {
        config = await (configExport as (env: ConfigEnv) => UserConfig | Promise<UserConfig>)(env);
      } else {
        config = configExport;
      }

      // Validate the loaded config
      const validation = validateConfig(config);

      if (!validation.valid) {
        throw new Error(
          `Invalid configuration in ${file}:\n${validation.errors.map((e) => `  - ${e}`).join('\n')}`
        );
      }

      console.log(`✓ Loaded config from ${file}`);
      return { file: filePath, config: validation.data! };
    } catch (error: any) {
      // Only throw if file exists but failed to load/parse
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        throw new Error(
          `Failed to load config from ${file}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      // File doesn't exist, continue to next option
    }
  }

  return null;
}

/**
 * Resolve the configuration with defaults
 */
export function resolveConfig(
  userConfig: UserConfig,
  root: string
): ResolvedConfig {
  // For content and build, use user config directly if provided, otherwise use defaults
  // This allows arbitrary module names (not just pages/docs/blog) and custom build options
  const content = userConfig.content ? { ...userConfig.content } : DEFAULT_CONFIG.content;
  const build = userConfig.build ? { ...userConfig.build } : DEFAULT_CONFIG.build;

  // Use deep merge for other nested configurations
  const site = deepMerge(DEFAULT_CONFIG.site, userConfig.site || {});
  const theme = deepMerge(DEFAULT_CONFIG.theme, userConfig.theme || {});
  const markdown = deepMerge(DEFAULT_CONFIG.markdown, userConfig.markdown || {});
  const search = deepMerge(DEFAULT_CONFIG.search, userConfig.search || {});

  // Plugins need special handling - don't merge, just replace
  const plugins = userConfig.plugins || DEFAULT_CONFIG.plugins;

  // Add theme CSS based on style option
  const style = (theme.options?.style as 'default' | 'vitepress' | 'docusaurus') || 'default';
  const base = (site.base || '/').replace(/\/$/, '');
  const themeCssPath = `${base}/_markopress/theme/theme-${style}.css`;

  // Inject theme CSS link into head
  const themeCssHeadTag: HeadTag = ['link', {
    rel: 'stylesheet',
    href: themeCssPath,
  }];

  site.head = [...(site.head || []), themeCssHeadTag];

  const contentDir = userConfig.contentDir ?? DEFAULT_CONFIG.contentDir;

  return {
    root,
    site,
    contentDir,
    content,
    theme,
    markdown,
    build,
    search,
    plugins,
  };
}

/**
 * Load the configuration from a directory
 */
export async function loadConfig(
  root: string = process.cwd(),
  env: ConfigEnv = { mode: 'development', command: 'dev' }
): Promise<ResolvedConfig> {
  const loaded = await loadConfigFromFile(root, env);

  if (!loaded) {
    // Return default config if no config file found
    return resolveConfig({ site: DEFAULT_CONFIG.site }, root);
  }

  return resolveConfig(loaded.config, root);
}

/**
 * Define configuration helper with type safety
 */
export function defineConfig(config: UserConfig): UserConfig {
  return config;
}

export function defineConfigWithCallback(
  config: (env: ConfigEnv) => UserConfig | Promise<UserConfig>
): (env: ConfigEnv) => UserConfig | Promise<UserConfig> {
  return config;
}

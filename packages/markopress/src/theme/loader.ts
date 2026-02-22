/**
 * Theme loader for MarkoPress
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { ThemeConfig, ResolvedTheme } from './types.js';

const THEME_LOADER_DIR = path.dirname(fileURLToPath(import.meta.url));
const MARKOPRESS_PACKAGE_ROOT = path.resolve(THEME_LOADER_DIR, '..', '..');
const INTERNAL_DEFAULT_THEME_ROOT = path.join(MARKOPRESS_PACKAGE_ROOT, 'src', 'theme', 'default');
const INTERNAL_DEFAULT_THEME_NAMES = new Set([
  '@markopress/theme-default',
  'theme-default',
  'default',
]);

/**
 * Default theme configuration
 */
const DEFAULT_THEME: ThemeConfig = {
  name: '@markopress/theme-default',
  layouts: {
    home: 'layouts/home-page.marko',
    page: 'layouts/page.marko',
    docs: 'layouts/docs.marko',
    blog: 'layouts/blog.marko',
    content: 'layouts/content-page.marko',
  },
  slots: {},
  styles: ['styles.css'],
};

/**
 * Load theme from package name or local directory
 */
export async function loadTheme(
  themeName: string,
  rootDir: string
): Promise<ResolvedTheme> {
  let themeRoot: string;

  // Internal default theme is bundled with markopress package.
  if (INTERNAL_DEFAULT_THEME_NAMES.has(themeName)) {
    themeRoot = INTERNAL_DEFAULT_THEME_ROOT;
  } else if (themeName.startsWith('./') || themeName.startsWith('../') || path.isAbsolute(themeName)) {
    // Check if it's a local theme
    themeRoot = path.resolve(rootDir, themeName);
  } else {
    // Load from node_modules
    themeRoot = path.resolve(rootDir, 'node_modules', themeName);
  }

  // Try to load theme config
  const themeConfigPath = path.join(themeRoot, 'theme.config.js');
  let themeConfig: Partial<ThemeConfig> = {};

  try {
    await fs.access(themeConfigPath);
    const module = await import(themeConfigPath);
    themeConfig = module.default || {};
  } catch {
    // Use default config
  }

  // Merge with defaults
  const theme: ResolvedTheme = {
    ...DEFAULT_THEME,
    ...themeConfig,
    rootDir: themeRoot,
  };

  return theme;
}

/**
 * Load theme with user overrides
 */
export async function loadThemeWithOverrides(
  themeName: string,
  rootDir: string,
  overridesDir?: string
): Promise<ResolvedTheme> {
  const theme = await loadTheme(themeName, rootDir);

  if (!overridesDir) {
    return theme;
  }

  // Check for override layouts
  const overridePath = path.resolve(rootDir, overridesDir);
  const layoutsPath = path.join(overridePath, 'layouts');

  try {
    await fs.access(layoutsPath);
    const layouts = await fs.readdir(layoutsPath);
    const overrides: Record<string, string> = {};

    for (const layout of layouts) {
      const key = path.basename(layout, path.extname(layout));
      overrides[key] = path.join(layoutsPath, layout);
    }

    theme.overrides = overrides as any;
  } catch {
    // No overrides
  }

  return theme;
}

/**
 * Get layout component path
 */
export function getLayoutPath(
  theme: ResolvedTheme,
  layoutName: keyof ThemeConfig['layouts']
): string | null {
  // Check overrides first
  if (theme.overrides && theme.overrides[layoutName]) {
    return theme.overrides[layoutName];
  }

  // Use theme default
  const layout = theme.layouts[layoutName];
  if (!layout) {
    return null;
  }

  return path.join(theme.rootDir, layout);
}

/**
 * Get slot component path
 */
export function getSlotPath(theme: ResolvedTheme, slotName: string): string | null {
  const slot = theme.slots[slotName];
  if (!slot || !slot.component) {
    return null;
  }

  return path.join(theme.rootDir, slot.component);
}

/**
 * Theme loader for MarkoPress
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import type { ThemeConfig, ResolvedTheme } from './types.js';

/**
 * Default theme configuration
 */
const DEFAULT_THEME: ThemeConfig = {
  name: '@markopress/theme-default',
  layouts: {
    home: 'layouts/home.marko',
    page: 'layouts/page.marko',
    docs: 'layouts/docs.marko',
    blog: 'layouts/blog.marko',
    post: 'layouts/post.marko',
    tag: 'layouts/tag.marko',
    category: 'layouts/category.marko',
  },
  slots: {
    header: { component: 'components/header.marko' },
    footer: { component: 'components/footer.marko' },
    sidebar: { component: 'components/sidebar.marko' },
    toc: { component: 'components/toc.marko' },
    nav: { component: 'components/nav.marko' },
  },
  styles: ['styles/main.css'],
};

/**
 * Load theme from package name or local directory
 */
export async function loadTheme(
  themeName: string,
  rootDir: string
): Promise<ResolvedTheme> {
  let themeRoot: string;

  // Check if it's a local theme
  if (themeName.startsWith('./') || themeName.startsWith('../') || path.isAbsolute(themeName)) {
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

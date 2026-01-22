/**
 * MarkoPress - A general-purpose static site generator using Marko.js v6
 */

// Core exports
export * from './config/index.js';
export * from './markdown/index.js';
export { PluginManager } from './plugin/index.js';
export * from './content/index.js';
export * from './vite/index.js';

// Theme exports with renaming to avoid conflicts
export {
  type ThemeConfig as ThemeThemeConfig,
  type ResolvedTheme,
  type ThemeOptions,
  loadTheme,
  loadThemeWithOverrides,
  getLayoutPath,
  getSlotPath,
} from './theme/index.js';

// Build exports (for programmatic use)
export * from './build/index.js';
export * from './preview/index.js';
export * from './dev/index.js';

// Note: CLI is NOT exported from main entry to avoid executing program.parse()
// Import CLI directly from './cli/index.js' if needed

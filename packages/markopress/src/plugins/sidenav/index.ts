/**
 * Sidenav Plugin for MarkoPress
 *
 * Generates sidebar navigation from content structure
 * Now supports dynamic module targeting
 */

import type { MarkoPressPlugin } from '../../plugin/types.js';
import type { ContentModule } from '../../content/registry.js';
import type { ContentFile } from '../../content/types.js';

export interface SidenavOptions {
  /**
   * Target module(s) to generate sidebar for
   * Can be a single module ID (e.g., 'docs', 'guides') or an array of IDs
   * Default: ['docs'] for backward compatibility
   */
  module?: string | string[];

  /**
   * Auto-generate sidebar from file structure
   * @default true
   */
  autoGenerate?: boolean;

  /**
   * Manual sidebar configuration (overrides autoGenerate)
   */
  items?: SidenavItem[];
}

export interface SidenavItem {
  text?: string;
  link?: string;
  items?: SidenavItem[];
  collapsed?: boolean;
}

/**
 * Create sidenav plugin
 * Supports dynamic module targeting via the `module` option
 */
export default function sidenavPlugin(options: SidenavOptions = {}): MarkoPressPlugin {
  const { autoGenerate = true, items, module: targetModule = 'docs' } = options;

  // Normalize module option to array
  const targetModules = Array.isArray(targetModule) ? targetModule : [targetModule];

  return {
    name: 'sidenav',
    modules: targetModules,

    async enhanceModules(modules: ContentModule[]) {
      for (const mod of modules as any[]) {
        // Use manual items if provided, otherwise auto-generate
        const sidebar = items || (autoGenerate ? buildSidebarFromFiles(mod.files, mod.id) : []);
        mod.enhance('sidebar', sidebar);
      }
    },
  };
}

/**
 * Build sidebar from content files
 * Groups by directory structure and uses frontmatter for ordering
 * Works with any module ID
 */
function buildSidebarFromFiles(files: ContentFile[], moduleId: string): SidenavItem[] {
  // Group files by directory
  const groups = new Map<string, ContentFile[]>();

  for (const file of files) {
    // Get the path after /{moduleId}/
    const modulePath = file.urlPath.replace(new RegExp(`^/${moduleId}/`), '');

    // Extract directory (first segment)
    const dirParts = modulePath.split('/');
    const dir = dirParts.length > 1 ? dirParts[0] : '';

    if (dir) {
      if (!groups.has(dir)) {
        groups.set(dir, []);
      }
      groups.get(dir)!.push(file);
    }
  }

  // Build sidebar structure
  const sidebar: SidenavItem[] = [];

  // First, add root-level files (no directory)
  const rootFiles = files.filter(f => {
    const modulePath = f.urlPath.replace(new RegExp(`^/${moduleId}/`), '');
    return !modulePath.includes('/');
  });

  for (const file of rootFiles) {
    sidebar.push({
      text: file.processed.frontmatter.title as string || file.urlPath,
      link: file.urlPath,
    });
  }

  // Then, add directory groups
  for (const [dir, dirFiles] of groups.entries()) {
    // Sort files within directory by frontmatter order (if specified)
    const sortedFiles = dirFiles.sort((a, b) => {
      const orderA = a.processed.frontmatter.order as number | undefined;
      const orderB = b.processed.frontmatter.order as number | undefined;
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
      }
      return 0;
    });

    sidebar.push({
      text: dir.charAt(0).toUpperCase() + dir.slice(1), // Capitalize
      items: sortedFiles.map(file => ({
        text: file.processed.frontmatter.title as string || file.urlPath,
        link: file.urlPath,
      })),
    });
  }

  return sidebar;
}

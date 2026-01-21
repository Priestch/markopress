/**
 * Sidenav Plugin for MarkoPress
 *
 * Generates sidebar navigation from content structure
 */

import type { MarkoPressPlugin } from 'markopress/plugin';
import type { ContentModule } from 'markopress/content';
import type { ContentFile } from 'markopress/content';

export interface SidenavOptions {
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
 */
export default function sidenavPlugin(options: SidenavOptions = {}): MarkoPressPlugin {
  const { autoGenerate = true, items } = options;

  return {
    name: '@markopress/plugin-feature-sidenav',
    modules: ['docs'],

    async enhanceModules(modules: ContentModule[]) {
      const docsModule = modules.find(m => m.id === 'docs');
      if (!docsModule) return;

      // Use manual items if provided, otherwise auto-generate
      const sidebar = items || (autoGenerate ? buildSidebarFromFiles(docsModule.files) : []);
      docsModule.enhance('sidebar', sidebar);
    },
  };
}

/**
 * Build sidebar from docs files
 * Groups by directory structure and uses frontmatter for ordering
 */
function buildSidebarFromFiles(files: ContentFile[]): SidenavItem[] {
  // Group files by directory
  const groups = new Map<string, ContentFile[]>();

  for (const file of files) {
    // Get the path after /docs/
    const docsPath = file.urlPath.replace(/^\/docs\//, '');

    // Extract directory (first segment)
    const dirParts = docsPath.split('/');
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
    const docsPath = f.urlPath.replace(/^\/docs\//, '');
    return !docsPath.includes('/');
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

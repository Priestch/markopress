/**
 * Sidenav Plugin for MarkoPress
 *
 * Generates sidebar navigation from content structure
 */

/**
 * Create sidenav plugin
 */
export default function sidenavPlugin(options = {}) {
  const { autoGenerate = true, items, module = 'docs' } = options;

  return {
    name: '@markopress/plugin-feature-sidenav',
    modules: [module],

    async enhanceModules(modules) {
      const targetModule = modules.find(m => m.id === module);
      if (!targetModule) return;

      // Use manual items if provided, otherwise auto-generate
      const sidebar = items || (autoGenerate ? buildSidebarFromFiles(targetModule.files) : []);
      targetModule.enhance('sidebar', sidebar);
    },
  };
}

/**
 * Get display title for a file
 * Uses frontmatter title, or extracts from first h1, or falls back to URL path
 */
function getFileTitle(file) {
  // First try frontmatter
  if (file.processed.frontmatter.title) {
    return file.processed.frontmatter.title;
  }

  // Try to extract from first h1 header
  const html = file.processed.html || '';
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match) {
    // Strip HTML tags and decode entities
    let title = h1Match[1].replace(/<[^>]*>/g, '').trim();
    // Remove leading "#" from header anchors
    title = title.replace(/^#\s*/, '');
    if (title) {
      return title;
    }
  }

  // Fallback to a formatted version of the URL path
  const path = file.urlPath.replace(/^\/docs\//, '').replace(/\.html$/, '');
  return path
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Build sidebar from docs files
 * Groups by directory structure and uses frontmatter for ordering
 */
function buildSidebarFromFiles(files) {
  // Group files by directory
  const groups = new Map();

  for (const file of files) {
    // Get the path after the module prefix
    const pathMatch = file.urlPath.match(/^\/[^/]+\/(.*)/);
    if (!pathMatch) continue;

    const contentPath = pathMatch[1];

    // Extract directory (first segment)
    const dirParts = contentPath.split('/');
    const dir = dirParts.length > 1 ? dirParts[0] : '';

    if (dir) {
      if (!groups.has(dir)) {
        groups.set(dir, []);
      }
      groups.get(dir).push(file);
    }
  }

  // Build sidebar structure
  const sidebar = [];

  // First, add root-level files (no directory)
  const rootFiles = files.filter(f => {
    const pathMatch = f.urlPath.match(/^\/[^/]+\/(.*)/);
    if (!pathMatch) return false;
    const contentPath = pathMatch[1];
    return !contentPath.includes('/');
  });

  for (const file of rootFiles) {
    sidebar.push({
      text: getFileTitle(file),
      link: file.urlPath,
    });
  }

  // Then, add directory groups
  for (const [dir, dirFiles] of groups.entries()) {
    // Sort files within directory by frontmatter order (if specified)
    const sortedFiles = dirFiles.sort((a, b) => {
      const orderA = a.processed.frontmatter.order;
      const orderB = b.processed.frontmatter.order;
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
      }
      return 0;
    });

    sidebar.push({
      text: dir.charAt(0).toUpperCase() + dir.slice(1), // Capitalize
      items: sortedFiles.map(file => ({
        text: getFileTitle(file),
        link: file.urlPath,
      })),
    });
  }

  return sidebar;
}

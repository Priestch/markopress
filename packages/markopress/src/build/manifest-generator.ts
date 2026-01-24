/**
 * Content Manifest Generator for Dynamic Routes
 * Generates a JSON manifest file that catch-all routes can use to look up content
 * Now supports dynamic module-based structure
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ContentManifest, ContentFile } from '../content/types.js';
import type { ResolvedConfig } from '../config/types.js';

export interface ContentLookupEntry {
  slug: string;
  title: string;
  description: string;
  html: string;
  date?: string;
  author?: string;
  tags?: string[];
  frontmatter: Record<string, unknown>;
}

// Use a type instead of interface to avoid index signature conflicts
export type ContentLookupManifest = {
  // Sidebar and navbar (global)
  sidebar: Record<string, Array<{ text: string; link: string }>>;
  navbar: Array<{ text: string; link: string }>;
} & Record<string, Record<string, ContentLookupEntry> | Array<{ text: string; link: string }> | undefined>;

/**
 * Generate a content manifest JSON file for dynamic route lookup
 * Works with dynamic module-based manifest structure
 */
export async function generateContentManifest(
  manifest: ContentManifest,
  routesDir: string,
  config: ResolvedConfig
): Promise<void> {
  const lookup: ContentLookupManifest = {
    sidebar: {},
    navbar: config.theme?.options?.navbar || [],
  };

  // Process all modules dynamically
  for (const [moduleId, files] of Object.entries(manifest)) {
    // Skip non-array entries (like 'all' collection)
    if (!Array.isArray(files)) continue;

    const contentFiles = files as ContentFile[];

    // Initialize the module's collection
    lookup[moduleId] = {} as Record<string, ContentLookupEntry>;

    // Determine the URL prefix for this module
    const prefix = moduleId === 'pages' ? '/' : `/${moduleId}`;
    const moduleLookup = lookup[moduleId] as Record<string, ContentLookupEntry>;

    for (const file of contentFiles) {
      const slug = getSlug(file.urlPath, prefix);
      moduleLookup[slug] = createLookupEntry(file);
    }
  }

  // Generate sidebar data
  const sidebarConfig = config.theme?.options?.sidebar || {};
  for (const [prefix, items] of Object.entries(sidebarConfig)) {
    if (typeof items === 'object' && 'autoGenerate' in items && items.autoGenerate === true) {
      // Auto-generate sidebar from all relevant content files
      // Find files that match the prefix path
      const sidebarFiles: ContentFile[] = [];

      for (const [moduleId, files] of Object.entries(manifest)) {
        if (!Array.isArray(files)) continue;
        for (const file of files as ContentFile[]) {
          if (file.urlPath.startsWith(prefix)) {
            sidebarFiles.push(file);
          }
        }
      }

      lookup.sidebar[prefix] = sidebarFiles.map((d) => ({
        text: String(d.processed.frontmatter.title || d.urlPath),
        link: d.urlPath,
      }));
    } else if (Array.isArray(items)) {
      lookup.sidebar[prefix] = items;
    }
  }

  // Write manifest to routes directory
  const manifestPath = path.join(routesDir, 'content-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(lookup, null, 2), 'utf-8');
}

/**
 * Get slug from URL path by removing prefix
 */
function getSlug(urlPath: string, prefix: string): string {
  let slug = urlPath;

  // Remove prefix
  if (prefix !== '/') {
    slug = slug.replace(prefix, '');
  }

  // Remove leading and trailing slashes
  slug = slug.replace(/^\/+|\/+$/g, '');

  // Handle root/empty case
  if (slug === '') {
    slug = 'index';
  }

  return slug;
}

/**
 * Create a lookup entry from a content file
 */
function createLookupEntry(file: ContentFile): ContentLookupEntry {
  const { frontmatter } = file.processed;

  // Get prefix based on module ID
  const prefix = file.moduleId === 'pages' ? '/' : `/${file.moduleId}`;

  return {
    slug: getSlug(file.urlPath, prefix),
    title: String(frontmatter.title || 'Untitled'),
    description: String(frontmatter.description || ''),
    html: file.processed.html || '',
    date: frontmatter.date ? String(frontmatter.date) : undefined,
    author: frontmatter.author ? String(frontmatter.author) : undefined,
    tags: frontmatter.tags ? (Array.isArray(frontmatter.tags) ? frontmatter.tags : [String(frontmatter.tags)]) : undefined,
    frontmatter,
  };
}

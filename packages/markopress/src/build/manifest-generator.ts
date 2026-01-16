/**
 * Content Manifest Generator for Dynamic Routes
 * Generates a JSON manifest file that catch-all routes can use to look up content
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

export interface ContentLookupManifest {
  docs: Record<string, ContentLookupEntry>;
  blog: Record<string, ContentLookupEntry>;
  pages: Record<string, ContentLookupEntry>;
  sidebar: Record<string, Array<{ text: string; link: string }>>;
  navbar: Array<{ text: string; link: string }>;
}

/**
 * Generate a content manifest JSON file for dynamic route lookup
 */
export async function generateContentManifest(
  manifest: ContentManifest,
  routesDir: string,
  config: ResolvedConfig
): Promise<void> {
  const lookup: ContentLookupManifest = {
    docs: {},
    blog: {},
    pages: {},
    sidebar: {},
    navbar: config.theme?.options?.navbar || [],
  };

  // Process docs - use relative path after /docs/ as slug
  for (const doc of manifest.docs) {
    const slug = getSlug(doc.urlPath, '/docs');
    lookup.docs[slug] = createLookupEntry(doc);
  }

  // Process blog - use relative path after /blog/ as slug
  for (const post of manifest.blog) {
    const slug = getSlug(post.urlPath, '/blog');
    lookup.blog[slug] = createLookupEntry(post);
  }

  // Process pages - use relative path after / as slug
  for (const page of manifest.pages) {
    const slug = getSlug(page.urlPath, '/');
    lookup.pages[slug] = createLookupEntry(page);
  }

  // Generate sidebar data
  const sidebarConfig = config.theme?.options?.sidebar || {};
  for (const [prefix, items] of Object.entries(sidebarConfig)) {
    if (typeof items === 'object' && 'autoGenerate' in items && items.autoGenerate === true) {
      // Auto-generate sidebar from all docs
      lookup.sidebar[prefix] = manifest.docs
        .filter((d) => d.urlPath.startsWith(prefix))
        .map((d) => ({
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

  return {
    slug: getSlug(file.urlPath, file.type === 'doc' ? '/docs' : file.type === 'blog' ? '/blog' : '/'),
    title: String(frontmatter.title || 'Untitled'),
    description: String(frontmatter.description || ''),
    html: file.processed.html || '',
    date: frontmatter.date ? String(frontmatter.date) : undefined,
    author: frontmatter.author ? String(frontmatter.author) : undefined,
    tags: frontmatter.tags ? (Array.isArray(frontmatter.tags) ? frontmatter.tags : [String(frontmatter.tags)]) : undefined,
    frontmatter,
  };
}

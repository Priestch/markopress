/**
 * Plugin context implementations
 * Provides isolated contexts for each plugin lifecycle stage
 */

import type {
  PluginContent,
  AllContent,
  ContentActions,
  RouteConfig,
} from './types.js';
import type { ContentFile } from '../content/types.js';

/**
 * AllContent implementation
 * Aggregates content from all plugins
 */
export class AllContentImpl implements AllContent {
  private contentMap = new Map<string, PluginContent>();
  private pageCache?: ContentFile[];
  private docCache?: ContentFile[];
  private postCache?: ContentFile[];

  addPluginContent(pluginName: string, content: PluginContent | null): void {
    if (content) {
      this.contentMap.set(pluginName, content);
      this.invalidateCache();
    }
  }

  private invalidateCache(): void {
    this.pageCache = undefined;
    this.docCache = undefined;
    this.postCache = undefined;
  }

  getPages(): ContentFile[] {
    if (!this.pageCache) {
      const pages: ContentFile[] = [];
      for (const content of this.contentMap.values()) {
        if (content.pages) {
          pages.push(...content.pages);
        }
      }
      this.pageCache = pages;
    }
    return this.pageCache;
  }

  getDocs(): ContentFile[] {
    if (!this.docCache) {
      const docs: ContentFile[] = [];
      for (const content of this.contentMap.values()) {
        if (content.docs) {
          docs.push(...content.docs);
        }
      }
      this.docCache = docs;
    }
    return this.docCache;
  }

  getPosts(): ContentFile[] {
    if (!this.postCache) {
      const posts: ContentFile[] = [];
      for (const content of this.contentMap.values()) {
        if (content.blog) {
          posts.push(...content.blog);
        }
      }
      this.postCache = posts;
    }
    return this.postCache;
  }

  getContent(type: string): unknown[] {
    const items: unknown[] = [];
    for (const content of this.contentMap.values()) {
      if (content[type]) {
        items.push(...(content[type] as unknown[]));
      }
    }
    return items;
  }

  clear(): void {
    this.contentMap.clear();
    this.invalidateCache();
  }
}

/**
 * Content actions implementation
 * Manages routes and data added by plugins
 */
export class ContentActionsImpl implements ContentActions {
  private routes = new Map<string, RouteConfig>();
  private data = new Map<string, unknown>();

  addRoute(route: RouteConfig): void {
    const key = `${route.path}-${route.component || 'default'}`;
    this.routes.set(key, route);
  }

  addData(key: string, value: unknown): void {
    this.data.set(key, value);
  }

  getRoute(path: string): RouteConfig | undefined {
    return Array.from(this.routes.values()).find(r => r.path === path);
  }

  getAllRoutes(): RouteConfig[] {
    return Array.from(this.routes.values());
  }

  getData(): Map<string, unknown> {
    return this.data;
  }

  clear(): void {
    this.routes.clear();
    this.data.clear();
  }
}

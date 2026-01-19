/**
 * Backward compatibility utilities for plugins
 */

import type { MarkoPressPlugin } from './types.js';
import type { ContentManifest } from './types.js';
import type { ContentFile } from '../content/types.js';

/**
 * Wrap legacy plugin to support new hooks
 * Ensures old plugins work without modification
 */
export function wrapLegacyPlugin(plugin: any): MarkoPressPlugin {
  // If plugin already has new hooks, return as-is
  if (plugin.loadContent || plugin.allContentLoaded || plugin.postBuild) {
    return plugin;
  }

  // Wrap old contentLoaded signature
  const originalContentLoaded = plugin.contentLoaded;
  if (originalContentLoaded) {
    plugin.contentLoaded = function(ctx: any) {
      // Old signature: contentLoaded(ctx: ContentContext)
      // New signature: contentLoaded(ctx: { content, allContent, actions })

      // Check if using old signature (has addPage, addPost but no allContent)
      if (ctx.addPage && ctx.addPost && !ctx.allContent) {
        // Old plugin - provide backward compatible context
        return originalContentLoaded.call(this, ctx);
      } else {
        // New signature - call as-is
        return originalContentLoaded.call(this, ctx);
      }
    };
  }

  // Convert beforeBuild to allContentLoaded (for migration)
  if (plugin.beforeBuild && !plugin.allContentLoaded) {
    const originalBeforeBuild = plugin.beforeBuild;
    plugin.allContentLoaded = function(ctx: any) {
      // Map old beforeBuild context to new allContentLoaded context
      const oldContext = {
        content: ctx.allContent,
        routes: ctx.routes,
        config: ctx.config,
      };
      return originalBeforeBuild.call(this, oldContext);
    };
  }

  // Convert afterBuild to postBuild (for migration)
  if (plugin.afterBuild && !plugin.postBuild) {
    const originalAfterBuild = plugin.afterBuild;
    plugin.postBuild = function(ctx: any) {
      // Map old afterBuild context to new postBuild context
      const oldContext = {
        outDir: ctx.outDir,
        routes: ctx.routes,
        content: ctx.allContent,
      };
      return originalAfterBuild.call(this, oldContext);
    };
  }

  return plugin as MarkoPressPlugin;
}

/**
 * Check if plugin is using legacy signature
 */
export function isLegacyPlugin(plugin: any): boolean {
  // Check if plugin has old contentLoaded signature but not new one
  if (plugin.contentLoaded) {
    // Can't determine without checking the function signature
    // We'll detect at runtime
    return false;
  }

  // Has beforeBuild but not allContentLoaded -> likely legacy
  if (plugin.beforeBuild && !plugin.allContentLoaded) {
    return true;
  }

  // Has afterBuild but not postBuild -> likely legacy
  if (plugin.afterBuild && !plugin.postBuild) {
    return true;
  }

  return false;
}

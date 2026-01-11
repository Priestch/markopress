/**
 * MarkoPress Dev Server
 * Development server with HMR, file watching, and automatic route regeneration
 * Based on VitePress architecture, adapted for @marko/run
 */

import path from 'node:path';
import { loadConfig } from '../config/index.js';
import { createMarkdownPlugin } from '../vite/index.js';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { scanContent } from '../content/scanner.js';
import type { ContentManifest } from '../content/types.js';
import { PluginManager } from '../plugin/manager.js';
import { generateRoutes } from '../build/route-generator.js';

interface DevServerOptions {
  port?: number;
  host?: string;
  open?: boolean;
  base?: string;
}

interface MarkoPressDevServer extends ViteDevServer {
  markoPress: {
    config: Awaited<ReturnType<typeof loadConfig>>;
    contentWatcher: ReturnType<typeof fs>;
  };
}

/**
 * Create MarkoPress development server with HMR
 */
export async function createDevServer(options: DevServerOptions = {}) {
  console.log('🚀 Starting MarkoPress dev server...\n');

  // Load configuration
  const config = await loadConfig(process.cwd(), { mode: 'development', command: 'dev' });
  console.log(`✓ Config loaded from ${config.root}`);

  // Initialize plugin manager
  const pluginManager = new PluginManager(config);
  if (config.plugins.length > 0) {
    await pluginManager.loadPlugins(config.plugins);
  }

  // Scan content for initial manifest
  console.log('📂 Scanning content directories...');
  const contentDirs = [config.content.pages, config.content.docs, config.content.blog].filter(Boolean);
  const manifest = await scanContent({
    rootDir: config.root,
    dirs: {
      pages: config.content.pages,
      docs: config.content.docs,
      blog: config.content.blog,
    },
  });
  console.log(`   Found ${manifest.pages.length} pages`);
  console.log(`   Found ${manifest.docs.length} docs`);
  console.log(`   Found ${manifest.blog.length} blog posts\n`);

  // Create Vite server with MarkoPress plugins
  const server = await createViteServer({
    configFile: false,
    root: config.root,
    server: {
      port: options.port || 3000,
      host: options.host || 'localhost',
      open: options.open || false,
    },
    base: options.base || config.site.base,
    plugins: [
      createMarkdownPlugin(config),
      // Add content watching plugin
      createContentWatcher(config, manifest, pluginManager),
    ],
    optimizeDeps: {
      include: ['@marko/run', 'marko'],
    },
  }) as MarkoPressDevServer;

  // Attach MarkoPress-specific data to server
  server.markoPress = {
    config,
    contentWatcher: null as any,
  };

  return server;
}

/**
 * Create Vite plugin for watching content changes
 */
function createContentWatcher(
  config: Awaited<ReturnType<typeof loadConfig>>,
  manifest: ContentManifest,
  pluginManager: PluginManager
) {
  const fs = require('vite').fs as import('node:fs');
  const { watch } = require('chokidar');

  let watcher: import('chokidar').FSWatcher | null = null;

  return {
    name: 'markopress:content-watcher',

    configureServer(server: ViteDevServer) {
      // Start watching content directories after server is ready
      server.httpServer?.once('listening', () => {
        const watchPaths = [
          config.content.pages,
          config.content.docs,
          config.content.blog,
          '.markopress/config.ts',
          '.markopress/config.js',
          'markopress.config.ts',
          'markopress.config.js',
        ].filter(Boolean).map((p) => path.join(config.root, p));

        console.log('👀 Watching for content changes...\n');

        watcher = watch(watchPaths, {
          persistent: true,
          ignoreInitial: true,
          awaitWriteFinish: {
            stabilityThreshold: 100,
            pollInterval: 10,
          },
        });

        watcher.on('change', async (filePath: string) => {
          console.log(`\n📝 ${filePath} changed, rebuilding...`);

          try {
            // Rescan content
            const newManifest = await scanContent({
              rootDir: config.root,
              dirs: {
                pages: config.content.pages,
                docs: config.content.docs,
                blog: config.content.blog,
              },
            });

            // Regenerate routes
            await generateRoutes(newManifest, path.join(config.root, 'src/routes'), true);

            // Reload the page
            server.moduleGraph.invalidateAll();
            server.ws.send({
              type: 'full-reload',
              path: '*',
            });

            console.log('✓ Routes regenerated, page reloaded');
          } catch (error) {
            console.error('✗ Failed to regenerate routes:', error);
          }
        });

        watcher.on('add', async (filePath: string) => {
          console.log(`\n➕ ${filePath} added, rebuilding...`);

          try {
            // Rescan and regenerate
            const newManifest = await scanContent({
              rootDir: config.root,
              dirs: {
                pages: config.content.pages,
                docs: config.content.docs,
                blog: config.content.blog,
              },
            });

            await generateRoutes(newManifest, path.join(config.root, 'src/routes'), true);

            server.moduleGraph.invalidateAll();
            server.ws.send({
              type: 'full-reload',
              path: '*',
            });

            console.log('✓ Routes regenerated, page reloaded');
          } catch (error) {
            console.error('✗ Failed to regenerate routes:', error);
          }
        });

        watcher.on('unlink', async (filePath: string) => {
          console.log(`\n➖ ${filePath} removed, rebuilding...`);

          try {
            // Rescan and regenerate
            const newManifest = await scanContent({
              rootDir: config.root,
              dirs: {
                pages: config.content.pages,
                docs: config.content.docs,
                blog: config.content.blog,
              },
            });

            await generateRoutes(newManifest, path.join(config.root, 'src/routes'), true);

            server.moduleGraph.invalidateAll();
            server.ws.send({
              type: 'full-reload',
              path: '*',
            });

            console.log('✓ Routes regenerated, page reloaded');
          } catch (error) {
            console.error('✗ Failed to regenerate routes:', error);
          }
        });
      });
    },

    buildEnd() {
      // Close watcher when build ends
      if (watcher) {
        watcher.close();
      }
    },
  };
}

/**
 * Start development server
 */
export async function startDevServer(options: DevServerOptions = {}) {
  const server = await createDevServer(options);

  await server.listen();

  const port = options.port || 3000;
  const host = options.host || 'localhost';
  const base = options.base || server.markoPress.config.site.base;

  console.log('\n' + '═'.repeat(50));
  console.log('  MARKOPRESS DEV SERVER');
  console.log('═'.repeat(50));
  console.log(`  ➜  Local:   http://${host}:${port}${base}`);
  console.log('  ➜  Press Ctrl+C to stop');
  console.log('═'.repeat(50) + '\n');

  return server;
}

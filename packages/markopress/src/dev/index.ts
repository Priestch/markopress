/**
 * MarkoPress Dev Server
 * Development server with automatic route generation
 */

import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadConfig } from '../config/index.js';
import { scanContent } from '../content/scanner.js';
import { PluginManager } from '../plugin/manager.js';
import { generateRoutes, copyThemeCSS, generateCatchAllRoutes } from '../build/index.js';

interface DevServerOptions {
  port?: number;
  host?: string;
  open?: boolean;
  base?: string;
  useCatchAllRoutes?: boolean;
}

/**
 * Start development server
 */
export async function startDevServer(options: DevServerOptions = {}) {
  console.log('🚀 Starting MarkoPress dev server...\n');

  // Load configuration
  const config = await loadConfig(process.cwd(), { mode: 'development', command: 'dev' });
  console.log(`✓ Config loaded from ${config.root}`);

  // Initialize plugin manager
  let pluginManager: PluginManager | undefined;
  if (config.plugins && config.plugins.length > 0) {
    pluginManager = new PluginManager(config);
    await pluginManager.loadPlugins(config.plugins);

    // Execute loadContent hooks to let plugins load external content
    await pluginManager.execLoadContentHooks();
  }

  // Scan content for initial manifest
  console.log('📂 Scanning content directories...');
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

  // Execute contentLoaded hooks to process content
  if (pluginManager) {
    await pluginManager.execContentLoadedHooks(manifest);
  }

  // Generate routes
  console.log('📝 Generating routes from content...');
  const routesDir = path.join(config.root, 'src', 'routes');
  const routeMode = options.useCatchAllRoutes ?? config.build.useCatchAllRoutes;

  // Build initial route manifest
  let routeManifest: Record<string, any> = {};
  for (const page of manifest.pages) {
    routeManifest[page.urlPath] = {
      path: page.urlPath,
      title: page.processed.frontmatter.title || 'Untitled',
      ...page.processed.frontmatter
    };
  }
  for (const doc of manifest.docs) {
    routeManifest[doc.urlPath] = {
      path: doc.urlPath,
      title: doc.processed.frontmatter.title || 'Untitled',
      ...doc.processed.frontmatter
    };
  }
  for (const post of manifest.blog) {
    routeManifest[post.urlPath] = {
      path: post.urlPath,
      title: post.processed.frontmatter.title || 'Untitled',
      ...post.processed.frontmatter
    };
  }

  // Execute extendRoutes hooks
  if (pluginManager) {
    routeManifest = await pluginManager.execExtendRoutesHooks(routeManifest);
  }

  if (routeMode) {
    await generateCatchAllRoutes(manifest, routesDir, config, false);
    console.log('   Using catch-all dynamic routes');
  } else {
    await generateRoutes(manifest, routesDir, config, false);
    console.log('   Using static routes');
  }
  console.log('   Routes generated\n');

  // Execute allContentLoaded hooks
  if (pluginManager) {
    await pluginManager.execAllContentLoadedHooks(routeManifest);
  }

  // Copy theme CSS
  console.log('🎨 Copying theme CSS...');
  await copyThemeCSS(config.root, config, false);
  console.log('   Theme CSS copied\n');

  // Start @marko/run dev server
  console.log('🔨 Starting @marko/run dev server...\n');

  const port = options.port || 3000;
  const args = ['dev'];

  if (port) {
    args.push('--port', String(port));
  }

  const devProcess = spawn('npx', ['marko-run', ...args], {
    stdio: 'inherit',
    cwd: config.root,
  });

  devProcess.on('error', (error) => {
    console.error('Failed to start dev server:', error);
    process.exit(1);
  });

  devProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Dev server exited with code ${code}`);
      process.exit(code || 1);
    }
  });

  // Handle process termination
  process.on('SIGINT', () => {
    devProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    devProcess.kill('SIGTERM');
    process.exit(0);
  });
}

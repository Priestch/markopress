/**
 * MarkoPress Dev Server
 * Development server with automatic route generation
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import matter from 'gray-matter';
import { loadConfig } from '../config/index.js';
import { PluginManager } from '../plugin/manager.js';
import { generateRoutes, copyThemeCSS, generateCatchAllRoutes, filePathToUrl } from '../build/index.js';
import { buildSearchIndex } from '../search/index.js';
import { renderMarkdown } from '../markdown/renderer.js';

interface DevServerOptions {
  port?: number;
  host?: string;
  open?: boolean;
  base?: string;
  useCatchAllRoutes?: boolean;
  root?: string;
}

/**
 * Start development server
 */
export async function startDevServer(options: DevServerOptions = {}) {
  console.log('🚀 Starting MarkoPress dev server...\n');

  // Use resolved root or fall back to process.cwd()
  const root = options.root || process.cwd();

  // Load configuration
  const config = await loadConfig(root, { mode: 'development', command: 'dev' });
  console.log(`✓ Config loaded from ${config.root}`);

  // Initialize plugin manager
  let pluginManager: PluginManager | undefined;
  if (config.plugins && config.plugins.length > 0) {
    pluginManager = new PluginManager(config);
    await pluginManager.loadPlugins(config.plugins);

    // Execute loadContent hooks to let plugins load external content
    await pluginManager.execLoadContentHooks();
  }

  // Clean stale pre-rendered markdown from previous builds.
  // Dev mode renders markdown at request time, so these files are unused.
  // If left from a build with a different BASE_URL, baked-in base paths
  // would leak into dev responses.
  const generatedMarkdownDir = path.join(config.root, 'src', '.generated', 'markdown');
  await fs.rm(generatedMarkdownDir, { recursive: true, force: true });

  // Empty manifest for dynamic rendering
  const manifest: Record<string, any> = {};
  const modules: any[] = [];

  console.log('📝 Generating routes from content...');
  const routesDir = path.join(config.root, 'src', 'routes');
  const routeMode = options.useCatchAllRoutes ?? config.build.useCatchAllRoutes;

  // Ensure routes directory exists
  await fs.mkdir(routesDir, { recursive: true });

  // Initialize empty route manifest
  let routeManifest: Record<string, any> = {};

  // Execute extendRoutes hooks
  if (pluginManager) {
    routeManifest = await pluginManager.execExtendRoutesHooks(routeManifest);
  }

  if (routeMode) {
    await generateCatchAllRoutes(manifest, routesDir, config, modules, false, false);
    console.log('   Using catch-all dynamic routes');
  } else {
    await generateRoutes(manifest, routesDir, config, modules, false);
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

  // Build search index
  if (config.search?.enabled !== false) {
    console.log('🔍 Building search index...');
    const searchPages: Array<{
      url: string;
      html: string;
      title: string;
      frontmatter?: Record<string, unknown>;
    }> = [];

    const contentDir = path.resolve(root, config.contentDir);
    try {
      const entries = await fs.readdir(contentDir, { withFileTypes: true, recursive: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

        const filePath = path.join(entry.path || entry.parentPath || contentDir, entry.name);
        const urlPath = filePathToUrl(filePath, contentDir);
        const rawContent = await fs.readFile(filePath, 'utf-8');
        const rendered = await renderMarkdown(rawContent, config.markdown);
        const slug = entry.name.replace('.md', '');

        searchPages.push({
          url: urlPath,
          html: rendered.html,
          title: (rendered.frontmatter?.title as string) || slug,
          frontmatter: rendered.frontmatter,
        });
      }
    } catch {
      // Directory doesn't exist
    }

    try {
      const searchIndexJson = await buildSearchIndex(searchPages, config.search);
      const searchIndexPath = path.join(root, 'public', 'search-index.json');
      await fs.mkdir(path.dirname(searchIndexPath), { recursive: true });
      await fs.writeFile(searchIndexPath, searchIndexJson);
      console.log(`   Search index built (${searchPages.length} pages)\n`);
    } catch (error) {
      console.warn('   Warning: Failed to build search index:', error);
    }
  }

  // Theme components are auto-discovered from the markopress package
  // via marko metadata (marko.json + package exports)

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

/**
 * MarkoPress Build System
 * Generates static HTML from markdown content
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { loadConfig } from '../config/loader.js';
import type { ContentManifest, ContentFile } from '../content/types.js';
import type { ResolvedConfig } from '../config/types.js';
import { getDesignSystem, getDarkModeOverride, type DesignSystem } from '../theme/default/design-systems/index.js';
import { globalTagValidator, formatValidationError } from '../markdown/index.js';
import { PluginManager } from '../plugin/manager.js';
import { loadMarkdownModule, registerMarkdownContent, escapeMarkoText } from './vite-markdown-plugin.js';
import { renderMarkdown } from '../markdown/renderer.js';
import { buildSearchIndex } from '../search/index.js';

const BUILD_MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const MARKOPRESS_PACKAGE_ROOT = path.resolve(BUILD_MODULE_DIR, '..', '..');
const INTERNAL_DEFAULT_THEME_ROOT = path.join(MARKOPRESS_PACKAGE_ROOT, 'src', 'theme', 'default');
const INTERNAL_DEFAULT_THEME_NAMES = new Set([
  '@markopress/theme-default',
  'theme-default',
  'default',
]);

function isInternalDefaultTheme(themeName: string): boolean {
  return INTERNAL_DEFAULT_THEME_NAMES.has(themeName);
}

// Stub type for backward compatibility (modules removed, now rendered at request time)
export type ContentModule = any;

export function filePathToUrl(filePath: string, contentDir: string): string {
  const relativePath = path.relative(contentDir, filePath);
  const slug = relativePath.replace(/\.md$/, '').split(path.sep).join('/');
  
  if (slug === 'index') return '/';
  if (slug.endsWith('/index')) {
    return '/' + slug.replace('/index', '');
  }
  return '/' + slug;
}

export interface BuildOptions {
  useCatchAllRoutes?: boolean;
  outDir?: string;
  debug?: boolean;
  root?: string;
}

export interface BuildResult {
  success: boolean;
  outDir: string;
  pages: number;
  errors: string[];
}

export async function syncPublicAssets(
  sourceRoot: string,
  appRoot: string,
  debug: boolean
): Promise<void> {
  if (sourceRoot === appRoot) {
    return;
  }

  const sourcePublicDir = path.join(sourceRoot, 'public');
  const targetPublicDir = path.join(appRoot, 'public');
  const manifestPath = path.join(appRoot, 'src', '.generated', 'public-assets-manifest.json');
  const previousFiles = await readSyncedPublicAssetManifest(manifestPath);
  let syncedFiles: string[] = [];

  try {
    const stat = await fs.stat(sourcePublicDir);
    if (!stat.isDirectory()) {
      await removeStalePublicAssets(targetPublicDir, previousFiles, syncedFiles);
      await writeSyncedPublicAssetManifest(manifestPath, syncedFiles);
      return;
    }
  } catch {
    await removeStalePublicAssets(targetPublicDir, previousFiles, syncedFiles);
    await writeSyncedPublicAssetManifest(manifestPath, syncedFiles);
    return;
  }

  await fs.mkdir(targetPublicDir, { recursive: true });
  syncedFiles = await copyDirectoryContents(sourcePublicDir, targetPublicDir);
  await removeStalePublicAssets(targetPublicDir, previousFiles, syncedFiles);
  await writeSyncedPublicAssetManifest(manifestPath, syncedFiles);

  if (debug) {
    console.log(`   Synced public assets from: ${sourcePublicDir}`);
    console.log(`   Output: ${targetPublicDir}`);
  }
}

/**
 * Build the MarkoPress site for production
 */
export async function build(options: BuildOptions = {}): Promise<BuildResult> {
  const { outDir, debug = false, useCatchAllRoutes, root: optionRoot } = options;
  const root = optionRoot || process.cwd();
  const errors: string[] = [];
  const timings = new Map<string, number>();
  const startTimes = new Map<string, number>();

  // Resolve the @marko/run app root (.markopress directory)
  const markoAppRoot = path.join(root, '.markopress');
  let appRoot = root;
  try {
    const stat = await fs.stat(markoAppRoot);
    if (stat.isDirectory()) appRoot = markoAppRoot;
  } catch {}

  /**
   * Timing helper - tracks elapsed time for build steps
   * Uses performance.now() for high-resolution timing
   */
  const time = (label: string) => ({
    start: () => {
      startTimes.set(label, performance.now());
    },
    end: () => {
      const start = startTimes.get(label) || 0;
      const elapsed = performance.now() - start;
      timings.set(label, elapsed);
    },
  });

  try {
    console.log('🚀 Building MarkoPress site...\n');

    // Step 0: Load configuration
    const t0 = time('Config loading');
    t0.start();
    let config = await loadConfig(root, { mode: 'production', command: 'build' });
    t0.end();

    // Step 1: Initialize plugin manager
    let pluginManager: PluginManager | undefined;
    if (config.plugins && config.plugins.length > 0) {
      console.log('🔌 Loading plugins...');
      const t1 = time('Plugin loading');
      t1.start();
      pluginManager = new PluginManager(config);
      await pluginManager.loadPlugins(config.plugins);
      config = pluginManager.getConfig();
      t1.end();
      console.log('');
    }

    // Step 2: Execute loadContent hooks (for backward compatibility)
    if (pluginManager) {
      console.log('📦 Loading plugin content...');
      const t2 = time('Plugin loadContent hooks');
      t2.start();
      await pluginManager.execLoadContentHooks();
      t2.end();
      console.log('   Plugin content loaded\n');
    }

    // Step 3: Create ContentModule objects from content configuration
    // This allows plugins to enhance modules with metadata (sidebar, toc, etc.)
    const manifest: ContentManifest = {};
    const modules: any[] = [];
    const contentDir = path.resolve(root, config.contentDir);

    try {
      const entries = await fs.readdir(contentDir, { withFileTypes: true, recursive: true });
      const directoryFiles: Map<string, any[]> = new Map();

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

        const filePath = path.join(entry.path || entry.parentPath || contentDir, entry.name);
        const relativePath = path.relative(contentDir, filePath);
        const urlPath = filePathToUrl(filePath, contentDir);
        
        // Determine directory: root-level files go to 'root', others use first path segment
        const pathParts = relativePath.split(path.sep);
        const directory = pathParts.length === 1 ? 'root' : pathParts[0];
        
        const content = await fs.readFile(filePath, 'utf-8');
        let frontmatter: Record<string, unknown> = {};
        try {
          frontmatter = matter(content).data as Record<string, unknown>;
        } catch {
          // Ignore parse errors
        }

        if (!directoryFiles.has(directory)) {
          directoryFiles.set(directory, []);
        }
        
        directoryFiles.get(directory)!.push({
          id: entry.name.replace('.md', ''),
          slug: entry.name.replace('.md', ''),
          filePath,
          urlPath,
          directory,
          processed: { frontmatter },
        });
      }

      for (const [dir, files] of directoryFiles) {
        const features = config.content[dir] || {};
        const enhancements = new Map<string, unknown>();
        
        modules.push({
          id: dir,
          dir: path.join(contentDir, dir === 'root' ? '' : dir),
          config: features,
          features,
          files,
          enhance(key: string, data: unknown) {
            enhancements.set(key, data);
          },
          getEnhancement<T = unknown>(key: string): T | undefined {
            return enhancements.get(key) as T;
          },
          _enhancements: enhancements,
        });
      }
    } catch (error) {
      console.warn(`Warning: Could not scan content directory: ${error}`);
    }

    // Step 3b: Build content registry from already-scanned modules
    // Reuses the modules array to avoid a second filesystem scan
    const registryItems: Record<string, any[]> = {};
    for (const module of modules) {
      const items = module.files.map((file: any) => ({
        id: file.urlPath,
        moduleId: module.id,
        metadata: { ...file.processed.frontmatter },
        urlPath: file.urlPath,
      }));
      if (items.length > 0) {
        registryItems[module.id] = items;
      }
    }
    if (pluginManager) {
      pluginManager.getPluginData().set('contentRegistry', registryItems);
    }
    if (debug && Object.keys(registryItems).length > 0) {
      const moduleIds = Object.keys(registryItems);
      const total = Object.values(registryItems).reduce((sum: number, items: any) => sum + items.length, 0);
      console.log(`   Registry: ${total} items across ${moduleIds.length} modules (${moduleIds.join(', ')})`);
    }

    // Step 4: Execute enhanceModules hooks
    // This lets plugins like sidenav enhance modules with sidebar data
    if (pluginManager && modules.length > 0) {
      console.log('🔌 Enhancing modules with plugin metadata...');
      const t2a = time('Module enhancement');
      t2a.start();

      // Debug: Log modules and their files
      for (const module of modules) {
        console.log(`   Module: ${module.id} (${module.files.length} files)`);
        if (module.files.length > 0) {
          console.log(`     First file has processed: ${!!module.files[0].processed}`);
        }
      }

      await pluginManager.execEnhanceModulesHooks(modules);
      t2a.end();
      console.log(`   Enhanced ${modules.length} module(s)\n`);

      // Write module enhancements to a JSON file for request-time access
      const generatedDir = path.join(appRoot, 'src', '.generated');
      await fs.mkdir(generatedDir, { recursive: true });

      const base = (config.site?.base || '/').replace(/\/$/, '');
      const moduleEnhancements: Record<string, Record<string, unknown>> = {};
      for (const module of modules) {
        const enhancements: Record<string, unknown> = {};
        const entries = module._enhancements.entries() as Array<[string, unknown]>;
        for (const [key, value] of entries) {
          enhancements[key] = value;
        }
        if (Object.keys(enhancements).length > 0) {
          // Prefix all links in enhancements with base path
          if (base) {
            prefixEnhancementLinks(enhancements, base);
          }
          moduleEnhancements[module.id] = enhancements;
        }
      }

      const enhancementsPath = path.join(generatedDir, 'module-enhancements.js');
      const enhancementsJs = `// Auto-generated by MarkoPress - Do not edit\nexport default ${JSON.stringify(moduleEnhancements, null, 2)};\n`;
      await fs.writeFile(enhancementsPath, enhancementsJs, 'utf-8');
      // Also write .json for dev mode handlers
      const enhancementsJsonPath = path.join(generatedDir, 'module-enhancements.json');
      await fs.writeFile(enhancementsJsonPath, JSON.stringify(moduleEnhancements, null, 2), 'utf-8');
      console.log(`   Wrote module enhancements to src/.generated/module-enhancements.{js,json}\n`);
    }

    console.log('📦 Syncing public assets...');
    const t_public = time('Public assets sync');
    t_public.start();
    await syncPublicAssets(root, appRoot, debug);
    t_public.end();
    console.log('   Public assets synced\n');

    // Step 4a: Build search index
    if (config.search?.enabled !== false) {
      console.log('🔍 Building search index...');
      const t_search = time('Search index');
      t_search.start();

      const searchPages: Array<{
        url: string;
        html: string;
        title: string;
        frontmatter?: Record<string, unknown>;
      }> = [];

      const searchBase = (config.site?.base || '/').replace(/\/$/, '');
      for (const module of modules) {
        for (const file of module.files) {
          try {
            const rawContent = await fs.readFile(file.filePath, 'utf-8');
            const rendered = await renderMarkdown(rawContent, { ...config.markdown, base: searchBase });
            searchPages.push({
              url: file.urlPath,
              html: rendered.html,
              title: (rendered.frontmatter?.title as string) || file.id,
              frontmatter: rendered.frontmatter,
            });
          } catch (error) {
            console.warn(`   Warning: Could not index ${file.filePath}:`, error);
          }
        }
      }

      try {
        const searchIndexJson = await buildSearchIndex(searchPages, config.search);
        const searchIndexPath = path.join(appRoot, 'public', 'search-index.json');
        await fs.mkdir(path.dirname(searchIndexPath), { recursive: true });
        await fs.writeFile(searchIndexPath, searchIndexJson);
        console.log(`   Search index built (${searchPages.length} pages)\n`);
      } catch (error) {
        console.warn('   Warning: Failed to build search index:', error);
      }

      t_search.end();
    }

    // Step 5: Initialize tag validator if Marko tags enabled

    // Step 4: Initialize tag validator if Marko tags enabled
    if (config.markdown.markoTags?.enabled) {
      const tagsDir = path.join(appRoot, config.markdown.markoTags.tagsDir || 'src/tags');
      console.log('🔍 Scanning tags directory...');
      const t7 = time('Tag validation setup');
      t7.start();
      await globalTagValidator.loadAvailableTags(tagsDir);
      t7.end();
      console.log(`   Found ${globalTagValidator.getAvailableTagsCount()} tags\n`);
    } else {
      globalTagValidator.reset();
    }

    // Step 5: Ensure routes directory exists
    // Note: Routes must be in src/routes/ for @marko/run compatibility
    const routesDir = path.join(appRoot, 'src', 'routes');
    await fs.mkdir(routesDir, { recursive: true });

    // Step 6: Initialize empty route manifest for plugins to extend
    let routeManifest: Record<string, any> = {};

    // Step 7: Execute extendRoutes hooks
    if (pluginManager) {
      const t5 = time('Extend routes hooks');
      t5.start();
      routeManifest = await pluginManager.execExtendRoutesHooks(routeManifest);
      t5.end();
      console.log('🔌 Extended routes manifest:', Object.keys(routeManifest).length);
    }

    // Step 8: Generate routes for content
    console.log('📝 Generating routes from content...');
    const t6 = time('Route generation');
    t6.start();
    const routeMode = useCatchAllRoutes ?? config.build.useCatchAllRoutes;

    // Step 7.5: Pre-render markdown to .marko files (build mode only)
    // This runs before route generation so that import.meta.glob can discover the files
    console.log('📄 Pre-rendering markdown to .marko files...');
    const t7b = time('Pre-render markdown');
    t7b.start();
    const generatedMarkdownDir = path.join(appRoot, 'src', '.generated', 'markdown');
    await fs.mkdir(generatedMarkdownDir, { recursive: true });
    const markdownMetadata: Record<string, {
      frontmatter: Record<string, unknown>;
      headers: unknown[];
      headTop: unknown[];
      headBottom: unknown[];
    }> = {};
    let preRenderedCount = 0;

    for (const mod of modules) {
      const moduleMarkdownDir = path.join(generatedMarkdownDir, mod.id);
      await fs.mkdir(moduleMarkdownDir, { recursive: true });

      for (const file of mod.files) {
        try {
          const source = await fs.readFile(file.filePath, 'utf-8');
          const base = (config.site?.base || '/').replace(/\/$/, '');
          const rendered = await renderMarkdown(source, { base });

          // Write .marko file with escaped HTML
          // Clean up Shiki output: remove empty trailing <span class="line"></span>
          // before </code> since Marko's parser is strict about tag nesting
          let cleanHtml = rendered.html.replace(/<span class="line"><\/span>(\s*<\/code>)/g, '$1');
          const markoContent = `<div class="markdown-content">\n${escapeMarkoText(cleanHtml)}\n</div>`;
          const markoPath = path.join(moduleMarkdownDir, `${file.slug}.marko`);
          await fs.writeFile(markoPath, markoContent);

          // Store metadata
          const metaKey = `${mod.id}/${file.slug}`;
          markdownMetadata[metaKey] = {
            frontmatter: rendered.frontmatter,
            headers: rendered.headers || [],
            // Include head tags from plugin enhancements (head-inject plugin adds these)
            headTop: file.headTop || [],
            headBottom: file.headBottom || [],
          };

          preRenderedCount++;
        } catch (err) {
          console.warn(`   Warning: Failed to pre-render ${mod.id}/${file.slug}:`, err);
        }
      }
    }

    // Write metadata as JS module (placed outside markdown/ dir to avoid vite plugin collision)
    const metadataPath = path.join(appRoot, 'src', '.generated', 'content-metadata.js');
    const metadataJs = `// Auto-generated by MarkoPress - Do not edit\nexport default ${JSON.stringify(markdownMetadata, null, 2)};\n`;
    await fs.writeFile(metadataPath, metadataJs);
    t7b.end();
    console.log(`   Pre-rendered ${preRenderedCount} markdown files\n`);

    if (routeMode) {
      await generateCatchAllRoutes(manifest, routesDir, config, modules, debug, true);
      console.log('   Using catch-all dynamic routes');
    } else {
      await generateRoutes(manifest, routesDir, config, modules, debug);
      console.log('   Using static routes');
    }
    t6.end();
    console.log('   Routes generated\n');

    // Step 9: Convert routeManifest entries with handler/component to plugin routes
    // This allows plugins to add custom routes via extendRoutes hook
    const manifestRoutes: any[] = [];
    for (const [path, route] of Object.entries(routeManifest)) {
      if ((route as any).handler || (route as any).component) {
        manifestRoutes.push({ path, ...(route as any) });
        console.log(`   Found plugin route: ${path}`);
      }
    }

    console.log(`🔌 Total manifest routes: ${Object.keys(routeManifest).length}, Plugin routes: ${manifestRoutes.length}`);

    // Step 10: Generate plugin routes
    if (pluginManager) {
      const pluginRoutes = pluginManager.getPluginRoutes();
      const allPluginRoutes = [...pluginRoutes, ...manifestRoutes];
      if (allPluginRoutes.length > 0) {
        console.log(`🔌 Generating ${allPluginRoutes.length} plugin routes...`);
        const t7 = time('Plugin route generation');
        t7.start();
        await generatePluginRoutes(allPluginRoutes, routesDir, config, debug);
        t7.end();
        console.log('   Plugin routes generated\n');
      }
    }

    // Step 11: Generate Vite config for markdown content plugin
    console.log('⚙️ Generating Vite config...');
    const t10 = time('Vite config generation');
    t10.start();
    await generateViteConfig(appRoot, debug);
    t10.end();
    console.log('   Vite config generated\n');

    // Step 12: Execute allContentLoaded hooks
    if (pluginManager) {
      console.log('🔌 Processing plugin allContentLoaded hooks...');
      const t8 = time('AllContentLoaded hooks');
      t8.start();
      await pluginManager.execAllContentLoadedHooks(routeManifest);
      t8.end();
      console.log('   All content processed\n');

      // Write content registry data for cross-section access
      const registryData = pluginManager.getPluginData();
      if (registryData.has('contentRegistry')) {
        const generatedDir2 = path.join(appRoot, 'src', '.generated');
        await fs.mkdir(generatedDir2, { recursive: true });
        const registryJson = registryData.get('contentRegistry');
        // Write .js for build mode handlers
        const registryPath = path.join(generatedDir2, 'content-registry.js');
        const registryJs = `// Auto-generated by MarkoPress content-registry plugin - Do not edit\nexport default ${JSON.stringify(registryJson, null, 2)};\n`;
        await fs.writeFile(registryPath, registryJs, 'utf-8');
        // Write .json for dev mode handlers
        const registryJsonPath = path.join(generatedDir2, 'content-registry.json');
        await fs.writeFile(registryJsonPath, JSON.stringify(registryJson, null, 2), 'utf-8');
        console.log('   Wrote content registry to src/.generated/content-registry.{js,json}\n');
      }
    }

    // Step 12: Validate Marko tags if enabled
    if (config.markdown.markoTags?.enabled) {
      console.log('🔍 Validating Marko tags...');
      const t9 = time('Tag validation');
      t9.start();
      const validation = globalTagValidator.validate();
      t9.end();

      if (!validation.success) {
        const errorMessage = formatValidationError(validation.missingTags);
        console.error(`\n${errorMessage}\n`);
        errors.push(errorMessage);

        return {
          success: false,
          outDir: '',
          pages: 0,
          errors,
        };
      }

      console.log('   All tags validated ✓\n');
    }

    // Step 13: Copy theme CSS to public directory
    console.log('🎨 Copying theme CSS...');
    const t11 = time('Theme CSS copy');
    t11.start();
    await copyThemeCSS(appRoot, config, debug);
    t11.end();
    console.log('   Theme CSS copied\n');

    // Step 14: Extract styles from user-defined Marko components
    console.log('🎨 Extracting styles from Marko components...');
    const t12 = time('Marko component styles extraction');
    t12.start();
    await extractStylesFromMarkoTags(appRoot, config, debug);
    t12.end();
    console.log('   Component styles extracted\n');

    // Step 15: Theme components are auto-discovered from the markopress package
    // via marko metadata (marko.json + package exports)
    // console.log('📦 Copying theme components...');
    // const t13 = time('Theme components copy');
    // t13.start();
    // await copyThemeComponents(root, config, debug);
    // t13.end();
    // console.log('   Theme components copied\n');

    // Step 15.5: Generate static URL manifest for the static adapter
    // This allows @marko/run-adapter-static to crawl all dynamic routes
    const staticUrls: string[] = [];
    for (const mod of modules) {
      for (const file of mod.files) {
        staticUrls.push(file.urlPath);
      }
    }
    // Add plugin routes (e.g., /blog index page)
    for (const routePath of Object.keys(routeManifest)) {
      if (!staticUrls.includes(routePath)) {
        staticUrls.push(routePath);
      }
    }
    const staticUrlsPath = path.join(appRoot, 'src', '.generated', 'static-urls.json');
    await fs.mkdir(path.dirname(staticUrlsPath), { recursive: true });
    await fs.writeFile(staticUrlsPath, JSON.stringify(staticUrls, null, 2));
    if (debug) {
      console.log(`   Generated static URL manifest: ${staticUrls.length} URLs`);
    }

    // Step 16: Build with @marko/run
    console.log('🔨 Building with @marko/run...');
    const t14 = time('@marko/run build');
    t14.start();
    const resolvedOutDir = outDir || config.build.outDir;
    const buildResult = await runMarkoRunBuild(resolvedOutDir, debug, appRoot);
    t14.end();

    if (!buildResult.success) {
      errors.push(...buildResult.errors);
      return {
        success: false,
        outDir: '',
        pages: 0,
        errors,
      };
    }

    // Step 17: Collect build assets
    const t15 = time('Collect build assets');
    t15.start();
    const assets = await collectBuildAssets(buildResult.outDir);
    t15.end();

    // Step 18: Execute postBuild hooks
    if (pluginManager) {
      console.log('🔌 Processing plugin postBuild hooks...');
      const t16 = time('Post-build hooks');
      t16.start();
      await pluginManager.execPostBuildHooks(
        config,
        buildResult.outDir,
        routeManifest,
        assets
      );
      t16.end();
      console.log('   Post-build hooks completed\n');
    }

    // Step 19: Copy Marko tags directory to output (after build so it doesn't get cleaned)
    console.log('📦 Copying Marko tags directory...');
    const t18 = time('Copy tags directory');
    t18.start();
    await copyTagsDirectory(root, buildResult.outDir, config, debug);
    t18.end();
    console.log('   Tags directory copied\n');

    console.log('\n✅ Build completed successfully!');
    console.log(`   Output: ${buildResult.outDir}`);
    console.log(`   Pages: Generated dynamically at request time`);

    // Print timing summary
    console.log('\n⏱️  Build timing:');
    const sortedTimings = Array.from(timings.entries()).sort((a, b) => b[1] - a[1]);
    for (const [label, time] of sortedTimings) {
      const seconds = (time / 1000).toFixed(2);
      const bar = '█'.repeat(Math.min(Math.floor(time / 100), 20));
      console.log(`   ${bar} ${label}: ${seconds}s`);
    }

    return {
      success: true,
      outDir: buildResult.outDir,
      pages: 0, // Pages generated dynamically at request time
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);
    console.error('\n❌ Build failed:', errorMessage);

    return {
      success: false,
      outDir: '',
      pages: 0,
      errors,
    };
  }
}

/**
 * Generate plugin-defined routes
 */
async function generatePluginRoutes(
  routes: any[],
  routesDir: string,
  config: ResolvedConfig,
  debug: boolean
): Promise<void> {
  for (const route of routes) {
    const routePath = route.path.slice(1); // Remove leading slash
    const dir = path.join(routesDir, routePath, '+page');

    await fs.mkdir(path.dirname(dir), { recursive: true });

    // Generate handler if specified
    if (route.handler) {
      const handlerFile = path.join(path.dirname(dir), '+handler.js');
      await fs.writeFile(handlerFile, route.handler);
    }

    // Generate page if component specified
    if (route.component) {
      const pageFile = dir + '.marko';
      await fs.writeFile(pageFile, route.component);
    }

    if (debug) {
      console.log(`   Generated plugin route: ${route.path}`);
    }
  }
}

/**
 * Prefix all `link` properties in module enhancements with the base path.
 * Handles sidebar items (nested) and blog posts (flat array).
 */
function prefixEnhancementLinks(enhancements: Record<string, unknown>, base: string): void {
  // Prefix sidebar items
  if (Array.isArray(enhancements.sidebar)) {
    enhancements.sidebar = (enhancements.sidebar as any[]).map(section => ({
      ...section,
      items: Array.isArray(section.items)
        ? section.items.map((item: any) => ({
            ...item,
            link: item.link && !item.link.startsWith(base) ? base + item.link : item.link,
          }))
        : section.items,
    }));
  }

  // Prefix blog post links
  if (Array.isArray(enhancements.blogPosts)) {
    enhancements.blogPosts = (enhancements.blogPosts as any[]).map(post => ({
      ...post,
      link: post.link && !post.link.startsWith(base) ? base + post.link : post.link,
    }));
  }
}

/**
 * Collect build assets from output directory
 */
async function collectBuildAssets(outDir: string): Promise<string[]> {
  const assets: string[] = [];

  try {
    const files = await fs.readdir(outDir, { recursive: true });

    for (const file of files) {
      if (typeof file === 'string' && (file.endsWith('.js') || file.endsWith('.css') || file.endsWith('.json'))) {
        assets.push(file);
      }
    }
  } catch (error) {
    // If directory doesn't exist or can't be read, return empty array
    console.warn('Warning: Could not collect build assets:', error);
  }

  return assets;
}

/**
 * Generate route files from content manifest
 * Works with dynamic manifest structure
 */
export async function generateRoutes(
  manifest: ContentManifest,
  routesDir: string,
  config: ResolvedConfig,
  modules: ContentModule[],
  debug: boolean
): Promise<void> {
  // Clean up old generated routes safely
  // Only delete files in directories we manage, preserving user's custom files
  await cleanupGeneratedRoutes(routesDir, manifest, debug);

  // Collect module IDs from manifest for cleanup
  const moduleIds: string[] = [];
  let pageCount = 0;
  let docCount = 0;
  let blogCount = 0;

  // Generate routes for each module dynamically
  for (const [moduleId, files] of Object.entries(manifest)) {
    // Skip non-array entries
    if (!Array.isArray(files)) continue;

    moduleIds.push(moduleId);
    const contentFiles = files as ContentFile[];

    if (moduleId === 'pages') {
      // Generate static page routes (root-level, no prefix)
      for (const page of contentFiles) {
        await generatePageRoute(page, routesDir, config, modules, debug);
        pageCount++;
      }
    } else if (moduleId === 'blog') {
      // Generate individual blog routes
      for (const post of contentFiles) {
        await generateBlogRoute(post, routesDir, config, modules, debug);
        blogCount++;
      }
    } else {
      // Generate individual doc routes for all other modules
      for (const doc of contentFiles) {
        await generateDocRoute(doc, routesDir, config, modules, debug);
        docCount++;
      }
    }
  }

  // Generate config file for handlers
  await generateConfigFile(routesDir, config, debug);

  // Generate vite.config.js for markdown content virtual module support
  // routesDir is <appRoot>/src/routes, so appRoot is two levels up
  const appRootFromRoutes = path.resolve(routesDir, '..', '..');
  await generateViteConfig(appRootFromRoutes, debug);

  // Generate root layout that wraps all pages with <${input.content}/>
  await generateRootLayout(routesDir, config, debug);

  if (debug) {
    console.log(`   Generated ${pageCount} page routes`);
    console.log(`   Generated ${docCount} doc routes`);
    console.log(`   Generated ${blogCount} blog routes`);
  }
}

/**
 * Safely clean up generated routes without deleting user files
 *
 * Security: Only deletes files in specific directories we manage.
 * Preserves user's custom route handlers, middleware, and components.
 *
 * @param routesDir - Root routes directory
 * @param manifest - Content manifest to determine what to keep
 * @param debug - Enable debug logging
 */
export async function cleanupGeneratedRoutes(
  routesDir: string,
  manifest: ContentManifest,
  debug: boolean
): Promise<void> {
  const errors: string[] = [];

  // Files that should NEVER be deleted (user's custom files)
  const PRESERVE_PATTERNS = [
    '+layout.marko',      // Root layout
    '+middleware.js',     // Custom middleware
    'components/**/*',    // User's components
    'api/**/*',          // User's API routes
    'lib/**/*',          // User's utilities
  ];

  // Build dynamic managed prefixes from manifest
  // Skip 'pages' (root-level, no directory prefix)
  const MANAGED_PREFIXES = Object.keys(manifest)
    .filter(key => key !== 'pages')
    .map(key => `${key}/`);

  try {
    const allFiles = await fs.readdir(routesDir, {
      recursive: true,
      withFileTypes: true,
    });

    for (const entry of allFiles) {
      if (!entry.isFile()) continue;

      // Build full path
      const fullPath = path.join(entry.path || entry.parentPath || routesDir, entry.name);
      const relativePath = path.relative(routesDir, fullPath);

      // Check if file is in a managed directory
      const isInManagedDir = MANAGED_PREFIXES.some((prefix) =>
        relativePath.startsWith(prefix)
      );

      if (!isInManagedDir) {
        // Not in a directory we manage, skip
        continue;
      }

      // Check if file matches preserve patterns
      const shouldPreserve = PRESERVE_PATTERNS.some((pattern) => {
        if (pattern.includes('**')) {
          // Glob pattern matching
          const regex = new RegExp(
            pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')
          );
          return regex.test(relativePath);
        }
        return entry.name === pattern;
      });

      if (shouldPreserve) {
        if (debug) console.log(`   Preserving: ${relativePath}`);
        continue;
      }

      // Safe to delete this generated file
      try {
        await fs.unlink(fullPath);
        if (debug) console.log(`   Deleted: ${relativePath}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          // Only report non-"file not found" errors
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          errors.push(`Failed to delete ${relativePath}: ${errorMessage}`);
        }
      }
    }

    // Clean up empty directories in managed paths
    for (const prefix of MANAGED_PREFIXES) {
      const dirPath = path.join(routesDir, prefix);
      try {
        await cleanupEmptyDirectories(dirPath);
      } catch {
        // Directory might not exist, that's okay
      }
    }

    if (errors.length > 0) {
      console.warn('⚠️  Cleanup warnings:');
      errors.forEach((err) => console.warn(`   ${err}`));
    }
  } catch (error) {
    // Routes directory might not exist yet, that's okay for initial build
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Recursively remove empty directories
 * @param dirPath - Directory to clean up
 */
async function cleanupEmptyDirectories(dirPath: string): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    // Recursively clean subdirectories first
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDirPath = path.join(dirPath, entry.name);
        await cleanupEmptyDirectories(subDirPath);
      }
    }

    // Check if directory is now empty
    const updatedEntries = await fs.readdir(dirPath);
    if (updatedEntries.length === 0) {
      await fs.rmdir(dirPath);
    }
  } catch {
    // Ignore errors (directory might not exist or not be empty)
  }
}

/**
 * Generate a static page route
 * NOTE: This function is deprecated in favor of catch-all routes with request-time rendering.
 * Kept for backward compatibility with useCatchAllRoutes: false
 */
async function generatePageRoute(
  page: ContentFile,
  routesDir: string,
  config: ResolvedConfig,
  modules: ContentModule[],
  debug: boolean
): Promise<void> {
  // Static routes are deprecated - use catch-all routes instead
  if (debug) {
    console.log(`   Warning: Static routes deprecated, use catch-all routes`);
  }
}

/**
 * Generate a single documentation route
 * NOTE: This function is deprecated in favor of catch-all routes with request-time rendering.
 * Kept for backward compatibility with useCatchAllRoutes: false
 */
async function generateDocRoute(
  doc: ContentFile,
  routesDir: string,
  config: ResolvedConfig,
  modules: ContentModule[],
  debug: boolean
): Promise<void> {
  // Static routes are deprecated - use catch-all routes instead
  if (debug) {
    console.log(`   Warning: Static routes deprecated, use catch-all routes`);
  }
}

/**
 * Generate a single blog route
 * NOTE: This function is deprecated in favor of catch-all routes with request-time rendering.
 * Kept for backward compatibility with useCatchAllRoutes: false
 */
async function generateBlogRoute(
  post: ContentFile,
  routesDir: string,
  config: ResolvedConfig,
  modules: ContentModule[],
  debug: boolean
): Promise<void> {
  // Static routes are deprecated - use catch-all routes instead
  if (debug) {
    console.log(`   Warning: Static routes deprecated, use catch-all routes`);
  }
}

/**
 * Generate config file for handlers to import
 * This makes theme options (navbar, footer, etc.) available to route handlers
 */
async function generateConfigFile(
  routesDir: string,
  config: ResolvedConfig,
  debug: boolean
): Promise<void> {
  const configFile = path.join(routesDir, '_config.js');

  // Export the full config (except root which we add separately)
  // Include all fields needed by handlers and templates
  const handlerConfig = {
    root: config.root,
    contentDir: config.contentDir,
    site: {
      title: config.site?.title || 'MarkoPress',
      description: config.site?.description || '',
      lang: config.site?.lang || 'en-US',
      head: config.site?.head || [],
      base: config.site?.base || '/',
    },
    content: config.content,
    theme: {
      name: config.theme?.name || '@markopress/theme-default',
      options: config.theme?.options || {},
    },
    markdown: config.markdown || {},
    build: config.build || {},
    _headInject: (config as any)._headInject || undefined,
  };

  // Prefix navbar links with base path
  const base = (config.site?.base || '/').replace(/\/$/, '');
  if (base && handlerConfig.theme.options?.navbar) {
    handlerConfig.theme.options.navbar = handlerConfig.theme.options.navbar.map((item: any) => ({
      ...item,
      link: item.link && !item.link.startsWith(base) ? base + item.link : item.link,
    }));
  }

  // Export as ES module
  const content = `// Auto-generated by MarkoPress - Do not edit
export const config = ${JSON.stringify(handlerConfig, null, 2)};
`;

  await fs.writeFile(configFile, content);

  if (debug) {
    console.log(`   Generated: ${configFile}`);
  }
}

/**
 * Generate root layout
 */
async function generateRootLayout(
  routesDir: string,
  config: ResolvedConfig,
  debug: boolean
): Promise<void> {
  const layoutFile = path.join(routesDir, '+layout.marko');

  // Get navbar settings from config
  const navbar = config.theme?.options?.navbar || [];
  const siteTitle = config.site?.title || 'MarkoPress';

  // Get theme style (default, vitepress, or docusaurus)
  const themeStyle = (config.theme?.options?.style as string) || 'default';

  // Generate layout using template file
  const basePath = config.site?.base?.replace(/\/$/, '') || '';
  const componentStylesLink = config.markdown?.markoTags?.enabled
    ? `<link rel="stylesheet" href="${basePath}/markopress-components.css">`
    : '';
  const template = await loadTemplate('layout.marko.template', {
    SITE_TITLE: siteTitle,
    THEME_STYLE: themeStyle,
    BASE_PATH: basePath,
    COMPONENT_STYLES_LINK: componentStylesLink,
  });

  await fs.writeFile(layoutFile, template);

  if (debug) {
    console.log(`   Generated: ${layoutFile}`);
  }
}

/**
 * Load a template file and replace placeholders
 */
async function loadTemplate(
  templateName: string,
  replacements: Record<string, string>
): Promise<string> {
  // Template files are in the templates/ directory at package root
  // When running from dist/, go up one level to find templates/
  const distDir = path.dirname(new URL(import.meta.url).pathname);
  const packageRoot = path.join(distDir, '..', '..');
  const templatePath = path.join(packageRoot, 'templates', templateName);

  let template = await fs.readFile(templatePath, 'utf-8');

  // Strip conditional blocks based on IS_BUILD
  // In dev mode, remove {{IF_BUILD_START}}...{{IF_BUILD_END}} blocks
  // In build mode, remove {{IF_DEV_START}}...{{IF_DEV_END}} blocks
  // Keep the other mode's content but remove its markers
  const isBuild = replacements.IS_BUILD === 'true';
  if (!isBuild) {
    template = template.replace(/\/\/ \{\{IF_BUILD_START\}\}[\s\S]*?\/\/ \{\{IF_BUILD_END\}\}/g, '');
  } else {
    template = template.replace(/\/\/ \{\{IF_DEV_START\}\}[\s\S]*?\/\/ \{\{IF_DEV_END\}\}/g, '');
  }
  // Clean remaining markers from the kept blocks
  template = template.replace(/\/\/ \{\{IF_(?:BUILD|DEV)_(?:START|END)\}\}\n?/g, '');

  // Replace all placeholders
  for (const [key, value] of Object.entries(replacements)) {
    template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return template;
}

/**
 * Validate theme name to prevent path traversal attacks
 *
 * @param name - Theme package name to validate
 * @throws {Error} If theme name is invalid or contains path traversal
 *
 * Security: Only allows valid npm package names:
 * - Scoped: @scope/package-name (forward slash allowed after @)
 * - Unscoped: package-name
 * - Characters: lowercase letters, numbers, hyphens, dots, underscores
 */
export function validateThemeName(name: string): void {
  // Valid npm package name pattern (scoped or unscoped)
  // Allows: @scope/package, package-name, @org/my-package
  const validPackageRegex = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

  if (!validPackageRegex.test(name)) {
    throw new Error(
      `Invalid theme name: "${name}". Must be a valid npm package name ` +
      `(e.g., "my-theme" or "@org/my-theme")`
    );
  }

  // Explicitly block path traversal attempts
  if (name.includes('..')) {
    throw new Error(
      `Theme name cannot contain traversal sequences (..): "${name}"`
    );
  }

  // Block backslashes (Windows path separator)
  if (name.includes('\\')) {
    throw new Error(
      `Theme name cannot contain backslashes: "${name}"`
    );
  }

  // Block multiple forward slashes (only one allowed in scoped packages)
  const slashCount = (name.match(/\//g) || []).length;
  if (slashCount > 1) {
    throw new Error(
      `Theme name can only contain one forward slash (for scoped packages): "${name}"`
    );
  }

  // Block absolute paths (starts with / on Unix or C:\ on Windows)
  if (path.isAbsolute(name)) {
    throw new Error(`Theme name cannot be an absolute path: "${name}"`);
  }
}

/**
 * Generate Vite config that extends @marko/run with markdown content plugin
 */
export async function generateViteConfig(
  rootDir: string,
  debug: boolean
): Promise<void> {
  const viteConfigPath = path.join(rootDir, 'vite.config.js');
  const viteConfigContent = `import { defineConfig } from 'vite';
import marko from '@marko/run/vite';
import { markdownContentPlugin } from 'markopress/build';

export default defineConfig({
  plugins: [
    marko(),
    markdownContentPlugin(),
  ],
  resolve: {
    // Preserve symlinks for pnpm workspace compatibility
    // This allows Marko to properly discover tags from symlinked packages
    preserveSymlinks: true,
  },
  build: {
    outDir: 'dist',
  },
});
`;

  try {
    // Check if file already exists and has our plugin
    const existing = await fs.readFile(viteConfigPath, 'utf-8');
    if (existing.includes('markdownContentPlugin')) {
      if (debug) {
        console.log('   Vite config already has markdownContentPlugin');
      }
      return;
    }
  } catch {
    // File doesn't exist, create it
  }

  await fs.writeFile(viteConfigPath, viteConfigContent);
  if (debug) {
    console.log(`   Created vite.config.js with markdownContentPlugin`);
  }
}

/**
 * Copy theme CSS to public directory
 */
export async function copyThemeCSS(
  rootDir: string,
  config: ResolvedConfig,
  debug: boolean
): Promise<void> {
  // Create the _markopress/theme directory in public
  const themeDir = path.join(rootDir, 'public', '_markopress', 'theme');
  await fs.mkdir(themeDir, { recursive: true });

  const themeName = config.theme?.name || '@markopress/theme-default';

  // Security: Validate theme name to prevent path traversal
  try {
    validateThemeName(themeName);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Security: ${errorMessage}`);
  }

  // Get the style from theme options
  const style = (config.theme?.options?.style as 'default' | 'vitepress' | 'docusaurus') || 'default';
  const cssFileName = `theme-${style}.css`;

  // Try multiple locations for the pre-generated theme CSS
  const possiblePaths = [
    ...(isInternalDefaultTheme(themeName)
      ? [path.join(INTERNAL_DEFAULT_THEME_ROOT, 'public', cssFileName)]
      : []),
    // pnpm workspace: root node_modules
    path.join(rootDir, '..', 'node_modules', themeName, 'public', cssFileName),
    // Local node_modules
    path.join(rootDir, 'node_modules', themeName, 'public', cssFileName),
  ];

  let themeCSS: string | null = null;
  let foundPath: string | null = null;

  for (const cssPath of possiblePaths) {
    try {
      await fs.access(cssPath);
      themeCSS = await fs.readFile(cssPath, 'utf-8');
      foundPath = cssPath;
      break;
    } catch {
      // Try next path
    }
  }

  if (!themeCSS) {
    // Fallback: create a minimal CSS file
    console.warn(`   Warning: Could not find ${cssFileName}, using minimal fallback`);
    const fallbackCSS = `/* Minimal fallback CSS for style: ${style} */\nbody { font-family: system-ui, sans-serif; margin: 0; padding: 0; }`;
    const outputPath = path.join(themeDir, cssFileName);
    await fs.writeFile(outputPath, fallbackCSS);
    return;
  }

  // Write the CSS file
  const outputPath = path.join(themeDir, cssFileName);
  await fs.writeFile(outputPath, themeCSS);

  if (debug) {
    console.log(`   Copied ${cssFileName} from: ${foundPath}`);
    console.log(`   Output: ${outputPath}`);
  }

  // Also copy the component styles (styles.css) from the theme package
  const stylesCSSFileName = 'styles.css';
  const stylesPossiblePaths = [
    ...(isInternalDefaultTheme(themeName)
      ? [path.join(INTERNAL_DEFAULT_THEME_ROOT, stylesCSSFileName)]
      : []),
    path.join(rootDir, '..', 'node_modules', themeName, 'src', stylesCSSFileName),
    path.join(rootDir, 'node_modules', themeName, 'src', stylesCSSFileName),
  ];

  for (const cssPath of stylesPossiblePaths) {
    try {
      await fs.access(cssPath);
      const stylesCSS = await fs.readFile(cssPath, 'utf-8');
      const stylesOutputPath = path.join(themeDir, stylesCSSFileName);
      await fs.writeFile(stylesOutputPath, stylesCSS);
      if (debug) {
        console.log(`   Copied ${stylesCSSFileName} from: ${cssPath}`);
        console.log(`   Output: ${stylesOutputPath}`);
      }
      break;
    } catch {
      // Try next path
    }
  }
}

/**
 * Extract styles from user-defined Marko components
 * Scans the tags directory, extracts <style> blocks from .marko files,
 * and combines them into a single CSS file for global loading
 *
 * This is necessary because request-time virtual markdown modules
 * do not emit tag-local CSS assets reliably.
 */
export async function extractStylesFromMarkoTags(
  rootDir: string,
  config: ResolvedConfig,
  debug: boolean
): Promise<void> {
  const tagsDirConfig = config.markdown?.markoTags?.tagsDir || 'src/tags';
  const tagsDir = path.join(rootDir, tagsDirConfig);

  // Create public directory if it doesn't exist
  const publicDir = path.join(rootDir, 'public');
  await fs.mkdir(publicDir, { recursive: true });
  const outputPath = path.join(publicDir, 'markopress-components.css');

  // Only extract styles when marko tags feature is enabled
  if (!config.markdown?.markoTags?.enabled) {
    if (debug) {
      console.log(`   Marko tags not enabled, skipping style extraction`);
    }
    // Remove stale CSS file if it exists
    try { await fs.unlink(outputPath); } catch {}
    return;
  }

  // Check if tags directory exists
  try {
    await fs.access(tagsDir);
  } catch {
    // Tags directory doesn't exist, skip extraction
    if (debug) {
      console.log(`   No tags directory found at: ${tagsDir}`);
    }
    return;
  }

  // Collect all .marko files recursively
  const markoFiles: string[] = [];
  async function collectMarkoFiles(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await collectMarkoFiles(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.marko')) {
        markoFiles.push(fullPath);
      }
    }
  }

  await collectMarkoFiles(tagsDir);

  if (markoFiles.length === 0) {
    if (debug) {
      console.log(`   No .marko files found in: ${tagsDir}`);
    }
    return;
  }

  // Extract styles from each .marko file
  const cssEntries: string[] = [];
  cssEntries.push('/* Custom markdown tag styles');
  cssEntries.push(' * Loaded globally because request-time virtual markdown modules');
  cssEntries.push(' * do not emit tag-local CSS assets reliably. */');
  cssEntries.push('');

  for (const filePath of markoFiles) {
    const relativePath = path.relative(tagsDir, filePath);
    const componentName = path.dirname(relativePath) === ''
      ? path.basename(relativePath, '.marko')
      : path.join(path.dirname(relativePath), path.basename(relativePath, '.marko'));

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Extract <style> blocks using regex
      // Match both <style>...</style> and <style>...</style> with attributes
      const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
      const matches = Array.from(content.matchAll(styleRegex));

      if (matches.length > 0) {
        cssEntries.push(`/* ${componentName}.marko */`);

        for (const match of matches) {
          const styleContent = match[1] || '';
          if (styleContent) {
            // Split into lines and trim leading/trailing empty lines
            const lines = styleContent.split('\n');

            // Find first non-empty line
            let startIndex = 0;
            while (startIndex < lines.length && lines[startIndex].trim() === '') {
              startIndex++;
            }

            // Find last non-empty line
            let endIndex = lines.length - 1;
            while (endIndex >= startIndex && lines[endIndex].trim() === '') {
              endIndex--;
            }

            // Process the non-empty content
            for (let i = startIndex; i <= endIndex; i++) {
              const line = lines[i];
              // Preserve empty lines within the content
              if (line.trim() === '') {
                cssEntries.push('');
                continue;
              }
              // Detect current indentation level and normalize to 2-space increments
              const indentMatch = line.match(/^(\s*)/);
              const currentIndent = indentMatch ? indentMatch[1].length : 0;
              // Normalize: preserve relative indentation but normalize to 2-space base
              // If source uses 4-space indent, convert to 2-space; if 2-space, keep as-is
              const normalizedIndent = Math.floor(currentIndent / 2);
              const newIndent = '  '.repeat(normalizedIndent);
              const content = line.trim();
              // Remove :global() wrappers - they're for CSS Modules, not global CSS
              const strippedGlobal = content.replace(/:global\(([^)]+)\)/g, '$1');
              cssEntries.push(newIndent + strippedGlobal);
            }
          }
        }

        cssEntries.push('');
      }
    } catch (error) {
      console.warn(`   Warning: Could not read file ${filePath}:`, error);
    }
  }

  // Write the combined CSS file
  const cssContent = cssEntries.join('\n');

  await fs.writeFile(outputPath, cssContent);

  if (debug) {
    console.log(`   Extracted styles from ${markoFiles.length} Marko component(s)`);
    console.log(`   Output: ${outputPath}`);
  }
}

/**
 * Copy theme components to routes/tags directory for Marko auto-discovery
 * This makes theme components (like <theme-navbar-end>, <toc>, etc.) available
 * without requiring explicit imports in templates
 */
async function getAllMarkoFiles(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? getAllMarkoFiles(res) : res;
    })
  );
  return Array.prototype.concat(...files).filter(file => file.endsWith('.marko'));
}

export async function copyThemeComponents(
  rootDir: string,
  config: ResolvedConfig,
  debug: boolean
): Promise<void> {
  const themeName = config.theme?.name || '@markopress/theme-default';

  // Target directory: src/tags/ where Marko can find from both routes and generated files
  const srcDir = path.join(rootDir, 'src');
  const tagsDir = path.join(srcDir, 'tags');

  // Ensure tags directory exists
  await fs.mkdir(tagsDir, { recursive: true });

  // Possible locations for theme components
  const possiblePaths = [
    ...(isInternalDefaultTheme(themeName)
      ? [path.join(INTERNAL_DEFAULT_THEME_ROOT, 'tags')]
      : []),
    // pnpm workspace: root node_modules (dist tags)
    path.join(rootDir, '..', 'node_modules', themeName, 'dist', 'tags'),
    // Local node_modules (dist tags)
    path.join(rootDir, 'node_modules', themeName, 'dist', 'tags'),
    // pnpm workspace: root node_modules (source components)
    path.join(rootDir, '..', 'node_modules', themeName, 'src', 'components'),
    // Local node_modules (source components)
    path.join(rootDir, 'node_modules', themeName, 'src', 'components'),
  ];

  let sourceTagsDir: string | null = null;

  for (const dirPath of possiblePaths) {
    try {
      // Check if directory exists
      await fs.access(dirPath);
      sourceTagsDir = dirPath;
      break;
    } catch {
      // Directory doesn't exist, continue
    }
  }

  if (!sourceTagsDir) {
    if (debug) {
      console.warn(`   Warning: Could not find theme components, skipping`);
    }
    return;
  }

  // Get all .marko files recursively
  const allMarkoFiles = await getAllMarkoFiles(sourceTagsDir);
  let copiedCount = 0;

  for (const file of allMarkoFiles) {
    const relativePath = path.relative(sourceTagsDir, file);
    const destPath = path.join(tagsDir, relativePath);

    let exists = false;
    try {
      await fs.access(destPath);
      exists = true;
    } catch {
      // file does not exist
    }

    if (exists) {
      if (debug) {
        console.log(`   Skipped component (user override exists): ${relativePath}`);
      }
    } else {
      // File doesn't exist, so copy it
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(file, destPath);
      copiedCount++;
    }
  }

  if (debug) {
    console.log(`   Copied ${copiedCount} theme components from: ${sourceTagsDir}`);
    console.log(`   Output: ${tagsDir}`);
  }
}

/**
 * Copy Marko tags directory to output directory for component discovery
 * This allows Marko runtime to find and render custom components
 */
export async function copyTagsDirectory(
  rootDir: string,
  outDir: string,
  config: ResolvedConfig,
  debug: boolean
): Promise<void> {
  const tagsDirConfig = config.markdown?.markoTags?.tagsDir || 'src/tags';
  const tagsDir = path.join(rootDir, tagsDirConfig);
  const distTagsDir = path.join(outDir, 'tags');

  // Check if tags directory exists
  try {
    await fs.access(tagsDir);
  } catch {
    // Tags directory doesn't exist, skip copying
    if (debug) {
      console.log(`   No tags directory found at: ${tagsDir}`);
    }
    return;
  }

  // Create destination directory
  await fs.mkdir(distTagsDir, { recursive: true });

  // Copy all tag files recursively
  const files = await fs.readdir(tagsDir, { withFileTypes: true });
  let copiedCount = 0;

  for (const file of files) {
    const srcPath = path.join(tagsDir, file.name);
    const destPath = path.join(distTagsDir, file.name);

    if (file.isDirectory()) {
      // Recursively copy subdirectories
      await fs.mkdir(destPath, { recursive: true });
      const subFiles = await fs.readdir(srcPath, { withFileTypes: true });
      for (const subFile of subFiles) {
        const subSrcPath = path.join(srcPath, subFile.name);
        const subDestPath = path.join(destPath, subFile.name);
        if (!subFile.isDirectory()) {
          await fs.copyFile(subSrcPath, subDestPath);
          copiedCount++;
        }
      }
    } else if (file.isFile()) {
      // Copy tag files (.marko, .js, .ts, etc.)
      await fs.copyFile(srcPath, destPath);
      copiedCount++;
    }
  }

  if (debug) {
    console.log(`   Copied ${copiedCount} tag files from: ${tagsDir}`);
    console.log(`   Output: ${distTagsDir}`);
  }
}

async function copyDirectoryContents(
  sourceDir: string,
  targetDir: string,
  baseSourceDir: string = sourceDir
): Promise<string[]> {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const copiedFiles: string[] = [];

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await fs.mkdir(targetPath, { recursive: true });
      copiedFiles.push(...await copyDirectoryContents(sourcePath, targetPath, baseSourceDir));
      continue;
    }

    if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
      copiedFiles.push(path.relative(baseSourceDir, sourcePath));
    }
  }

  return copiedFiles;
}

async function readSyncedPublicAssetManifest(manifestPath: string): Promise<string[]> {
  try {
    const manifest = await fs.readFile(manifestPath, 'utf-8');
    const parsed = JSON.parse(manifest);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

async function writeSyncedPublicAssetManifest(
  manifestPath: string,
  files: string[]
): Promise<void> {
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(files, null, 2));
}

async function removeStalePublicAssets(
  targetPublicDir: string,
  previousFiles: string[],
  currentFiles: string[]
): Promise<void> {
  const currentFileSet = new Set(currentFiles);
  const staleFiles = previousFiles
    .filter((file) => !currentFileSet.has(file))
    .sort((a, b) => b.length - a.length);

  for (const staleFile of staleFiles) {
    const targetPath = path.join(targetPublicDir, staleFile);
    await fs.rm(targetPath, { force: true });
    await removeEmptyParentDirectories(path.dirname(targetPath), targetPublicDir);
  }
}

async function removeEmptyParentDirectories(
  currentDir: string,
  stopDir: string
): Promise<void> {
  let dir = currentDir;

  while (dir.startsWith(stopDir) && dir !== stopDir) {
    let entries;
    try {
      entries = await fs.readdir(dir);
    } catch {
      break;
    }

    if (entries.length > 0) {
      break;
    }

    await fs.rmdir(dir);
    dir = path.dirname(dir);
  }
}

/**
 * Convert design system tokens to CSS variables
 */
function designSystemToCSS(ds: DesignSystem, darkMode: Partial<DesignSystem> | null = null): string {
  const lines: string[] = [];

  // Start :root block
  lines.push(':root {');

  // Colors
  lines.push('  /* Brand/Primary Colors */');
  lines.push(`  --color-primary-1: ${ds.colors.primary['1']};`);
  lines.push(`  --color-primary-2: ${ds.colors.primary['2']};`);
  lines.push(`  --color-primary-3: ${ds.colors.primary['3']};`);
  lines.push(`  --color-primary-soft: ${ds.colors.primary.soft};`);

  lines.push('');
  lines.push('  /* Semantic Colors */');
  lines.push(`  --color-success-1: ${ds.colors.success['1']};`);
  lines.push(`  --color-success-2: ${ds.colors.success['2']};`);
  lines.push(`  --color-success-3: ${ds.colors.success['3']};`);
  lines.push(`  --color-warning-1: ${ds.colors.warning['1']};`);
  lines.push(`  --color-warning-2: ${ds.colors.warning['2']};`);
  lines.push(`  --color-warning-3: ${ds.colors.warning['3']};`);
  lines.push(`  --color-danger-1: ${ds.colors.danger['1']};`);
  lines.push(`  --color-danger-2: ${ds.colors.danger['2']};`);
  lines.push(`  --color-danger-3: ${ds.colors.danger['3']};`);
  lines.push(`  --color-info-1: ${ds.colors.info['1']};`);
  lines.push(`  --color-info-2: ${ds.colors.info['2']};`);
  lines.push(`  --color-info-3: ${ds.colors.info['3']};`);

  lines.push('');
  lines.push('  /* Gray Scale */');
  lines.push(`  --color-gray-1: ${ds.colors.gray['1']};`);
  lines.push(`  --color-gray-2: ${ds.colors.gray['2']};`);
  lines.push(`  --color-gray-3: ${ds.colors.gray['3']};`);
  lines.push(`  --color-gray-soft: ${ds.colors.gray.soft};`);

  lines.push('');
  lines.push('  /* Background Colors */');
  lines.push(`  --bg-default: ${ds.colors.bg.default};`);
  lines.push(`  --bg-alt: ${ds.colors.bg.alt};`);
  lines.push(`  --bg-elevated: ${ds.colors.bg.elevated};`);
  lines.push(`  --bg-soft: ${ds.colors.bg.soft};`);

  lines.push('');
  lines.push('  /* Text Colors */');
  lines.push(`  --text-1: ${ds.colors.text['1']};`);
  lines.push(`  --text-2: ${ds.colors.text['2']};`);
  lines.push(`  --text-3: ${ds.colors.text['3']};`);

  lines.push('');
  lines.push('  /* Border Colors */');
  lines.push(`  --border-default: ${ds.colors.border.default};`);
  lines.push(`  --border-divider: ${ds.colors.border.divider};`);
  lines.push(`  --border-gutter: ${ds.colors.border.gutter};`);

  lines.push('');
  lines.push('  /* Typography */');
  lines.push(`  --font-sans: ${ds.typography.fontFamily.sans};`);
  lines.push(`  --font-mono: ${ds.typography.fontFamily.mono};`);

  lines.push('');
  lines.push('  /* Font Sizes */');
  lines.push(`  --font-size-xs: ${ds.typography.fontSize.xs};`);
  lines.push(`  --font-size-sm: ${ds.typography.fontSize.sm};`);
  lines.push(`  --font-size-base: ${ds.typography.fontSize.base};`);
  lines.push(`  --font-size-lg: ${ds.typography.fontSize.lg};`);
  lines.push(`  --font-size-xl: ${ds.typography.fontSize.xl};`);
  lines.push(`  --font-size-2xl: ${ds.typography.fontSize['2xl']};`);
  lines.push(`  --font-size-3xl: ${ds.typography.fontSize['3xl']};`);
  lines.push(`  --font-size-4xl: ${ds.typography.fontSize['4xl']};`);

  lines.push('');
  lines.push('  /* Font Weights */');
  lines.push(`  --font-weight-normal: ${ds.typography.fontWeight.normal};`);
  lines.push(`  --font-weight-medium: ${ds.typography.fontWeight.medium};`);
  lines.push(`  --font-weight-semibold: ${ds.typography.fontWeight.semibold};`);
  lines.push(`  --font-weight-bold: ${ds.typography.fontWeight.bold};`);

  lines.push('');
  lines.push('  /* Line Heights */');
  lines.push(`  --leading-tight: ${ds.typography.lineHeight.tight};`);
  lines.push(`  --leading-normal: ${ds.typography.lineHeight.normal};`);
  lines.push(`  --leading-relaxed: ${ds.typography.lineHeight.relaxed};`);

  lines.push('');
  lines.push('  /* Spacing */');
  lines.push(`  --space-xs: ${ds.spacing.scale.xs};`);
  lines.push(`  --space-sm: ${ds.spacing.scale.sm};`);
  lines.push(`  --space-md: ${ds.spacing.scale.md};`);
  lines.push(`  --space-lg: ${ds.spacing.scale.lg};`);
  lines.push(`  --space-xl: ${ds.spacing.scale.xl};`);
  lines.push(`  --space-2xl: ${ds.spacing.scale['2xl']};`);
  lines.push(`  --space-3xl: ${ds.spacing.scale['3xl']};`);
  lines.push(`  --space-4xl: ${ds.spacing.scale['4xl']};`);

  lines.push('');
  lines.push('  /* Shadows */');
  lines.push(`  --shadow-1: ${ds.effects.shadows['1']};`);
  lines.push(`  --shadow-2: ${ds.effects.shadows['2']};`);
  lines.push(`  --shadow-3: ${ds.effects.shadows['3']};`);
  lines.push(`  --shadow-4: ${ds.effects.shadows['4']};`);
  lines.push(`  --shadow-5: ${ds.effects.shadows['5']};`);

  lines.push('');
  lines.push('  /* Border Radius */');
  lines.push(`  --radius-sm: ${ds.effects.borderRadius.sm};`);
  lines.push(`  --radius-md: ${ds.effects.borderRadius.md};`);
  lines.push(`  --radius-lg: ${ds.effects.borderRadius.lg};`);

  lines.push('');
  lines.push('  /* Transitions */');
  if (ds.effects.transitions?.base) lines.push(`  --transition-base: ${ds.effects.transitions.base};`);
  if (ds.effects.transitions?.fast) lines.push(`  --transition-fast: ${ds.effects.transitions.fast};`);
  if (ds.effects.transitions?.slow) lines.push(`  --transition-slow: ${ds.effects.transitions.slow};`);

  lines.push('');
  lines.push('  /* Layout */');
  lines.push(`  --layout-max-width: ${ds.layout.maxWidth};`);
  lines.push(`  --navbar-height: ${ds.layout.navbarHeight};`);
  lines.push(`  --sidebar-width: ${ds.layout.sidebarWidth};`);
  if (ds.layout.tocWidth) lines.push(`  --toc-width: ${ds.layout.tocWidth};`);

  lines.push('');
  lines.push('  /* Z-Index */');
  lines.push(`  --z-footer: ${ds.layout.zIndex.footer};`);
  lines.push(`  --z-local-nav: ${ds.layout.zIndex.localNav};`);
  lines.push(`  --z-nav: ${ds.layout.zIndex.nav};`);
  lines.push(`  --z-layout-top: ${ds.layout.zIndex.layoutTop};`);
  lines.push(`  --z-backdrop: ${ds.layout.zIndex.backdrop};`);
  lines.push(`  --z-sidebar: ${ds.layout.zIndex.sidebar};`);

  // Component-specific variables
  if (ds.components) {
    if (ds.components.navbar) {
      lines.push('');
      lines.push('  /* Navbar Component */');
      if (ds.components.navbar.height) lines.push(`  --navbar-height: ${ds.components.navbar.height};`);
      if (ds.components.navbar.padding) lines.push(`  --navbar-padding: ${ds.components.navbar.padding};`);
      if (ds.components.navbar.background) lines.push(`  --navbar-background: ${ds.components.navbar.background};`);
      if (ds.components.navbar.border) lines.push(`  --navbar-border: ${ds.components.navbar.border};`);
      if (ds.components.navbar.borderWidth) lines.push(`  --navbar-border-width: ${ds.components.navbar.borderWidth};`);
      if (ds.components.navbar.shadow) lines.push(`  --navbar-shadow: ${ds.components.navbar.shadow};`);
      if (ds.components.navbar.logoHeight) lines.push(`  --navbar-logo-height: ${ds.components.navbar.logoHeight};`);
      if (ds.components.navbar.itemPadding) lines.push(`  --navbar-item-padding: ${ds.components.navbar.itemPadding};`);
      if (ds.components.navbar.itemGap) lines.push(`  --navbar-item-gap: ${ds.components.navbar.itemGap};`);
    }

    if (ds.components.sidebar) {
      lines.push('');
      lines.push('  /* Sidebar Component */');
      if (ds.components.sidebar.width) lines.push(`  --sidebar-width: ${ds.components.sidebar.width};`);
      if (ds.components.sidebar.padding) lines.push(`  --sidebar-padding: ${ds.components.sidebar.padding};`);
      if (ds.components.sidebar.background) lines.push(`  --sidebar-background: ${ds.components.sidebar.background};`);
      if (ds.components.sidebar.border) lines.push(`  --sidebar-border: ${ds.components.sidebar.border};`);
      if (ds.components.sidebar.itemHeight) lines.push(`  --sidebar-item-height: ${ds.components.sidebar.itemHeight};`);
      if (ds.components.sidebar.itemPadding) lines.push(`  --sidebar-item-padding: ${ds.components.sidebar.itemPadding};`);
      if (ds.components.sidebar.itemGap) lines.push(`  --sidebar-item-gap: ${ds.components.sidebar.itemGap};`);
      if (ds.components.sidebar.itemBorderRadius) lines.push(`  --sidebar-item-border-radius: ${ds.components.sidebar.itemBorderRadius};`);
      if (ds.components.sidebar.itemFontSize) lines.push(`  --sidebar-item-font-size: ${ds.components.sidebar.itemFontSize};`);
      if (ds.components.sidebar.itemFontWeight) lines.push(`  --sidebar-item-font-weight: ${ds.components.sidebar.itemFontWeight};`);
      if (ds.components.sidebar.activeBackground) lines.push(`  --sidebar-active-background: ${ds.components.sidebar.activeBackground};`);
      if (ds.components.sidebar.activeBorder) lines.push(`  --sidebar-active-border: ${ds.components.sidebar.activeBorder};`);
      if (ds.components.sidebar.hoverBackground) lines.push(`  --sidebar-hover-background: ${ds.components.sidebar.hoverBackground};`);
      if (ds.components.sidebar.categoryPadding) lines.push(`  --sidebar-category-padding: ${ds.components.sidebar.categoryPadding};`);
      if (ds.components.sidebar.categoryFontSize) lines.push(`  --sidebar-category-font-size: ${ds.components.sidebar.categoryFontSize};`);
      if (ds.components.sidebar.categoryFontWeight) lines.push(`  --sidebar-category-font-weight: ${ds.components.sidebar.categoryFontWeight};`);
      if (ds.components.sidebar.categoryTextTransform) lines.push(`  --sidebar-category-text-transform: ${ds.components.sidebar.categoryTextTransform};`);
    }

    if (ds.components.content) {
      lines.push('');
      lines.push('  /* Content Component */');
      if (ds.components.content.maxWidth) lines.push(`  --content-max-width: ${ds.components.content.maxWidth};`);
      if (ds.components.content.padding) lines.push(`  --content-padding: ${ds.components.content.padding};`);
      if (ds.components.content.fontSize) lines.push(`  --content-font-size: ${ds.components.content.fontSize};`);
      if (ds.components.content.lineHeight) lines.push(`  --content-line-height: ${ds.components.content.lineHeight};`);
    }

    if (ds.components.code) {
      lines.push('');
      lines.push('  /* Code Component */');
      if (ds.components.code.fontSize) lines.push(`  --code-font-size: ${ds.components.code.fontSize};`);
      if (ds.components.code.lineHeight) lines.push(`  --code-line-height: ${ds.components.code.lineHeight};`);
      if (ds.components.code.background) lines.push(`  --code-background: ${ds.components.code.background};`);
      if (ds.components.code.color) lines.push(`  --code-color: ${ds.components.code.color};`);
      if (ds.components.code.borderRadius) lines.push(`  --code-border-radius: ${ds.components.code.borderRadius};`);
      if (ds.components.code.padding) lines.push(`  --code-padding: ${ds.components.code.padding};`);
      if (ds.components.code.blockPadding) lines.push(`  --code-block-padding: ${ds.components.code.blockPadding};`);
      if (ds.components.code.blockBorderRadius) lines.push(`  --code-block-border-radius: ${ds.components.code.blockBorderRadius};`);
    }

    if (ds.components.heading) {
      lines.push('');
      lines.push('  /* Heading Component */');
      if (ds.components.heading.h1FontSize) lines.push(`  --heading-h1-font-size: ${ds.components.heading.h1FontSize};`);
      if (ds.components.heading.h2FontSize) lines.push(`  --heading-h2-font-size: ${ds.components.heading.h2FontSize};`);
      if (ds.components.heading.h3FontSize) lines.push(`  --heading-h3-font-size: ${ds.components.heading.h3FontSize};`);
      if (ds.components.heading.h4FontSize) lines.push(`  --heading-h4-font-size: ${ds.components.heading.h4FontSize};`);
      if (ds.components.heading.h1FontWeight) lines.push(`  --heading-h1-font-weight: ${ds.components.heading.h1FontWeight};`);
      if (ds.components.heading.h2FontWeight) lines.push(`  --heading-h2-font-weight: ${ds.components.heading.h2FontWeight};`);
      if (ds.components.heading.h3FontWeight) lines.push(`  --heading-h3-font-weight: ${ds.components.heading.h3FontWeight};`);
      if (ds.components.heading.h1LineHeight) lines.push(`  --heading-h1-line-height: ${ds.components.heading.h1LineHeight};`);
      if (ds.components.heading.h2LineHeight) lines.push(`  --heading-h2-line-height: ${ds.components.heading.h2LineHeight};`);
      if (ds.components.heading.h3LineHeight) lines.push(`  --heading-h3-line-height: ${ds.components.heading.h3LineHeight};`);
      if (ds.components.heading.marginTop) lines.push(`  --heading-margin-top: ${ds.components.heading.marginTop};`);
      if (ds.components.heading.marginBottom) lines.push(`  --heading-margin-bottom: ${ds.components.heading.marginBottom};`);
    }
  }

  lines.push('}');

  // Add dark mode overrides if provided
  if (darkMode && darkMode.colors) {
    lines.push('');
    lines.push('/* Dark Mode */');
    lines.push('@media (prefers-color-scheme: dark) {');
    lines.push('  :root {');

    if (darkMode.colors.primary) {
      lines.push('    /* Brand/Primary Colors */');
      lines.push(`    --color-primary-1: ${darkMode.colors.primary['1']};`);
      lines.push(`    --color-primary-2: ${darkMode.colors.primary['2']};`);
      lines.push(`    --color-primary-3: ${darkMode.colors.primary['3']};`);
      lines.push(`    --color-primary-soft: ${darkMode.colors.primary.soft};`);
    }

    if (darkMode.colors.success) {
      lines.push('');
      lines.push('    /* Semantic Colors */');
      lines.push(`    --color-success-1: ${darkMode.colors.success['1']};`);
      lines.push(`    --color-success-2: ${darkMode.colors.success['2']};`);
      lines.push(`    --color-success-3: ${darkMode.colors.success['3']};`);
    }
    if (darkMode.colors.warning) {
      lines.push(`    --color-warning-1: ${darkMode.colors.warning['1']};`);
      lines.push(`    --color-warning-2: ${darkMode.colors.warning['2']};`);
      lines.push(`    --color-warning-3: ${darkMode.colors.warning['3']};`);
    }
    if (darkMode.colors.danger) {
      lines.push(`    --color-danger-1: ${darkMode.colors.danger['1']};`);
      lines.push(`    --color-danger-2: ${darkMode.colors.danger['2']};`);
      lines.push(`    --color-danger-3: ${darkMode.colors.danger['3']};`);
    }
    if (darkMode.colors.info) {
      lines.push(`    --color-info-1: ${darkMode.colors.info['1']};`);
      lines.push(`    --color-info-2: ${darkMode.colors.info['2']};`);
      lines.push(`    --color-info-3: ${darkMode.colors.info['3']};`);
    }

    if (darkMode.colors.gray) {
      lines.push('');
      lines.push('    /* Gray Scale */');
      lines.push(`    --color-gray-1: ${darkMode.colors.gray['1']};`);
      lines.push(`    --color-gray-2: ${darkMode.colors.gray['2']};`);
      lines.push(`    --color-gray-3: ${darkMode.colors.gray['3']};`);
      lines.push(`    --color-gray-soft: ${darkMode.colors.gray.soft};`);
    }

    if (darkMode.colors.bg) {
      lines.push('');
      lines.push('    /* Background Colors */');
      lines.push(`    --bg-default: ${darkMode.colors.bg.default};`);
      lines.push(`    --bg-alt: ${darkMode.colors.bg.alt};`);
      lines.push(`    --bg-elevated: ${darkMode.colors.bg.elevated};`);
      lines.push(`    --bg-soft: ${darkMode.colors.bg.soft};`);
    }

    if (darkMode.colors.text) {
      lines.push('');
      lines.push('    /* Text Colors */');
      lines.push(`    --text-1: ${darkMode.colors.text['1']};`);
      lines.push(`    --text-2: ${darkMode.colors.text['2']};`);
      lines.push(`    --text-3: ${darkMode.colors.text['3']};`);
    }

    if (darkMode.colors.border) {
      lines.push('');
      lines.push('    /* Border Colors */');
      lines.push(`    --border-default: ${darkMode.colors.border.default};`);
      lines.push(`    --border-divider: ${darkMode.colors.border.divider};`);
      lines.push(`    --border-gutter: ${darkMode.colors.border.gutter};`);
    }

    lines.push('  }');
    lines.push('}');
  }

  return lines.join('\n');
}

/**
 * Generate CSS variables for design system
 */
function generateDesignSystemVariables(designSystemName: string): string {
  try {
    // Get the design system (default to vitepress if invalid)
    const validNames = ['vitepress', 'docusaurus', 'rspress'] as const;
    const name = validNames.includes(designSystemName as any) ? designSystemName as typeof validNames[number] : 'vitepress';

    const designSystem = getDesignSystem(name);
    const darkModeOverride = getDarkModeOverride(name);

    return designSystemToCSS(designSystem, darkModeOverride);
  } catch (error) {
    console.error(`Failed to load design system "${designSystemName}":`, error);
    // Fallback to vitepress if there's an error
    const designSystem = getDesignSystem('vitepress');
    const darkModeOverride = getDarkModeOverride('vitepress');
    return designSystemToCSS(designSystem, darkModeOverride);
  }
}

/**
 * Escape HTML
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape JavaScript strings
 */
function escapeJsString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/**
 * Run @marko/run build
 */
async function runMarkoRunBuild(
  outDir: string | undefined,
  debug: boolean,
  root: string
): Promise<{ success: boolean; outDir: string; errors: string[] }> {
  return new Promise((resolve) => {
    const args = ['build'];

    if (outDir) {
      args.push('--output', outDir);
    }

    if (debug) {
      args.push('--debug');
    }

    const buildProcess = spawn('npx', ['marko-run', ...args], {
      stdio: 'inherit',
      cwd: root,
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        // Determine output directory
        const outputDir = outDir || 'dist';

        resolve({
          success: true,
          outDir: path.join(root, outputDir),
          errors: [],
        });
      } else {
        resolve({
          success: false,
          outDir: '',
          errors: [`Build process exited with code ${code}`],
        });
      }
    });

    buildProcess.on('error', (error) => {
      resolve({
        success: false,
        outDir: '',
        errors: [`Failed to start build process: ${error.message}`],
      });
    });
  });
}

/**
 * Generate catch-all routes using dynamic routes
 * Supports generic modules (not just hardcoded docs/blog/pages)
 */
export async function generateCatchAllRoutes(
  manifest: ContentManifest,
  routesDir: string,
  config: ResolvedConfig,
  modules: ContentModule[],
  debug: boolean,
  isBuild: boolean = true
): Promise<void> {
  console.log('   Using catch-all dynamic routes...');
  console.log(`   Mode: ${isBuild ? 'build (pre-compiled)' : 'dev (request-time rendering)'}`);

  // Get directories from config.content keys (feature-based format)
  const contentDirs = Object.keys(config.content || {});

  // Also add any directories found during content scan (for unlisted dirs)
  const scannedDirs = new Set(modules.map(m => m.id));
  const allDirs = [...new Set([...contentDirs, ...scannedDirs])];

  // Check if there are root-level files (pages without prefix)
  const hasRootFiles = modules.some(m => m.id === 'root');
  
  if (hasRootFiles) {
    // Generate catch-all route for root-level pages
    const pagesDir = path.join(routesDir, '$$slug');
    await fs.mkdir(pagesDir, { recursive: true });

    const pagesHandler = await loadTemplate('catch-all-handler.js.template', {
      CONTENT_TYPE: 'root',
      CONFIG_PATH: '../_config.js',
      VITE_PLUGIN_PATH: 'markopress/build',
      IS_BUILD: isBuild ? 'true' : 'false',
    });
    await fs.writeFile(path.join(pagesDir, '+handler.js'), pagesHandler);

    const pagesPage = await loadTemplate('catch-all-page.marko.template', {
      CONTENT_TYPE_CLASS: 'page',
    });
    await fs.writeFile(path.join(pagesDir, '+page.marko'), pagesPage);

    if (debug) console.log(`   Generated root pages catch-all route`);
  }

  // Generate catch-all routes for each content subdirectory
  for (const moduleId of allDirs) {
    if (moduleId === 'root') continue; // Already handled above

    const moduleDir = path.join(routesDir, moduleId, '$$slug');
    await fs.mkdir(moduleDir, { recursive: true });

    const handlerTemplate = await loadTemplate('catch-all-handler.js.template', {
      CONTENT_TYPE: moduleId,
      CONFIG_PATH: '../../_config.js',
      VITE_PLUGIN_PATH: 'markopress/build',
      IS_BUILD: isBuild ? 'true' : 'false',
    });
    await fs.writeFile(path.join(moduleDir, '+handler.js'), handlerTemplate);

    const pageTemplate = await loadTemplate('catch-all-page.marko.template', {
      CONTENT_TYPE_CLASS: moduleId,
    });
    await fs.writeFile(path.join(moduleDir, '+page.marko'), pageTemplate);

    if (debug) console.log(`   Generated ${moduleId} catch-all route`);
  }

  // Generate config file for handlers
  await generateConfigFile(routesDir, config, debug);

  // Generate vite.config.js for markdown content virtual module support
  // routesDir is <appRoot>/src/routes, so appRoot is two levels up
  const appRootForVite = path.resolve(routesDir, '..', '..');
  await generateViteConfig(appRootForVite, debug);

  // Generate root layout that wraps all pages
  await generateRootLayout(routesDir, config, debug);
}

// Re-export markdown plugin utilities for use in generated handlers
export { loadMarkdownModule, registerMarkdownContent };
export { markdownContentPlugin } from './vite-markdown-plugin.js';

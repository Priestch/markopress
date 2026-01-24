/**
 * MarkoPress Build System
 * Generates static HTML from markdown content
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { scanContent, scanContentModules } from '../content/scanner.js';
import { loadConfig } from '../config/loader.js';
import type { ContentManifest, ContentFile } from '../content/types.js';
import type { ContentModule } from '../content/module.js';
import type { ResolvedConfig } from '../config/types.js';
import { getDesignSystem, getDarkModeOverride, type DesignSystem } from '@markopress/theme-default/design-systems';
import { generateContentManifest } from './manifest-generator.js';
import { globalTagValidator, formatValidationError } from '../markdown/tag-validator.js';
import { PluginManager } from '../plugin/manager.js';

export interface BuildOptions {
  useCatchAllRoutes?: boolean;
  outDir?: string;
  debug?: boolean;
}

export interface BuildResult {
  success: boolean;
  outDir: string;
  pages: number;
  errors: string[];
}

/**
 * Build the MarkoPress site for production
 */
export async function build(options: BuildOptions = {}): Promise<BuildResult> {
  const { outDir, debug = false, useCatchAllRoutes } = options;
  const errors: string[] = [];

  try {
    console.log('🚀 Building MarkoPress site...\n');

    // Step 0: Load configuration
    const config = await loadConfig(process.cwd(), { mode: 'production', command: 'build' });

    // Step 1: Initialize plugin manager
    let pluginManager: PluginManager | undefined;
    if (config.plugins && config.plugins.length > 0) {
      console.log('🔌 Loading plugins...');
      pluginManager = new PluginManager(config);
      await pluginManager.loadPlugins(config.plugins);
      console.log('');
    }

    // Step 2: Execute loadContent hooks (for backward compatibility)
    if (pluginManager) {
      console.log('📦 Loading plugin content...');
      await pluginManager.execLoadContentHooks();
      console.log('   Plugin content loaded\n');
    }

    // Step 3: Scan content modules (NEW APPROACH)
    console.log('📂 Scanning content modules...');
    const modules = await scanContentModules({
      rootDir: process.cwd(),
      dirs: config.content,
      markdownOptions: config.markdown,
    });

    // Log module information
    for (const module of modules) {
      console.log(`   Found ${module.id} module: ${module.files.length} files`);
    }
    console.log('');

    // Step 4: Execute enhanceModules hooks (NEW)
    if (pluginManager) {
      console.log('🔌 Processing plugin enhanceModules hooks...');
      await pluginManager.execEnhanceModulesHooks(modules);
      console.log('   Modules enhanced\n');
    }

    // Step 5: Generate manifest from modules for backward compatibility
    const manifest = modulesToManifest(modules);

    // Step 6: Execute contentLoaded hooks (for backward compatibility)
    if (pluginManager) {
      console.log('🔌 Processing plugin contentLoaded hooks...');
      await pluginManager.execContentLoadedHooks(manifest);
      console.log('   Plugin content processed\n');
    }

    // Step 5: Initialize tag validator if Marko tags enabled
    if (config.markdown.markoTags?.enabled) {
      const tagsDir = path.join(process.cwd(), config.markdown.markoTags.tagsDir || 'src/.markopress/tags');
      console.log('🔍 Scanning tags directory...');
      await globalTagValidator.loadAvailableTags(tagsDir);
      console.log(`   Found ${globalTagValidator.getAvailableTagsCount()} tags\n`);
    } else {
      globalTagValidator.reset();
    }

    // Step 6: Ensure routes directory exists
    // Note: Routes must be in src/routes/ for @marko/run compatibility
    const routesDir = path.join(process.cwd(), 'src', 'routes');
    await fs.mkdir(routesDir, { recursive: true });

    // Step 7: Generate initial route manifest
    let routeManifest = buildInitialRouteManifest(manifest);

    // Step 8: Execute extendRoutes hooks
    if (pluginManager) {
      routeManifest = await pluginManager.execExtendRoutesHooks(routeManifest);
      console.log('🔌 Extended routes manifest:', Object.keys(routeManifest).length);
    }

    // Step 9: Generate routes for content
    console.log('📝 Generating routes from content...');
    const routeMode = useCatchAllRoutes ?? config.build.useCatchAllRoutes;
    if (routeMode) {
      await generateCatchAllRoutes(manifest, routesDir, config, modules, debug);
      console.log('   Using catch-all dynamic routes');
    } else {
      await generateRoutes(manifest, routesDir, config, modules, debug);
      console.log('   Using static routes');
    }
    console.log('   Routes generated\n');

    // Step 10: Convert routeManifest entries with handler/component to plugin routes
    // This allows plugins to add custom routes via extendRoutes hook
    const manifestRoutes: any[] = [];
    for (const [path, route] of Object.entries(routeManifest)) {
      if ((route as any).handler || (route as any).component) {
        manifestRoutes.push({ path, ...(route as any) });
        console.log(`   Found plugin route: ${path}`);
      }
    }

    console.log(`🔌 Total manifest routes: ${Object.keys(routeManifest).length}, Plugin routes: ${manifestRoutes.length}`);

    // Step 11: Generate plugin routes
    if (pluginManager) {
      const pluginRoutes = pluginManager.getPluginRoutes();
      const allPluginRoutes = [...pluginRoutes, ...manifestRoutes];
      if (allPluginRoutes.length > 0) {
        console.log(`🔌 Generating ${allPluginRoutes.length} plugin routes...`);
        await generatePluginRoutes(allPluginRoutes, routesDir, config, debug);
        console.log('   Plugin routes generated\n');
      }
    }

    // Step 11: Execute allContentLoaded hooks (NEW)
    if (pluginManager) {
      console.log('🔌 Processing plugin allContentLoaded hooks...');
      await pluginManager.execAllContentLoadedHooks(routeManifest);
      console.log('   All content processed\n');
    }

    // Step 12: Validate Marko tags if enabled
    if (config.markdown.markoTags?.enabled) {
      console.log('🔍 Validating Marko tags...');
      const validation = globalTagValidator.validate();

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

    // Step 13: Copy theme components to src/components
    console.log('📦 Copying theme components...');
    await copyThemeComponents(process.cwd(), config, debug);
    console.log('   Theme components copied\n');

    // Step 14: Copy theme CSS to public directory
    console.log('🎨 Copying theme CSS...');
    await copyThemeCSS(process.cwd(), config, debug);
    console.log('   Theme CSS copied\n');

    // Step 15: Build with @marko/run
    console.log('🔨 Building with @marko/run...');
    const resolvedOutDir = outDir || config.build.outDir;
    const buildResult = await runMarkoRunBuild(resolvedOutDir, debug);

    if (!buildResult.success) {
      errors.push(...buildResult.errors);
      return {
        success: false,
        outDir: '',
        pages: 0,
        errors,
      };
    }

    // Step 16: Collect build assets (NEW)
    const assets = await collectBuildAssets(buildResult.outDir);

    // Step 17: Execute postBuild hooks (NEW)
    if (pluginManager) {
      console.log('🔌 Processing plugin postBuild hooks...');
      await pluginManager.execPostBuildHooks(
        buildResult.outDir,
        routeManifest,
        assets
      );
      console.log('   Post-build hooks completed\n');
    }

    // Step 18: Copy Marko tags directory to output (after build so it doesn't get cleaned)
    console.log('📦 Copying Marko tags directory...');
    await copyTagsDirectory(process.cwd(), buildResult.outDir, config, debug);
    console.log('   Tags directory copied\n');

    console.log('\n✅ Build completed successfully!');
    console.log(`   Output: ${buildResult.outDir}`);

    // Calculate total pages from all modules
    let totalPages = 0;
    for (const [key, files] of Object.entries(manifest)) {
      if (Array.isArray(files)) {
        totalPages += files.length;
      }
    }
    console.log(`   Pages: ${totalPages}`);

    return {
      success: true,
      outDir: buildResult.outDir,
      pages: totalPages,
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
 * Convert content modules to dynamic manifest
 * Each module becomes a top-level key in the manifest
 */
export function modulesToManifest(modules: ContentModule[]): ContentManifest {
  const manifest: ContentManifest = {} as ContentManifest;

  for (const module of modules) {
    // Add module files directly to manifest under module ID
    manifest[module.id] = module.files;
  }

  return manifest;
}

/**
 * Build initial route manifest from content
 * Works with dynamic manifest structure
 */
function buildInitialRouteManifest(manifest: ContentManifest) {
  const routes: Record<string, any> = {};

  // Process all modules dynamically
  for (const [moduleId, files] of Object.entries(manifest)) {
    // Skip non-array entries (like 'all' collection)
    if (!Array.isArray(files)) continue;

    for (const file of files as ContentFile[]) {
      routes[file.urlPath] = {
        path: file.urlPath,
        meta: {
          title: file.processed.frontmatter.title,
          type: file.type || 'custom',
          moduleId: file.moduleId,
        },
      };
    }
  }

  return routes;
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
 */
async function generatePageRoute(
  page: ContentFile,
  routesDir: string,
  config: ResolvedConfig,
  modules: ContentModule[],
  debug: boolean
): Promise<void> {
  // For root path, use +page.marko. For others, use directory/+page.marko
  const routeDirPath = page.urlPath === '/' ? '' : page.urlPath.slice(1);
  const routeDir = path.join(routesDir, routeDirPath, '+page');

  // Create directory if needed
  await fs.mkdir(path.dirname(routeDir), { recursive: true });

  const title = String(page.processed.frontmatter.title || 'Page');
  const description = String(page.processed.frontmatter.description || '');
  const content = page.processed.html || '';

  // Generate the handler file (+handler.js)
  const handlerFile = path.join(path.dirname(routeDir), '+handler.js');
  const navbar = config.theme?.options?.navbar || [];
  const head = config.site?.head || [];
  const handlerCode = `export async function GET(context, next) {
  context.title = ${JSON.stringify(title)};
  context.description = ${JSON.stringify(description)};
  context.navbar = ${JSON.stringify(navbar)};
  context.content = ${JSON.stringify(content)};
  context.head = ${JSON.stringify(head)};
}
`;

  await fs.writeFile(handlerFile, handlerCode);

  // Generate the Marko template using template file
  const templateFile = routeDir + '.marko';
  const template = await loadTemplate('page.marko.template', {});

  await fs.writeFile(templateFile, template);

  if (debug) {
    console.log(`   Generated: ${templateFile}`);
  }
}

/**
 * Generate a single documentation route
 * Works with any module (docs, guides, tutorials, etc.)
 */
async function generateDocRoute(
  doc: ContentFile,
  routesDir: string,
  config: ResolvedConfig,
  modules: ContentModule[],
  debug: boolean
): Promise<void> {
  // Preserve full path structure
  // e.g., "/guides/getting-started" -> "guides/getting-started"
  const routePath = doc.urlPath.slice(1); // Remove leading slash
  const routeDir = path.join(routesDir, routePath, '+page');

  await fs.mkdir(path.dirname(routeDir), { recursive: true });

  const title = String(doc.processed.frontmatter.title || 'Doc');
  const description = String(doc.processed.frontmatter.description || '');
  const content = doc.processed.html || '';

  // Determine module ID from urlPath
  // e.g., "/guides/getting-started" -> "guides"
  const pathParts = doc.urlPath.split('/').filter(Boolean);
  const moduleId = pathParts[0] || 'docs';

  // Get sidebar from module enhancement or config
  let currentSidebar: Array<{ text: string; link: string; items?: Array<{ text: string; link: string }> }> = [];

  // Try to get sidebar from the module that contains this file
  const targetModule = modules.find(m => m.id === moduleId);
  const moduleSidebar = targetModule?.getEnhancement<Array<{ text: string; link: string; items?: any }>>('sidebar');

  if (moduleSidebar) {
    currentSidebar = moduleSidebar;
  } else {
    // Fallback to config-based sidebar
    const sidebarConfig = config.theme?.options?.sidebar || {};
    for (const [prefix, items] of Object.entries(sidebarConfig)) {
      if (doc.urlPath.startsWith(prefix)) {
        const sidebarItems = items as any;
        if (Array.isArray(sidebarItems)) {
          currentSidebar = sidebarItems;
        }
        break;
      }
    }
  }

  // Get TOC from module enhancement
  const toc = targetModule?.getEnhancement<Map<string, any>>('toc')?.get(doc.urlPath);

  // Generate handler file (+handler.js) with sidebar and TOC data
  const handlerFile = path.join(path.dirname(routeDir), '+handler.js');
  const navbar = config.theme?.options?.navbar || [];
  const head = config.site?.head || [];
  const handlerCode = `export async function GET(context, next) {
  context.title = ${JSON.stringify(title)};
  context.description = ${JSON.stringify(description)};
  context.navbar = ${JSON.stringify(navbar)};
  context.sidebar = ${JSON.stringify(currentSidebar)};
  context.toc = ${JSON.stringify(toc || [])};
  context.content = ${JSON.stringify(content)};
  context.head = ${JSON.stringify(head)};
}
`;

  await fs.writeFile(handlerFile, handlerCode);

  // Generate the Marko template using template file
  const templateFile = routeDir + '.marko';
  const template = await loadTemplate('doc.marko.template', {});

  await fs.writeFile(templateFile, template);

  if (debug) {
    console.log(`   Generated: ${templateFile}`);
  }
}

/**
 * Generate a single blog route
 */
async function generateBlogRoute(
  post: ContentFile,
  routesDir: string,
  config: ResolvedConfig,
  modules: ContentModule[],
  debug: boolean
): Promise<void> {
  // Preserve full path structure after /blog/
  // e.g., "/blog/2024/01/test-post" -> "blog/2024/01/test-post"
  const routePath = post.urlPath.slice(1); // Remove leading slash
  const routeDir = path.join(routesDir, routePath, '+page');

  await fs.mkdir(path.dirname(routeDir), { recursive: true });

  const title = String(post.processed.frontmatter.title || 'Blog Post');
  const description = String(post.processed.frontmatter.description || '');
  const date = String(post.processed.frontmatter.date || '');
  const author = String(post.processed.frontmatter.author || '');
  const content = post.processed.html || '';

  // Generate handler file (+handler.js)
  const handlerFile = path.join(path.dirname(routeDir), '+handler.js');
  const navbar = config.theme?.options?.navbar || [];
  const head = config.site?.head || [];
  const handlerCode = `export async function GET(context, next) {
  context.title = ${JSON.stringify(title)};
  context.description = ${JSON.stringify(description)};
  context.navbar = ${JSON.stringify(navbar)};
  context.date = ${JSON.stringify(date)};
  context.author = ${JSON.stringify(author)};
  context.content = ${JSON.stringify(content)};
  context.head = ${JSON.stringify(head)};
}
`;

  await fs.writeFile(handlerFile, handlerCode);

  // Generate the Marko template using template file
  const templateFile = routeDir + '.marko';
  const template = await loadTemplate('blog-post.marko.template', {});

  await fs.writeFile(templateFile, template);

  if (debug) {
    console.log(`   Generated: ${templateFile}`);
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

  // Generate layout using template file
  const template = await loadTemplate('layout.marko.template', {
    SITE_TITLE: siteTitle,
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
    // pnpm workspace: root node_modules
    path.join(rootDir, '..', 'node_modules', themeName, 'public', cssFileName),
    // Local node_modules
    path.join(rootDir, 'node_modules', themeName, 'public', cssFileName),
    // Direct packages path (for monorepo)
    path.join(rootDir, '..', 'packages', 'theme-default', 'public', cssFileName),
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
}

/**
 * Convert PascalCase to kebab-case
 * ThemeNavbarEnd -> theme-navbar-end
 */
function pascalToKebab(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Copy theme components to src/routes/components for <components/xxx> tag resolution
 * This copies theme tags so they can be used with <components/xxx-name/> syntax
 * Files are renamed from PascalCase to kebab-case to match tag usage
 */
export async function copyThemeComponents(
  rootDir: string,
  config: ResolvedConfig,
  debug: boolean
): Promise<void> {
  const themeName = config.theme?.name || '@markopress/theme-default';

  // Security: Validate theme name to prevent path traversal
  try {
    validateThemeName(themeName);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Security: ${errorMessage}`);
  }

  // Theme components should be in dist/tags of the theme package
  const possiblePaths = [
    // pnpm workspace: root node_modules
    path.join(rootDir, '..', 'node_modules', themeName, 'dist', 'tags'),
    // Local node_modules
    path.join(rootDir, 'node_modules', themeName, 'dist', 'tags'),
    // Direct packages path (for monorepo)
    path.join(rootDir, '..', 'packages', 'theme-default', 'dist', 'tags'),
  ];

  let themeTagsDir: string | null = null;

  for (const tagsPath of possiblePaths) {
    try {
      await fs.access(tagsPath);
      themeTagsDir = tagsPath;
      break;
    } catch {
      // Try next path
    }
  }

  if (!themeTagsDir) {
    // Theme components directory doesn't exist, skip copying
    if (debug) {
      console.log(`   No theme components directory found`);
    }
    return;
  }

  // Create destination directory in src/routes/tags
  // Marko discovers tags from a tags/ directory
  const destDir = path.join(rootDir, 'src', 'routes', 'tags');
  await fs.mkdir(destDir, { recursive: true });

  // Get all .marko files from theme tags directory
  const files = await fs.readdir(themeTagsDir);
  const markoFiles = files.filter(f => f.endsWith('.marko'));

  // Copy each .marko file to src/routes/components
  // Convert PascalCase filenames to kebab-case for tag resolution
  for (const file of markoFiles) {
    const srcPath = path.join(themeTagsDir, file);
    const nameWithoutExt = file.slice(0, -('.marko'.length));
    const kebabName = pascalToKebab(nameWithoutExt);
    const destPath = path.join(destDir, kebabName + '.marko');
    await fs.copyFile(srcPath, destPath);
  }

  if (debug && markoFiles.length > 0) {
    console.log(`   Copied ${markoFiles.length} theme component(s) from: ${themeTagsDir}`);
    console.log(`   Output: ${destDir}`);
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
  const tagsDirConfig = config.markdown?.markoTags?.tagsDir || 'src/.markopress/tags';
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
  debug: boolean
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
      cwd: process.cwd(),
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        // Determine output directory
        const outputDir = outDir || 'dist';

        resolve({
          success: true,
          outDir: path.join(process.cwd(), outputDir),
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
  debug: boolean
): Promise<void> {
  console.log('   Using catch-all dynamic routes approach...');

  // Step 1: Generate content manifest JSON
  await generateContentManifest(manifest, routesDir, config);
  if (debug) console.log('   Generated content-manifest.json');

  // Step 2: Generate catch-all routes for each module dynamically
  for (const [moduleId, files] of Object.entries(manifest)) {
    // Skip non-array entries
    if (!Array.isArray(files)) continue;

    const contentFiles = files as ContentFile[];
    if (contentFiles.length === 0) continue;

    if (moduleId === 'pages') {
      // Generate catch-all route for pages (root-level, no module prefix)
      const pagesDir = path.join(routesDir, '$$slug');
      await fs.mkdir(pagesDir, { recursive: true });

      // Handler
      const pagesHandler = await loadTemplate('catch-all-handler.js.template', {
        CONTENT_TYPE: 'pages',
        MANIFEST_PATH: '../content-manifest.json',
      });
      await fs.writeFile(path.join(pagesDir, '+handler.js'), pagesHandler);

      // Page
      const pagesPage = await loadTemplate('catch-all-page.marko.template', {
        CONTENT_TYPE_CLASS: 'page',
      });
      await fs.writeFile(path.join(pagesDir, '+page.marko'), pagesPage);

      if (debug) console.log(`   Generated pages catch-all route (${contentFiles.length} files)`);
    } else {
      // Generate catch-all route for non-pages modules (docs, blog, guides, etc.)
      const moduleDir = path.join(routesDir, moduleId, '$$slug');
      await fs.mkdir(moduleDir, { recursive: true });

      // Handler - use correct manifest path based on nesting
      const manifestPath = moduleId === 'blog' ? '../../content-manifest.json' : '../../content-manifest.json';

      const handlerTemplate = await loadTemplate('catch-all-handler.js.template', {
        CONTENT_TYPE: moduleId,
        MANIFEST_PATH: manifestPath,
      });
      await fs.writeFile(path.join(moduleDir, '+handler.js'), handlerTemplate);

      // Page
      const pageTemplate = await loadTemplate('catch-all-page.marko.template', {
        CONTENT_TYPE_CLASS: moduleId,
      });
      await fs.writeFile(path.join(moduleDir, '+page.marko'), pageTemplate);

      if (debug) console.log(`   Generated ${moduleId} catch-all route (${contentFiles.length} files)`);
    }
  }

  // Step 3: Generate root layout that wraps all pages
  await generateRootLayout(routesDir, config, debug);
}

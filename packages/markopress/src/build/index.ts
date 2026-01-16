/**
 * MarkoPress Build System
 * Generates static HTML from markdown content
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { scanContent } from '../content/scanner.js';
import { loadConfig } from '../config/loader.js';
import type { ContentManifest, ContentFile } from '../content/types.js';
import type { ResolvedConfig } from '../config/types.js';
import { getDesignSystem, getDarkModeOverride, type DesignSystem } from '@markopress/theme-default/design-systems';
import { generateContentManifest } from './manifest-generator.js';

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

    // Step 1: Scan content
    console.log('📂 Scanning content directories...');
    const manifest = await scanContent({
      rootDir: process.cwd(),
      dirs: config.content,
    });

    console.log(`   Found ${manifest.pages.length} pages`);
    console.log(`   Found ${manifest.docs.length} docs`);
    console.log(`   Found ${manifest.blog.length} blog posts\n`);

    // Step 2: Ensure routes directory exists
    const routesDir = path.join(process.cwd(), 'src', 'routes');
    await fs.mkdir(routesDir, { recursive: true });

    // Step 3: Generate routes for content
    console.log('📝 Generating routes from content...');
    const routeMode = useCatchAllRoutes ?? config.build.useCatchAllRoutes;
    if (routeMode) {
      await generateCatchAllRoutes(manifest, routesDir, config, debug);
      console.log('   Using catch-all dynamic routes');
    } else {
      await generateRoutes(manifest, routesDir, config, debug);
      console.log('   Using static routes');
    }
    console.log('   Routes generated\n');

    // Step 3.5: Copy theme CSS to public directory
    console.log('🎨 Copying theme CSS...');
    await copyThemeCSS(process.cwd(), config, debug);
    console.log('   Theme CSS copied\n');

    // Step 4: Build with @marko/run
    console.log('🔨 Building with @marko/run...');
    const buildResult = await runMarkoRunBuild(outDir, debug);

    if (!buildResult.success) {
      errors.push(...buildResult.errors);
      return {
        success: false,
        outDir: '',
        pages: 0,
        errors,
      };
    }

    console.log('\n✅ Build completed successfully!');
    console.log(`   Output: ${buildResult.outDir}`);
    console.log(`   Pages: ${manifest.pages.length + manifest.docs.length + manifest.blog.length}`);

    return {
      success: true,
      outDir: buildResult.outDir,
      pages: manifest.pages.length + manifest.docs.length + manifest.blog.length,
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
 * Generate route files from content manifest
 */
export async function generateRoutes(
  manifest: ContentManifest,
  routesDir: string,
  config: ResolvedConfig,
  debug: boolean
): Promise<void> {
  // Clean up old generated routes safely
  // Only delete files in directories we manage, preserving user's custom files
  await cleanupGeneratedRoutes(routesDir, manifest, debug);

  // Generate static page routes
  for (const page of manifest.pages) {
    await generatePageRoute(page, routesDir, config, debug);
  }

  // Generate individual doc routes (not dynamic)
  for (const doc of manifest.docs) {
    await generateDocRoute(doc, routesDir, config, manifest, debug);
  }

  // Generate individual blog routes (not dynamic)
  for (const post of manifest.blog) {
    await generateBlogRoute(post, routesDir, config, debug);
  }

  // Generate root layout that wraps all pages with <${input.content}/>
  await generateRootLayout(routesDir, config, debug);

  if (debug) {
    console.log(`   Generated ${manifest.pages.length} page routes`);
    console.log(`   Generated ${manifest.docs.length} doc routes`);
    console.log(`   Generated ${manifest.blog.length} blog routes`);
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

  // Directories we manage and can clean up
  const MANAGED_PREFIXES = ['docs/', 'blog/', 'pages/'];

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
  debug: boolean
): Promise<void> {
  // For root path, use +page.marko. For others, use directory/+page.marko
  const routeDirPath = page.urlPath === '/' ? '' : page.urlPath.slice(1);
  const routeDir = path.join(routesDir, routeDirPath, '+page');

  // Create directory if needed
  await fs.mkdir(path.dirname(routeDir), { recursive: true });

  const title = String(page.processed.frontmatter.title || 'Page');
  const description = String(page.processed.frontmatter.description || '');
  const content = escapeMarkoTemplate(page.processed.html || '');

  // Generate the handler file (+handler.js)
  const handlerFile = path.join(path.dirname(routeDir), '+handler.js');
  const navbar = config.theme?.options?.navbar || [];
  const handlerCode = `export async function GET(context, next) {
  context.title = ${JSON.stringify(title)};
  context.description = ${JSON.stringify(description)};
  context.navbar = ${JSON.stringify(navbar)};
}
`;

  await fs.writeFile(handlerFile, handlerCode);

  // Generate the Marko template using template file
  const templateFile = routeDir + '.marko';
  const template = await loadTemplate('page.marko.template', {
    CONTENT: content,
  });

  await fs.writeFile(templateFile, template);

  if (debug) {
    console.log(`   Generated: ${templateFile}`);
  }
}

/**
 * Generate a single documentation route
 */
async function generateDocRoute(
  doc: ContentFile,
  routesDir: string,
  config: ResolvedConfig,
  manifest: ContentManifest,
  debug: boolean
): Promise<void> {
  // Preserve full path structure after /docs/
  // e.g., "/docs/api/build" -> "docs/api/build"
  const routePath = doc.urlPath.slice(1); // Remove leading slash
  const routeDir = path.join(routesDir, routePath, '+page');

  await fs.mkdir(path.dirname(routeDir), { recursive: true });

  const title = String(doc.processed.frontmatter.title || 'Doc');
  const description = String(doc.processed.frontmatter.description || '');
  const content = escapeMarkoTemplate(doc.processed.html || '');

  // Get sidebar settings from config
  const sidebarConfig = config.theme?.options?.sidebar || {};

  // Find sidebar items for this route
  let currentSidebar: Array<{ text: string; link: string }> = [];
  for (const [prefix, items] of Object.entries(sidebarConfig)) {
    if (doc.urlPath.startsWith(prefix)) {
      const sidebarItems = items;

      // Check if autoGenerate is true
      if (typeof sidebarItems === 'object' && 'autoGenerate' in sidebarItems && sidebarItems.autoGenerate === true) {
        // Auto-generate sidebar from all docs
        currentSidebar = manifest.docs
          .filter((d) => d.urlPath.startsWith(prefix))
          .map((d) => ({
            text: String(d.processed.frontmatter.title || d.urlPath),
            link: d.urlPath,
          }));
      } else if (Array.isArray(sidebarItems)) {
        // Use provided sidebar items
        currentSidebar = sidebarItems;
      }
      break;
    }
  }

  // Generate handler file (+handler.js) with sidebar data
  const handlerFile = path.join(path.dirname(routeDir), '+handler.js');
  const navbar = config.theme?.options?.navbar || [];
  const handlerCode = `export async function GET(context, next) {
  context.title = ${JSON.stringify(title)};
  context.description = ${JSON.stringify(description)};
  context.navbar = ${JSON.stringify(navbar)};
  context.sidebar = ${JSON.stringify(currentSidebar)};
}
`;

  await fs.writeFile(handlerFile, handlerCode);

  // Generate Marko template using template file
  const templateFile = routeDir + '.marko';
  const template = await loadTemplate('doc.marko.template', {
    CONTENT: content,
  });

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
  const content = escapeMarkoTemplate(post.processed.html || '');

  // Generate handler file (+handler.js)
  const handlerFile = path.join(path.dirname(routeDir), '+handler.js');
  const navbar = config.theme?.options?.navbar || [];
  const handlerCode = `export async function GET(context, next) {
  context.title = ${JSON.stringify(title)};
  context.description = ${JSON.stringify(description)};
  context.navbar = ${JSON.stringify(navbar)};
  context.date = ${JSON.stringify(date)};
  context.author = ${JSON.stringify(author)};
}
`;

  await fs.writeFile(handlerFile, handlerCode);

  // Generate Marko template using template file
  const templateFile = routeDir + '.marko';
  const template = await loadTemplate('blog-post.marko.template', {
    CONTENT: content,
  });

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
  const publicDir = path.join(rootDir, 'public');
  await fs.mkdir(publicDir, { recursive: true });

  // For now, copy the styles-base.css from the theme package
  // In the future, this will generate CSS variables from design system tokens
  const themeName = config.theme?.name || '@markopress/theme-default';

  // Security: Validate theme name to prevent path traversal
  try {
    validateThemeName(themeName);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Security: ${errorMessage}`);
  }

  // Try multiple locations for the theme CSS
  const possiblePaths = [
    // pnpm workspace: root node_modules
    path.join(rootDir, '..', 'node_modules', themeName, 'src', 'styles-base.css'),
    // Local node_modules
    path.join(rootDir, 'node_modules', themeName, 'src', 'styles-base.css'),
    // Direct packages path (for monorepo)
    path.join(rootDir, '..', 'packages', 'theme-default', 'src', 'styles-base.css'),
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
    console.warn('   Warning: Could not find theme CSS, using minimal fallback');
    const fallbackCSS = `/* Minimal fallback CSS */\nbody { font-family: system-ui, sans-serif; margin: 0; padding: 0; }`;
    const outputPath = path.join(publicDir, 'theme.css');
    await fs.writeFile(outputPath, fallbackCSS);
    return;
  }

  // Generate design system CSS variables (placeholder for now)
  const designSystemName = config.theme?.designSystem || 'vitepress';
  const cssVariables = generateDesignSystemVariables(designSystemName);

  // Combine variables and theme CSS
  const finalCSS = `${cssVariables}\n\n${themeCSS}`;

  // Write to public/theme.css
  const outputPath = path.join(publicDir, 'theme.css');
  await fs.writeFile(outputPath, finalCSS);

  if (debug) {
    console.log(`   Copied theme CSS from: ${foundPath}`);
    console.log(`   Output: ${outputPath}`);
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
 * Escape Marko template syntax to prevent code injection
 * Escapes all Marko-specific syntax that could be executed as code
 *
 * @param str - Raw string that may contain Marko template syntax
 * @returns Escaped string safe for embedding in Marko templates
 *
 * Security: Prevents XSS by escaping:
 * - ${} interpolation
 * - <$ dynamic tags
 * - <for> loops
 * - <if> conditionals
 * - <while> loops
 * - <macro> definitions
 */
export function escapeMarkoTemplate(str: string): string {
  return str
    .replace(/\$\{/g, '$\\{')              // Escape ${} interpolation
    .replace(/<\$/g, '<\\$')               // Escape <$ dynamic tags
    .replace(/<for\|/g, '<\\for|')         // Escape <for> loops
    .replace(/<for\(/g, '<\\for(')         // Escape <for()> alternative syntax
    .replace(/<if=/g, '<\\if=')            // Escape <if> conditionals
    .replace(/<if\(/g, '<\\if(')           // Escape <if()> alternative syntax
    .replace(/<else-if=/g, '<\\else-if=')  // Escape <else-if>
    .replace(/<else>/g, '<\\else>')        // Escape <else>
    .replace(/<while\(/g, '<\\while(')     // Escape <while> loops
    .replace(/<macro\|/g, '<\\macro|');    // Escape <macro> definitions
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
 * Generate catch-all routes using dynamic routes (NEW APPROACH)
 * This replaces the old approach of generating individual route files for each content
 */
export async function generateCatchAllRoutes(
  manifest: ContentManifest,
  routesDir: string,
  config: ResolvedConfig,
  debug: boolean
): Promise<void> {
  console.log('   Using catch-all dynamic routes approach...');

  // Step 1: Generate content manifest JSON
  await generateContentManifest(manifest, routesDir, config);
  if (debug) console.log('   Generated content-manifest.json');

  // Step 2: Generate catch-all route for docs
  if (manifest.docs.length > 0) {
    const docsDir = path.join(routesDir, 'docs', '$$slug');
    await fs.mkdir(docsDir, { recursive: true });
    
    // Handler
    const docsHandler = await loadTemplate('catch-all-handler.js.template', {
      CONTENT_TYPE: 'docs',
      MANIFEST_PATH: '../../content-manifest.json',
    });
    await fs.writeFile(path.join(docsDir, '+handler.js'), docsHandler);
    
    // Page
    const docsPage = await loadTemplate('catch-all-page.marko.template', {
      CONTENT_TYPE_CLASS: 'docs',
    });
    await fs.writeFile(path.join(docsDir, '+page.marko'), docsPage);
    
    if (debug) console.log('   Generated docs catch-all route');
  }

  // Step 3: Generate catch-all route for blog
  if (manifest.blog.length > 0) {
    const blogDir = path.join(routesDir, 'blog', '$$slug');
    await fs.mkdir(blogDir, { recursive: true });
    
    // Handler
    const blogHandler = await loadTemplate('catch-all-handler.js.template', {
      CONTENT_TYPE: 'blog',
      MANIFEST_PATH: '../../content-manifest.json',
    });
    await fs.writeFile(path.join(blogDir, '+handler.js'), blogHandler);
    
    // Page
    const blogPage = await loadTemplate('catch-all-page.marko.template', {
      CONTENT_TYPE_CLASS: 'blog',
    });
    await fs.writeFile(path.join(blogDir, '+page.marko'), blogPage);
    
    if (debug) console.log('   Generated blog catch-all route');
  }

  // Step 4: Generate catch-all route for pages
  if (manifest.pages.length > 0) {
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
    
    if (debug) console.log('   Generated pages catch-all route');
  }

  // Step 5: Generate root layout that wraps all pages
  await generateRootLayout(routesDir, config, debug);
}

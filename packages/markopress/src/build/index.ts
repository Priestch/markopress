/**
 * MarkoPress Build System
 * Generates static HTML from markdown content
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { scanContent } from '../content/scanner.js';
import { loadConfig } from '../config/loader.js';
import type { ContentManifest } from '../content/types.js';

export interface BuildOptions {
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
  const { outDir, debug = false } = options;
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
    await generateRoutes(manifest, routesDir, debug);
    console.log('   Routes generated\n');

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
async function generateRoutes(
  manifest: ContentManifest,
  routesDir: string,
  debug: boolean
): Promise<void> {
  // Generate static page routes
  for (const page of manifest.pages) {
    await generatePageRoute(page, routesDir, debug);
  }

  // Generate individual doc routes (not dynamic)
  for (const doc of manifest.docs) {
    await generateDocRoute(doc, routesDir, debug);
  }

  // Generate individual blog routes (not dynamic)
  for (const post of manifest.blog) {
    await generateBlogRoute(post, routesDir, debug);
  }

  // Generate root layout that wraps all pages with <${input.renderBody}/>
  await generateRootLayout(routesDir, debug);

  if (debug) {
    console.log(`   Generated ${manifest.pages.length} page routes`);
    console.log(`   Generated ${manifest.docs.length} doc routes`);
    console.log(`   Generated ${manifest.blog.length} blog routes`);
  }
}

/**
 * Generate a static page route
 */
async function generatePageRoute(
  page: any,
  routesDir: string,
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
  const handlerCode = `export async function GET(context, next) {
  context.title = ${JSON.stringify(title)};
  context.description = ${JSON.stringify(description)};
}
`;

  await fs.writeFile(handlerFile, handlerCode);

  // Generate the Marko template with page content only (layout wrapper is in +layout.marko)
  const templateFile = routeDir + '.marko';
  const template = `<div class="container">
  <h1>\${$global.title}</h1>
  <div class="content">
    ${content}
  </div>
</div>
`;

  await fs.writeFile(templateFile, template);

  if (debug) {
    console.log(`   Generated: ${templateFile}`);
  }
}

/**
 * Generate a single documentation route
 */
async function generateDocRoute(
  doc: any,
  routesDir: string,
  debug: boolean
): Promise<void> {
  // Extract the doc slug from urlPath (e.g., "/docs/intro" -> "intro")
  const docSlug = doc.urlPath.split('/').pop();
  const routeDirPath = path.join('docs', docSlug);
  const routeDir = path.join(routesDir, routeDirPath, '+page');

  await fs.mkdir(path.dirname(routeDir), { recursive: true });

  const title = String(doc.processed.frontmatter.title || 'Doc');
  const description = String(doc.processed.frontmatter.description || '');
  const content = escapeMarkoTemplate(doc.processed.html || '');

  // Generate handler file (+handler.js)
  const handlerFile = path.join(path.dirname(routeDir), '+handler.js');
  const handlerCode = `export async function GET(context, next) {
  context.title = ${JSON.stringify(title)};
  context.description = ${JSON.stringify(description)};
}
`;

  await fs.writeFile(handlerFile, handlerCode);

  // Generate Marko template with page content only (layout wrapper is in +layout.marko)
  const templateFile = routeDir + '.marko';
  const template = `<div class="container">
  <h1>\${$global.title}</h1>
  <div class="content">
    ${content}
  </div>
</div>
`;

  await fs.writeFile(templateFile, template);

  if (debug) {
    console.log(`   Generated: ${templateFile}`);
  }
}

/**
 * Generate a single blog route
 */
async function generateBlogRoute(
  post: any,
  routesDir: string,
  debug: boolean
): Promise<void> {
  // Extract the post slug from urlPath (e.g., "/blog/2024-01-11-test-post" -> "2024-01-11-test-post")
  const postSlug = post.urlPath.split('/').pop();
  const routeDirPath = path.join('blog', postSlug);
  const routeDir = path.join(routesDir, routeDirPath, '+page');

  await fs.mkdir(path.dirname(routeDir), { recursive: true });

  const title = String(post.processed.frontmatter.title || 'Blog Post');
  const description = String(post.processed.frontmatter.description || '');
  const date = String(post.processed.frontmatter.date || '');
  const author = String(post.processed.frontmatter.author || '');
  const content = escapeMarkoTemplate(post.processed.html || '');

  // Generate handler file (+handler.js)
  const handlerFile = path.join(path.dirname(routeDir), '+handler.js');
  const handlerCode = `export async function GET(context, next) {
  context.title = ${JSON.stringify(title)};
  context.description = ${JSON.stringify(description)};
  context.date = ${JSON.stringify(date)};
  context.author = ${JSON.stringify(author)};
}
`;

  await fs.writeFile(handlerFile, handlerCode);

  // Generate Marko template with page content only (layout wrapper is in +layout.marko)
  const templateFile = routeDir + '.marko';
  const template = `<article class="blog-post">
  <header>
    <h1>\${$global.title}</h1>
    <div class="meta">
      <if=$global.date>
        <span class="date">\${$global.date}</span>
      </if>
      <if=$global.author>
        <span class="author"> by \${$global.author}</span>
      </if>
    </div>
  </header>
  <div class="content">
    ${content}
  </div>
</article>
`;

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
  debug: boolean
): Promise<void> {
  const layoutFile = path.join(routesDir, '+layout.marko');

  // Build template using template literals
  // Note: Need to escape ${input...} as \${input...} to avoid premature evaluation
  const template = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${$global.title || 'MarkoPress Site'}</title>
  <if=$global.description>
    <meta name="description" content=$global.description>
  </if>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { margin-bottom: 1rem; }
    .content { margin-top: 2rem; }
    .doc-container, .blog-post { display: grid; gap: 2rem; }
  </style>
</head>
<body>
  <\${input.content}/>
</body>
</html>
`;

  await fs.writeFile(layoutFile, template);

  if (debug) {
    console.log(`   Generated: ${layoutFile}`);
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
 * Escape Marko template syntax
 */
function escapeMarkoTemplate(str: string): string {
  return str.replace(/\$\{/g, '$\\{');
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

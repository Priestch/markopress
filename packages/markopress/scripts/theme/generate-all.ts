/**
 * CSS Generation Script
 * Generates all theme CSS variants from design systems
 */

import { writeFile, mkdir, copyFile, readFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readdir } from 'fs/promises';
import { generateThemeCSS } from './generate-css.js';
import { designSystems } from '../../src/theme/default/design-systems/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../../src/theme/default/public');
const componentsDir = resolve(__dirname, '../../src/theme/default/components');
const distTagsDir = resolve(__dirname, '../../src/theme/default/tags');

/**
 * Copy Marko components to dist/tags for export
 * Recursively copies from src/components and subdirectories
 */
async function copyComponentsToDist() {
  try {
    // Ensure dist/tags directory exists
    await mkdir(distTagsDir, { recursive: true });

    // Recursively get all .marko files from src/components
    async function getMarkoFiles(dir: string): Promise<string[]> {
      const entries = await readdir(dir, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        const fullPath = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          const subFiles = await getMarkoFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.marko')) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const markoFiles = await getMarkoFiles(componentsDir);

    // Copy each .marko file to dist/tags
    // Files in subdirectories get flattened (theme/ThemeNavbarEnd.marko -> ThemeNavbarEnd.marko)
    for (const srcPath of markoFiles) {
      const fileName = srcPath.split('/').pop()!; // Get just the filename
      const destPath = resolve(distTagsDir, fileName);

      await copyFile(srcPath, destPath);
    }

    console.log(`✓ Copied ${markoFiles.length} component(s) to dist/tags`);
  } catch (error) {
    // Silently skip if components dir doesn't exist yet
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Warning: Failed to copy components:', error);
    }
  }
}

/**
 * Generate all theme CSS variants
 */
export async function generateAllThemes() {
  const styles = ['default', 'vitepress', 'docusaurus'] as const;

  console.log('Generating theme CSS files...\n');

  // Read the component styles (includes line numbers, code blocks, etc.)
  const stylesCssPath = resolve(__dirname, '../../src/theme/default/styles.css');
  const componentStyles = await readFile(stylesCssPath, 'utf-8');

  for (const style of styles) {
    const system = designSystems[style];
    const css = generateThemeCSS(system);
    const outputPath = resolve(publicDir, `theme-${style}.css`);

    // Combine design system CSS + component styles
    const fullCss = `${css}\n\n/* Component Styles */\n${componentStyles}`;
    await writeFile(outputPath, fullCss, 'utf-8');
    console.log(`✓ Generated theme-${style}.css`);
  }

  console.log('\nCopying Marko components to dist/tags...\n');
  await copyComponentsToDist();

  console.log('\n✨ All theme assets generated successfully!');
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateAllThemes().catch((error) => {
    console.error('Error generating CSS files:', error);
    process.exit(1);
  });
}

/**
 * CSS Generation Script
 * Generates all theme CSS variants from design systems
 */

import { writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { generateThemeCSS } from './generate-css.js';
import { designSystems } from '../design-systems/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../../public');

/**
 * Generate all theme CSS variants
 */
export async function generateAllThemes() {
  const styles = ['default', 'vitepress', 'docusaurus'] as const;

  console.log('Generating theme CSS files...\n');

  for (const style of styles) {
    const system = designSystems[style];
    const css = generateThemeCSS(system);
    const outputPath = resolve(publicDir, `theme-${style}.css`);
    await writeFile(outputPath, css, 'utf-8');
    console.log(`✓ Generated theme-${style}.css`);
  }

  console.log('\n✨ All theme CSS files generated successfully!');
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateAllThemes().catch((error) => {
    console.error('Error generating CSS files:', error);
    process.exit(1);
  });
}

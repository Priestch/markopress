#!/usr/bin/env node
/**
 * Minify all JS files in dist directory
 */
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { minify } from 'terser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = join(__dirname, '..', 'dist');

async function findJsFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findJsFiles(fullPath));
    } else if (entry.isFile() && extname(entry.name) === '.js') {
      files.push(fullPath);
    }
  }
  
  return files;
}

async function minifyFile(filePath) {
  const code = await readFile(filePath, 'utf-8');
  
  const result = await minify(code, {
    module: true,
    ecma: 2020,
    compress: {
      passes: 2,
      unsafe: true,
    },
    mangle: true,
    format: {
      comments: false,
    },
  });
  
  if (result.code) {
    await writeFile(filePath, result.code, 'utf-8');
    return true;
  }
  return false;
}

async function main() {
  console.log('🔍 Finding JS files to minify...');
  const files = await findJsFiles(distDir);
  console.log(`   Found ${files.length} JS files`);
  
  let totalOriginal = 0;
  let totalMinified = 0;
  
  for (const file of files) {
    const original = (await readFile(file, 'utf-8')).length;
    totalOriginal += original;
    
    await minifyFile(file);
    
    const minified = (await readFile(file, 'utf-8')).length;
    totalMinified += minified;
    
    const saved = ((1 - minified / original) * 100).toFixed(1);
    console.log(`   ✓ ${file.replace(distDir, 'dist')} (-${saved}%)`);
  }
  
  const totalSaved = ((1 - totalMinified / totalOriginal) * 100).toFixed(1);
  const savedKB = ((totalOriginal - totalMinified) / 1024).toFixed(1);
  
  console.log(`\n✨ Minified ${files.length} files`);
  console.log(`   Original: ${(totalOriginal / 1024).toFixed(1)} KB`);
  console.log(`   Minified: ${(totalMinified / 1024).toFixed(1)} KB`);
  console.log(`   Saved: ${savedKB} KB (${totalSaved}%)`);
}

main().catch((err) => {
  console.error('Minification failed:', err);
  process.exit(1);
});

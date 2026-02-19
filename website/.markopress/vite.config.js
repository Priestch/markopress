import { defineConfig } from 'vite';
import marko from '@marko/run/vite';
import { markdownContentPlugin } from 'markopress/build';

export default defineConfig({
  base: process.env.BASE_URL || '/',
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

import { defineConfig } from 'vite';
import marko from '@marko/run/vite';
import { markdownContentPlugin } from 'markopress/build';

export default defineConfig({
  plugins: [
    marko(),
    markdownContentPlugin(),
  ],
  build: {
    outDir: 'dist',
  },
});

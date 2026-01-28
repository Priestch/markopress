import { defineConfig } from 'vite';
import marko from '@marko/run/vite';

export default defineConfig({
  plugins: [
    marko(),
    {
      name: 'test-virtual-module',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'virtual:test') {
          console.log('[test-virtual-module] resolveId called for:', id);
          return '\0' + id;
        }
      },
      load(id) {
        if (id === '\0virtual:test') {
          console.log('[test-virtual-module] load called for:', id);
          return 'export default "Hello from virtual module!"';
        }
      }
    }
  ],
});

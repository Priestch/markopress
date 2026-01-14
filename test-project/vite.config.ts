import { defineConfig } from 'vite';
import marko from '@marko/run/vite';
import staticAdapter from '@marko/run-adapter-static';

export default defineConfig({
  plugins: [
    marko({
      routesDir: './src/routes',
      adapter: staticAdapter({
        // Specify which URLs to crawl
        urls: [
          '/',
          '/docs/intro',
          '/docs/custom-dir',
          '/blog/2024-01-11-test-post',
        ],
      }),
    }),
  ],
  server: {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  preview: {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
});

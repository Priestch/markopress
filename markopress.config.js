import { defineConfig } from './packages/markopress/dist/config/index.js';

export default defineConfig({
  site: {
    title: 'MarkoPress',
    description: 'A general-purpose static site generator using Marko.js v6',
    base: '/',
    lang: 'en-US',
    head: [
      ['meta', { name: 'theme-color', content: '#3c8772' }],
    ],
  },
  content: {
    pages: 'content/pages',
    docs: 'content/docs',
    blog: 'content/blog',
  },
  theme: {
    name: '@markopress/theme-default',
    options: {
      navbar: [
        { text: 'Home', link: '/' },
        { text: 'About', link: '/about' },
        { text: 'Docs', link: '/docs/getting-started' },
        { text: 'Blog', link: '/blog' },
      ],
      // sidebar removed temporarily to test plugin system
      // sidebar: {
      //   '/docs/': [
      //     {
      //       text: 'Guide',
      //       items: [
      //         { text: 'Getting Started', link: '/docs/getting-started' },
      //         { text: 'Configuration', link: '/docs/configuration' },
      //       ],
      //     },
      //   ],
      // },
      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright © 2024-present MarkoPress',
      },
    },
  },
  markdown: {
    lineNumbers: false,  // Disable to avoid Shiki HTML parsing issues
    markoTags: {
      enabled: true,
      tagsDir: 'tags/',
    },
  },
  build: {
    useCatchAllRoutes: true,  // Use dynamic routes with $!{} syntax for HTML rendering
  },
  plugins: [
    './test-plugin.js',
    '@markopress/plugin-content-pages',
    '@markopress/plugin-content-docs',
    '@markopress/plugin-content-blog',
  ],
});

import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'MarkoPress Demo',
    description: 'A demo site built with MarkoPress',
    base: process.env.BASE_URL || '/',
    lang: 'en-US',
    head: [
      ['meta', { name: 'theme-color', content: '#3c8772' }],
    ],
  },
  contentDir: '../content',
  content: {
    pages: '../content/pages',
    guides: { dir: '../content/guides', sidebar: true, toc: true },
    blog: '../content/blog',
  },
  theme: {
    name: '@markopress/theme-default',
    options: {
      style: 'default',
      navbar: [
        { text: 'Home', link: '/' },
        { text: 'Features', link: '/features' },
        { text: 'Guides', link: '/guides/getting-started' },
        { text: 'Blog', link: '/blog' },
      ],
      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright © 2024-present MarkoPress',
      },
    },
  },
  markdown: {
    markoTags: {
      enabled: true,
    },
  },
  build: {
    useCatchAllRoutes: true,
  },
  plugins: [
    'blog-index',
    ['sidenav', { module: 'guides' }],
    'toc',
  ],
});

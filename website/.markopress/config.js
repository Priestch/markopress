import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'MarkoPress',
    description: 'A general-purpose static site generator using Marko.js v6',
    base: process.env.BASE_URL || '/',
    lang: 'en-US',
    head: [
      ['meta', { name: 'theme-color', content: '#3c8772' }],
    ],
  },
  content: {
    pages: '../content/pages',           // No TOC (default)
    guides: { dir: '../content/guides', toc: true },  // Enable TOC for guides
    blog: '../content/blog',             // No TOC for blog posts
  },
  theme: {
    name: '@markopress/theme-default',
    options: {
      style: 'default', // or 'docusaurus' or 'default'
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
    useCatchAllRoutes: true,  // Use dynamic routes with $!{} syntax for HTML rendering
  },
  plugins: [
    'blog-index',
    ['sidenav', { module: 'guides' }],
    'toc',
    // Search and RSS coming later
  ],
});

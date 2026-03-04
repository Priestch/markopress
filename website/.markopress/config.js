import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'MarkoPress Demo',
    description: 'A demo site built with MarkoPress',
    base: process.env.BASE_URL || '/',
    lang: 'en-US',
    head: [
      {
        type: 'meta',
        name: 'theme-color',
        content: '#3c8772'
      },
      {
        type: 'script',
        src: 'https://cloud.umami.is/script.js',
        defer: true,
        position: 'bottom',  // Load in head-bottom (before </head>)
        attrs: {
          'data-website-id': '49883dab-2308-45a7-bdec-cd88e700d04b'
        }
      },
    ],
  },
  contentDir: 'content',
  content: {
    guides: { sidebar: true, toc: true },
    blog: { rss: true, list: true },
    documentation: { sidebar: true },
    portfolio: {},
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
    'head-inject',
    'seo',
    'blog-index',
    ['sidenav', { module: 'guides' }],
    'toc',
  ],
  seo: {
    sitemap: {
      hostname: 'https://priestch.github.io',
    }
  },
});

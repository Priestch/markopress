import { defineConfig } from 'markopress/config';

export default defineConfig({
  site: {
    title: 'MarkoPress Test Site',
    description: 'Testing MarkoPress with custom content directory',
    base: '/',
    lang: 'en-US',
  },
  // Specify custom content directory (different from default 'content/')
  content: {
    pages: 'my-content/pages',
    docs: 'my-content/docs',
    blog: 'my-content/blog',
  },
  theme: {
    name: '@markopress/theme-default',
    options: {
      navbar: [
        { text: 'Home', link: '/' },
        { text: 'Guide', link: '/docs/intro' },
        { text: 'Blog', link: '/blog' },
      ],
      sidebar: {
        '/docs/': [
          {
            text: 'Documentation',
            items: [
              { text: 'Introduction', link: '/docs/intro' },
              { text: 'Custom Directory', link: '/docs/custom-dir' },
            ],
          },
        ],
      },
    },
  },
  markdown: {
    lineNumbers: true,
  },
  plugins: [
    '@markopress/plugin-content-pages',
    '@markopress/plugin-content-docs',
    '@markopress/plugin-content-blog',
  ],
});

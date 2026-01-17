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
    designSystem: "docusaurus",
    options: {
      navbar: [
        { text: 'Home', link: '/' },
        { text: 'Guide', link: '/docs/intro' },
        { text: 'Blog', link: '/blog' },
      ],
      sidebar: {
        '/docs/': {
          autoGenerate: true,  // Auto-generate from file structure
        },
      },
    },
  },
  markdown: {
    lineNumbers: true,
    markoTags: {
      enabled: true,
      tagsDir: 'tags/',
    },
  },
  plugins: [
    '@markopress/plugin-content-pages',
    '@markopress/plugin-content-docs',
    '@markopress/plugin-content-blog',
  ],
});

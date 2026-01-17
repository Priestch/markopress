import { defineConfig } from '@markopress/markopress';

export default defineConfig({
  site: {
    title: 'Marko Tags Test',
    description: 'Testing Marko tags in markdown',
  },
  content: {
    pages: 'content/pages',
  },
  markdown: {
    markoTags: {
      enabled: true,
      tagsDir: 'tags/',
    },
  },
});

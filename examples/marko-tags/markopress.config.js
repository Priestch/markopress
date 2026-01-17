// MarkoPress Configuration for Marko Tags Example
export default {
  site: {
    title: 'Marko Tags Example',
    description: 'A minimal example of using Marko components in Markdown',
  },

  content: {
    pages: 'content/pages',
  },

  // Enable Marko Tags feature
  markdown: {
    markoTags: {
      enabled: true,
      tagsDir: 'tags/',
    },
  },

  theme: '@markopress/theme-default',
};

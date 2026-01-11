# @markopress/theme-default

The default theme for MarkoPress static sites.

## Features

- 🎨 Modern, responsive design
- 🌙 Dark mode support
- 📱 Mobile-friendly navigation
- 🎯 SEO optimized with Open Graph tags
- ⚡ Fast loading with minimal JavaScript
- 🔧 Highly customizable

## Installation

This theme is included by default in MarkoPress. To use it:

```typescript
// markopress.config.ts
import { defineConfig } from 'markopress';

export default defineConfig({
  theme: '@markopress/theme-default',
  themeConfig: {
    name: 'My Site',
    description: 'My awesome site',
    navbar: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/docs' },
      { text: 'Blog', link: '/blog' },
    ],
  },
});
```

## Configuration

### Navbar

```typescript
navbar: [
  { text: 'Home', link: '/' },
  { text: 'Docs', link: '/docs' },
  { text: 'GitHub', link: 'https://github.com/user/repo', target: '_blank' },
]
```

### Sidebar

```typescript
sidebar: {
  '/docs/': [
    {
      text: 'Getting Started',
      items: [
        { text: 'Introduction', link: '/docs/intro' },
        { text: 'Installation', link: '/docs/install' },
      ],
    },
  ],
}
```

### Footer

```typescript
footer: {
  copyright: '© {year} My Site',
  links: [
    { text: 'GitHub', link: 'https://github.com/user/repo' },
    { text: 'Twitter', link: 'https://twitter.com/user' },
  ],
}
```

### Features

```typescript
features: {
  darkMode: true,      // Enable dark mode toggle
  search: false,       // Enable search (coming soon)
  editLink: false,     // Show "Edit this page" link
  lastUpdated: true,   // Show last updated date
  prevNext: true,      // Show prev/next navigation
  sidebar: true,       // Show sidebar on docs
}
```

## Customization

### Override Styles

Create `.markopress/theme/styles.css`:

```css
:root {
  --accent-color: #42b883;  /* Your brand color */
  --border-radius: 8px;
  --font-family: 'Your Font', sans-serif;
}
```

### Override Components

Copy any component from `node_modules/@markopress/theme-default/src/components/` to `.markopress/theme/components/` and customize it.

### Create Custom Layouts

1. Copy a layout from the theme
2. Modify it in `.markopress/theme/layouts/`
3. Reference it in frontmatter:

```markdown
---
layout: custom
---
```

## Slots

The theme provides these slots that you can override:

- `header` - Site header
- `footer` - Site footer  
- `sidebar` - Documentation sidebar
- `home-top` - Content above page grid
- `home-bottom` - Content below page grid
- `doc-top` - Content above doc content
- `doc-bottom` - Content below doc content

## File Structure

```
packages/theme-default/
├── src/
│   ├── layouts/
│   │   ├── default.marko      # Main layout
│   │   ├── HomePage.marko      # Home page layout
│   │   └── ContentPage.marko   # Content page layout
│   ├── components/
│   │   ├── Header.marko
│   │   ├── Footer.marko
│   │   └── Sidebar.marko
│   ├── styles.css             # Theme styles
│   ├── theme.ts               # Theme scripts
│   └── index.ts               # Theme API
└── package.json
```

## License

MIT

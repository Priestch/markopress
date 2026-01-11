# Theming Guide

Customize your site's appearance with the MarkoPress theme system.

## Overview

MarkoPress uses a powerful **slot-based theme system** that lets you customize any part of your site without forking the entire theme. The theme is built with:

- **CSS Custom Properties** - Easy color and style customization
- **Component Slots** - Override any component without touching the core
- **Layout System** - Flexible layouts for different page types
- **Dark Mode** - Built-in dark mode support

## Quick Customization

The fastest way to customize your site is through CSS variables.

### CSS Variables

Create `.markopress/theme/styles.css` in your project:

```css
/* .markopress/theme/styles.css */

:root {
  /* Brand Colors */
  --bg-primary: #f8f9fa;
  --bg-secondary: white;
  --bg-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

  /* Text Colors */
  --text-primary: #333;
  --text-secondary: #666;
  --text-inverted: white;

  /* Accent Colors */
  --accent-color: #667eea;
  --accent-hover: #5568d3;

  /* UI Elements */
  --border-color: #e9ecef;
  --card-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  --code-bg: #f4f4f4;
}

.dark-mode {
  /* Dark mode overrides */
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --border-color: #404040;
  --accent-color: #7c8ffc;
  --code-bg: #1e1e1e;
}
```

### Example: Custom Color Scheme

Transform your site with a new color palette:

```css
:root {
  /* Ocean Theme */
  --bg-gradient: linear-gradient(135deg, #0061ff 0%, #60efff 100%);
  --accent-color: #0061ff;
  --accent-hover: #0052cc;
}
```

```css
:root {
  /* Sunset Theme */
  --bg-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  --accent-color: #f5576c;
  --accent-hover: #d64558;
}
```

```css
:root {
  /* Forest Theme */
  --bg-gradient: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  --accent-color: #11998e;
  --accent-hover: #0e8076;
}
```

## Component Overrides

Override any theme component by copying it to your project.

### Override Structure

```
your-project/
├── .markopress/
│   └── theme/
│       ├── components/      # Override components
│       │   ├── Header.marko
│       │   ├── Footer.marko
│       │   └── Sidebar.marko
│       ├── layouts/         # Override layouts
│       │   ├── default.marko
│       │   └── docs.marko
│       └── styles.css       # Custom styles
```

### Custom Header

Copy `Header.marko` from `@markopress/theme-default` and modify:

```marko
<!-- .markopress/theme/components/Header.marko -->

class {
  onCreate() {
    this.state = {
      mobileMenuOpen: false,
    };
  }

  toggleMobileMenu() {
    this.state.mobileMenuOpen = !this.state.mobileMenuOpen;
  }
}

<header class="custom-header">
  <div class="header-container">
    <!-- Logo -->
    <a href="/" class="logo">
      <img src="/logo.svg" alt="My Site" />
    </a>

    <!-- Navigation -->
    <nav class=${['navbar', { mobile: state.mobileMenuOpen }]}>
      <ul class="nav-links">
        <for|item| of=input.navbar>
          <li>
            <a href=item.link target=item.target || '_self'>
              ${item.text}
            </a>
          </li>
        </for>
      </ul>
    </nav>

    <!-- Mobile Menu Toggle -->
    <button class="mobile-toggle" onClick=>toggleMobileMenu()>
      ☰
    </button>
  </div>
</header>

<style>`
  .custom-header {
    background: var(--bg-secondary);
    padding: 1rem 2rem;
    border-radius: 12px;
    box-shadow: var(--card-shadow);
    margin-bottom: 2rem;
  }

  .header-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }

  .logo img {
    height: 40px;
  }

  .navbar {
    display: flex;
    align-items: center;
  }

  .nav-links {
    display: flex;
    list-style: none;
    gap: 2rem;
    margin: 0;
    padding: 0;
  }

  .nav-links a {
    color: var(--text-primary);
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }

  .nav-links a:hover {
    color: var(--accent-color);
  }

  .mobile-toggle {
    display: none;
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .header-container {
      flex-wrap: wrap;
    }

    .navbar {
      display: none;
      width: 100%;
    }

    .navbar.mobile {
      display: block;
    }

    .nav-links {
      flex-direction: column;
      gap: 1rem;
      padding: 1rem 0;
    }

    .mobile-toggle {
      display: block;
    }
  }
`</style>
```

### Custom Footer

```marko
<!-- .markopress/theme/components/Footer.marko -->

<footer class="custom-footer">
  <div class="footer-container">
    <!-- Copyright -->
    <div class="footer-copyright">
      <p>${input.copyright || '© {year} My Site'}</p>
    </div>

    <!-- Footer Links -->
    <if(input.links)>
      <nav class="footer-links">
        <for|link| of=input.links>
          <a href=link.link target=link.target || '_self'>
            ${link.text}
          </a>
        </for>
      </nav>
    </if>

    <!-- Social Links -->
    <div class="footer-social">
      <a href="https://github.com/user/repo" aria-label="GitHub">
        <svg><!-- GitHub icon --></svg>
      </a>
      <a href="https://twitter.com/user" aria-label="Twitter">
        <svg><!-- Twitter icon --></svg>
      </a>
    </div>
  </div>
</footer>

<style>`
  .custom-footer {
    background: var(--bg-secondary);
    padding: 3rem 2rem;
    margin-top: 4rem;
    border-radius: 12px;
  }

  .footer-container {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 2rem;
  }

  .footer-links {
    display: flex;
    gap: 2rem;
  }

  .footer-links a {
    color: var(--text-secondary);
    text-decoration: none;
  }

  .footer-links a:hover {
    color: var(--accent-color);
  }

  @media (max-width: 768px) {
    .footer-container {
      flex-direction: column;
      text-align: center;
    }

    .footer-links {
      flex-direction: column;
      gap: 1rem;
    }
  }
`</style>
```

## Layout Customization

Customize layouts for different page types.

### Documentation Layout

Create `.markopress/theme/layouts/docs.marko`:

```marko
<!-- .markopress/theme/layouts/docs.marko -->

class {
  onCreate() {
    this.state = {
      tocOpen: false,
    };
  }
}

<include('./layouts/default.marko')>
  <@header>input.header || <components.Header/> </@header>
  <@body>
    <div class="docs-layout">
      <!-- Sidebar -->
      <aside class="docs-sidebar">
        <include(input.sidebar/>
      </aside>

      <!-- Main Content -->
      <main class="docs-main">
        <div class="docs-content">
          <include(input.content/>
        </div>

        <!-- Prev/Next Navigation -->
        <if(input.prev || input.next)>
          <nav class="docs-nav">
            <if(input.prev)>
              <a href=input.prev.link class="docs-nav-prev">
                <span class="nav-label">← Previous</span>
                <span class="nav-title">${input.prev.title}</span>
              </a>
            </if>

            <if(input.next)>
              <a href=input.next.link class="docs-nav-next">
                <span class="nav-label">Next →</span>
                <span class="nav-title">${input.next.title}</span>
              </a>
            </if>
          </nav>
        </if>
      </main>

      <!-- Table of Contents -->
      <aside class="docs-toc">
        <include(input.toc/>
      </aside>
    </div>
  </@body>
  <@footer>input.footer || <components.Footer/> </@footer>
</include>

<style>`
  .docs-layout {
    display: grid;
    grid-template-columns: 280px 1fr 200px;
    gap: 2rem;
    position: relative;
  }

  .docs-sidebar {
    position: sticky;
    top: 2rem;
    height: fit-content;
    max-height: calc(100vh - 4rem);
    overflow-y: auto;
  }

  .docs-main {
    min-width: 0; /* Prevent overflow */
  }

  .docs-toc {
    position: sticky;
    top: 2rem;
    height: fit-content;
  }

  .docs-nav {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 2px solid var(--border-color);
  }

  .docs-nav a {
    flex: 1;
    padding: 1rem;
    background: var(--bg-primary);
    border: 2px solid var(--border-color);
    border-radius: 8px;
    text-decoration: none;
    color: var(--text-primary);
    transition: all 0.2s;
  }

  .docs-nav a:hover {
    border-color: var(--accent-color);
    background: var(--bg-secondary);
  }

  @media (max-width: 1024px) {
    .docs-layout {
      grid-template-columns: 1fr;
    }

    .docs-sidebar,
    .docs-toc {
      display: none;
    }
  }
`</style>
```

### Blog Layout

```marko
<!-- .markopress/theme/layouts/blog.marko -->

<include('./layouts/default.marko')>
  <@header>input.header || <components.Header/> </@header>
  <@body>
    <article class="blog-post">
      <!-- Post Header -->
      <header class="post-header">
        <h1>${input.title}</h1>
        <div class="post-meta">
          <time datetime=input.date>${input.date}</time>
          <span class="post-author">by ${input.author}</span>
        </div>
        <if(input.tags)>
          <div class="post-tags">
            <for|tag| of=input.tags>
              <span class="tag">${tag}</span>
            </for>
          </div>
        </if>
      </header>

      <!-- Post Content -->
      <div class="post-content">
        <include(input.content/>
      </div>

      <!-- Share Buttons -->
      <div class="post-share">
        <button onClick=>shareToTwitter()>Share on Twitter</button>
        <button onClick=>copyLink()>Copy Link</button>
      </div>
    </article>
  </@body>
  <@footer>input.footer || <components.Footer/> </@footer>
</include>

<style>`
  .blog-post {
    max-width: 720px;
    margin: 0 auto;
  }

  .post-header {
    margin-bottom: 3rem;
  }

  .post-header h1 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }

  .post-meta {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .post-tags {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .tag {
    padding: 0.25rem 0.75rem;
    background: var(--bg-primary);
    border-radius: 12px;
    font-size: 0.875rem;
  }

  .post-share {
    display: flex;
    gap: 1rem;
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 2px solid var(--border-color);
  }
`</style>
```

## Custom Theme Development

Create a completely custom theme from scratch.

### Theme Structure

```bash
my-custom-theme/
├── package.json
├── src/
│   ├── components/
│   │   ├── Header.marko
│   │   ├── Footer.marko
│   │   └── Sidebar.marko
│   ├── layouts/
│   │   ├── default.marko
│   │   ├── docs.marko
│   │   └── blog.marko
│   └── styles/
│       ├── main.css
│       └── syntax.css
└── index.ts
```

### Package.json

```json
{
  "name": "@my-org/theme-custom",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": "./index.ts",
    "./components/*": "./src/components/*.marko",
    "./layouts/*": "./src/layouts/*.marko",
    "./styles/*": "./src/styles/*.css"
  },
  "marko": {
    "tags": "./src/components"
  }
}
```

### Theme Entry Point

```typescript
// index.ts
import type { Theme } from 'markopress';

export const theme: Theme = {
  name: '@my-org/theme-custom',

  // Default layout
  layout: './src/layouts/default.marko',

  // Components
  components: {
    Header: './src/components/Header.marko',
    Footer: './src/components/Footer.marko',
    Sidebar: './src/components/Sidebar.marko',
  },

  // Styles
  styles: [
    './src/styles/main.css',
  ],

  // Layout aliases
  layouts: {
    docs: './src/layouts/docs.marko',
    blog: './src/layouts/blog.marko',
  },
};
```

### Use Custom Theme

```typescript
// markopress.config.ts
import { defineConfig } from 'markopress';

export default defineConfig({
  theme: '@my-org/theme-custom',

  themeConfig: {
    // Your theme config
  },
});
```

## Advanced Customization

### Add Custom Components

Create reusable components in your theme:

```marko
<!-- .markopress/theme/components/Callout.marko -->

<div class="callout callout--${input.type || 'info'}">
  <div class="callout-icon">
    ${input.icon || 'ℹ️'}
  </div>
  <div class="callout-content">
    <if(input.title)>
      <strong>${input.title}</strong>
    </if>
    <p>${input.content}</p>
  </div>
</div>

<style>`
  .callout {
    display: flex;
    gap: 1rem;
    padding: 1.5rem;
    border-radius: 8px;
    margin: 1.5rem 0;
  }

  .callout--info {
    background: #e3f2fd;
    border-left: 4px solid #2196f3;
  }

  .callout--warning {
    background: #fff3e0;
    border-left: 4px solid #ff9800;
  }

  .callout--danger {
    background: #ffebee;
    border-left: 4px solid #f44336;
  }

  .callout-icon {
    font-size: 1.5rem;
  }
`</style>
```

Use in your markdown:

```marko
<components.Callout
  type="warning"
  title="Important"
  content="This is a warning callout"
/>
```

### Dynamic Styling

Use Marko's reactivity for dynamic styling:

```marko
<!-- .markopress/theme/components/ThemeSwitcher.marko -->

class {
  onCreate() {
    this.state = {
      theme: localStorage.getItem('theme') || 'light',
    };

    if (this.state.theme === 'dark') {
      document.body.classList.add('dark-mode');
    }
  }

  setTheme(theme) {
    this.state.theme = theme;
    localStorage.setItem('theme', theme);

    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }
}

<div class="theme-switcher">
  <button
    class=${['theme-btn', { active: state.theme === 'light' }]}
    onClick=>setTheme('light')
  >
    ☀️ Light
  </button>
  <button
    class=${['theme-btn', { active: state.theme === 'dark' }]}
    onClick=>setTheme('dark')
  >
    🌙 Dark
  </button>
</div>
```

## Theme Configuration

Configure theme behavior in `markopress.config.ts`:

```typescript
export default defineConfig({
  themeConfig: {
    // Site metadata
    name: 'My Site',
    description: 'My awesome site',

    // Navigation
    navbar: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/docs' },
      { text: 'Blog', link: '/blog' },
    ],

    // Sidebar
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
    },

    // Footer
    footer: {
      copyright: '© {year} My Site',
      links: [
        { text: 'Privacy', link: '/privacy' },
        { text: 'GitHub', link: 'https://github.com/user/repo' },
      ],
    },

    // Feature toggles
    features: {
      darkMode: true,
      editLink: true,
      lastUpdated: true,
      prevNext: true,
      sidebar: true,
    },
  },
});
```

## Best Practices

### 1. Use CSS Variables

Always prefer CSS variables over hard-coded values:

```css
/* ❌ Bad */
.button {
  background: #667eea;
}

/* ✅ Good */
.button {
  background: var(--accent-color);
}
```

### 2. Respect Dark Mode

Always define dark mode overrides:

```css
:root {
  --bg-primary: #f8f9fa;
}

.dark-mode {
  --bg-primary: #1a1a1a;
}
```

### 3. Responsive Design

Use mobile-first responsive design:

```css
.component {
  /* Mobile styles */
  padding: 1rem;
}

@media (min-width: 768px) {
  .component {
    /* Desktop styles */
    padding: 2rem;
  }
}
```

### 4. Accessibility

Ensure proper contrast and keyboard navigation:

```css
.button:focus {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

/* Skip to content */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--accent-color);
  color: white;
  padding: 8px;
  text-decoration: none;
}

.skip-link:focus {
  top: 0;
}
```

## Examples

### Minimal Theme

```css
:root {
  --bg-primary: white;
  --bg-secondary: #fafafa;
  --text-primary: #111;
  --accent-color: #000;
}
```

### Colorful Theme

```css
:root {
  --bg-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --accent-color: #764ba2;
}
```

### High Contrast Theme

```css
:root {
  --bg-primary: white;
  --text-primary: #000;
  --accent-color: #000;
  --border-color: #000;
}
```

## Next Steps

- 🔌 Learn about [Plugin Development](./plugins.md)
- 📖 Read [API Reference](./api.md)
- 🚀 Deploy your [Site](../docs/deployment.md)

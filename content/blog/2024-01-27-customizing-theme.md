---
title: "Customizing Your MarkoPress Theme"
description: "Make your site uniquely yours with custom themes, colors, and layouts"
date: 2024-01-27
author: "Emily Johnson"
tags: ["tutorial", "theme", "design", "css"]
categories: ["Tutorials"]
excerpt: "Master MarkoPress theming with CSS variables, component overrides, and custom layouts"
readingTime: "10 min"
---

# Customizing Your MarkoPress Theme

Make your MarkoPress site uniquely yours with custom themes. In this comprehensive guide, you'll learn how to customize colors, override components, and create stunning layouts without forking the entire theme.

## What You'll Learn

- ✅ CSS variable customization
- ✅ Component overrides
- ✅ Custom layouts
- ✅ Building a theme from scratch
- ✅ Dark mode customization
- ✅ Responsive design best practices

**Prerequisites:** Completed [Building a Static Site](/blog/2024-01-15-building-static-site) tutorial

## Understanding the Theme System

MarkoPress uses a **slot-based theme system** that lets you customize any part of your site:

```
.markopress/
└── theme/
    ├── components/      # Override components
    │   ├── Header.marko
    │   ├── Footer.marko
    │   └── Sidebar.marko
    ├── layouts/         # Override layouts
    │   ├── default.marko
    │   └── docs.marko
    └── styles.css       # Custom CSS variables
```

**No forking required** - Just override what you need!

## Step 1: Quick Color Customization

The fastest way to customize is through CSS variables.

### View Default Variables

The default theme uses these variables:

```css
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
```

### Create Custom Colors

Create `.markopress/theme/styles.css`:

```css
:root {
  /* Your Brand Colors */
  --bg-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --accent-color: #667eea;
  --accent-hover: #5568d3;
}
```

### Theme Presets

**Ocean Theme:**
```css
:root {
  --bg-gradient: linear-gradient(135deg, #0061ff 0%, #60efff 100%);
  --accent-color: #0061ff;
  --accent-hover: #0052cc;
}
```

**Sunset Theme:**
```css
:root {
  --bg-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  --accent-color: #f5576c;
  --accent-hover: #d64558;
}
```

**Forest Theme:**
```css
:root {
  --bg-gradient: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  --accent-color: #11998e;
  --accent-hover: #0e8076;
}
```

**Dark Theme:**
```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #1a1a1a;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --accent-color: #7c8ffc;
  --border-color: #333;
  --code-bg: #1e1e1e;
}
```

## Step 2: Dark Mode Customization

Customize dark mode separately.

### Dark Mode Variables

```css
:root {
  /* Light mode (default) */
  --bg-primary: #f8f9fa;
  --bg-secondary: white;
  --text-primary: #333;
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

### Test Dark Mode

Toggle dark mode using the button in the top-right corner, or press `Cmd/Ctrl + Shift + D`.

## Step 3: Override Components

Override any theme component by copying it to your project.

### Custom Header

Copy the Header component:

```bash
mkdir -p .markopress/theme/components
cp node_modules/@markopress/theme-default/src/components/Header.marko \
   .markopress/theme/components/
```

Edit `.markopress/theme/components/Header.marko`:

```marko
<header class="custom-header">
  <div class="header-container">
    <!-- Logo -->
    <a href="/" class="logo">
      <img src="/logo.svg" alt="My Site" />
    </a>

    <!-- Navigation -->
    <nav class="navbar">
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

    <!-- Search -->
    <div class="search-box">
      <input type="search" placeholder="Search..." />
    </div>
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

  .nav-links {
    display: flex;
    gap: 2rem;
    list-style: none;
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

  .search-box input {
    padding: 0.5rem 1rem;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  @media (max-width: 768px) {
    .header-container {
      flex-wrap: wrap;
    }

    .nav-links {
      display: none;
    }
  }
`</style>
```

### Custom Footer

Create `.markopress/theme/components/Footer.marko`:

```marko
<footer class="custom-footer">
  <div class="footer-container">
    <!-- Brand -->
    <div class="footer-brand">
      <h3>My Site</h3>
      <p>Built with MarkoPress</p>
    </div>

    <!-- Links -->
    <nav class="footer-links">
      <div class="link-column">
        <h4>Product</h4>
        <a href="/features">Features</a>
        <a href="/pricing">Pricing</a>
        <a href="/docs">Documentation</a>
      </div>
      <div class="link-column">
        <h4>Company</h4>
        <a href="/about">About</a>
        <a href="/blog">Blog</a>
        <a href="/careers">Careers</a>
      </div>
      <div class="link-column">
        <h4>Legal</h4>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </div>
    </nav>

    <!-- Social -->
    <div class="footer-social">
      <a href="https://twitter.com/user" aria-label="Twitter">
        <svg><!-- Twitter icon --></svg>
      </a>
      <a href="https://github.com/user" aria-label="GitHub">
        <svg><!-- GitHub icon --></svg>
      </a>
    </div>
  </div>

  <div class="footer-bottom">
    <p>${input.copyright || '© {year} My Site'}</p>
  </div>
</footer>

<style>`
  .custom-footer {
    background: var(--bg-secondary);
    padding: 3rem 2rem 1rem;
    margin-top: 4rem;
    border-radius: 12px;
  }

  .footer-container {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 2fr 3fr 1fr;
    gap: 3rem;
  }

  .footer-brand h3 {
    margin-bottom: 0.5rem;
  }

  .footer-links {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
  }

  .link-column h4 {
    margin-bottom: 1rem;
  }

  .link-column a {
    display: block;
    color: var(--text-secondary);
    text-decoration: none;
    margin-bottom: 0.5rem;
  }

  .link-column a:hover {
    color: var(--accent-color);
  }

  .footer-social {
    display: flex;
    gap: 1rem;
  }

  .footer-bottom {
    max-width: 1200px;
    margin: 2rem auto 0;
    padding-top: 2rem;
    border-top: 1px solid var(--border-color);
    text-align: center;
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .footer-container {
      grid-template-columns: 1fr;
    }

    .footer-links {
      grid-template-columns: 1fr;
    }
  }
`</style>
```

## Step 4: Custom Layouts

Create custom layouts for different page types.

### Documentation Layout

Create `.markopress/theme/layouts/docs.marko`:

```marko
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
        <include(input.content/>

        <!-- Prev/Next Navigation -->
        <if(input.prev || input.next)>
          <nav class="docs-nav">
            <if(input.prev)>
              <a href=input.prev.link class="nav-prev">
                ← ${input.prev.title}
              </a>
            </if>
            <if(input.next)>
              <a href=input.next.link class="nav-next">
                ${input.next.title} →
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

## Step 5: Typography

Customize fonts and typography.

### Add Custom Fonts

```css
/* .markopress/theme/styles.css */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-heading: 'Inter', sans-serif;
  --font-mono: 'SF Mono', Monaco, 'Courier New', monospace;
}

body {
  font-family: var(--font-family);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  font-weight: 600;
}

code, pre {
  font-family: var(--font-mono);
}
```

### Typography Scale

```css
:root {
  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg: 1.125rem;   /* 18px */
  --font-size-xl: 1.25rem;    /* 20px */
  --font-size-2xl: 1.5rem;    /* 24px */
  --font-size-3xl: 1.875rem;  /* 30px */
  --font-size-4xl: 2.25rem;   /* 36px */
}

h1 { font-size: var(--font-size-4xl); }
h2 { font-size: var(--font-size-3xl); }
h3 { font-size: var(--font-size-2xl); }
h4 { font-size: var(--font-size-xl); }
h5 { font-size: var(--font-size-lg); }
h6 { font-size: var(--font-size-base); }
```

## Step 6: Responsive Design

Make your theme work on all devices.

### Mobile-First Approach

```css
/* Base styles (mobile) */
.component {
  padding: 1rem;
  font-size: 1rem;
}

/* Tablet */
@media (min-width: 768px) {
  .component {
    padding: 1.5rem;
    font-size: 1.125rem;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .component {
    padding: 2rem;
    font-size: 1.25rem;
  }
}
```

### Grid Layouts

```css
.container {
  display: grid;
  grid-template-columns: 1fr; /* Mobile: 1 column */
  gap: 1rem;
}

@media (min-width: 768px) {
  .container {
    grid-template-columns: repeat(2, 1fr); /* Tablet: 2 columns */
  }
}

@media (min-width: 1024px) {
  .container {
    grid-template-columns: repeat(3, 1fr); /* Desktop: 3 columns */
  }
}
```

## Step 7: Animations

Add smooth animations and transitions.

### Transition Utilities

```css
:root {
  --transition-fast: 150ms ease;
  --transition-base: 300ms ease;
  --transition-slow: 500ms ease;
}

.button {
  transition: all var(--transition-base);
}

.button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

### Fade In Animation

```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  animation: fadeIn var(--transition-base);
}
```

## Step 8: Build a Complete Theme

Create a custom theme from scratch.

### Theme Structure

```
my-custom-theme/
├── package.json
├── src/
│   ├── components/
│   │   ├── Header.marko
│   │   └── Footer.marko
│   ├── layouts/
│   │   └── default.marko
│   └── styles.css
└── index.ts
```

### Package.json

```json
{
  "name": "@username/theme-custom",
  "version": "1.0.0",
  "main": "index.ts",
  "peerDependencies": {
    "markopress": "^1.0.0"
  }
}
```

### Theme Entry Point

```typescript
// index.ts
import type { Theme } from 'markopress';

export const theme: Theme = {
  name: '@username/theme-custom',
  layout: './src/layouts/default.marko',
  components: {
    Header: './src/components/Header.marko',
    Footer: './src/components/Footer.marko',
  },
  styles: ['./src/styles.css'],
};
```

### Use Your Theme

```typescript
// markopress.config.ts
export default defineConfig({
  theme: '@username/theme-custom',
});
```

## Best Practices

### 1. Use CSS Variables

Always prefer variables over hard-coded values:

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

### 3. Ensure Accessibility

Maintain proper contrast ratios:

```css
:root {
  /* WCAG AA compliant */
  --text-primary: #333;      /* 12.6:1 contrast on white */
  --accent-color: #667eea;   /* 4.5:1 contrast on white */
}
```

### 4. Optimize Performance

Use efficient selectors:

```css
/* ❌ Bad: Expensive */
div > ul > li > a { }

/* ✅ Good: Efficient */
.nav-link { }
```

## Inspiration

Need ideas? Check out these themes:

- **Minimal** - Clean typography, lots of whitespace
- **Bold** - Large gradients, strong colors
- **Technical** - Monospace fonts, code-focused
- **Playful** - Bright colors, rounded corners
- **Elegant** - Serif fonts, subtle animations

## Next Steps

Now that you've mastered theming:

- 🎨 Create custom [components](/docs/interactive-components)
- 🔌 Build theme [plugins](/docs/plugins)
- 📖 Read full [theme documentation](/docs/theming)
- 🚀 [Deploy](/docs/deployment) your custom site

---

*Share your custom theme with us on [Twitter](https://twitter.com/markopress) with #MyMarkoPressTheme!*

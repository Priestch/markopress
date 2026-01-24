---
title: Features Demo
description: Explore all the powerful features MarkoPress has to offer
---

# Features Demo

Welcome to the MarkoPress features showcase! This page demonstrates all the powerful features available in MarkoPress.

## 🎯 Core Features

### 1. **Plugin System**

MarkoPress has a powerful plugin system that allows you to extend functionality:

- ✅ **Blog Index Plugin** - Automatically generates blog listing pages
- ✅ **Sidenav Plugin** - Auto-generates sidebar navigation from content structure
- ✅ **TOC Plugin** - Creates table of contents from markdown headers
- 🚧 **Search Plugin** - Coming soon
- 🚧 **RSS Feeds Plugin** - Coming soon

### 2. **Content Modules**

Organize your content into logical modules:
- **Pages** - General pages like Home, About, Contact
- **Docs** - Documentation with sidebar navigation
- **Blog** - Blog posts with date-based ordering

### 3. **EnhanceModules Architecture**

Plugins can enhance content modules with metadata:

```javascript
// Plugins add enhancements like this:
blogModule.enhance('blogPosts', sortedPosts);
blogModule.enhance('blogConfig', config);
```

## 📝 Markdown Features

### Syntax Highlighting

```javascript
// Your code is beautifully highlighted
function greet(name) {
  return `Hello, ${name}!`;
}
```

### Custom Containers

::: tip
Pro tip: Use the enhanceModules hook to add custom metadata to your content!
:::

::: warning
Warning: Make sure your plugins are compatible with your content structure.
:::

::: danger
Important: Always test your plugins in development before deploying to production.
:::

### Tables

| Feature | Status | Description |
|---------|--------|-------------|
| Blog Index | ✅ Done | Generates /blog route with all posts |
| Sidenav | ✅ Done | Auto-generates from docs structure |
| TOC | ✅ Done | Extracts from markdown headers |
| Search | 🚧 Planned | Full-text search capability |
| RSS | 🚧 Planned | Feed generation for blogs |

### Task Lists

- [x] Implement enhanceModules architecture
- [x] Create Blog Index plugin
- [x] Create Sidenav plugin
- [x] Create TOC plugin
- [ ] Implement Search plugin
- [ ] Implement RSS Feeds plugin

## 🎨 Theming System

MarkoPress includes a flexible theming system with:

- **Slot-based overrides** - Override any theme component
- **Design system** - Built-in design tokens for easy customization
- **CSS Variables** - Full control over colors, spacing, typography
- **Dark mode** - Automatic dark mode support

### Available Slots

```marko
<theme-head-top/>     <!-- Before closing </head> -->
<theme-head-bottom/>  <!-- After <head> opens -->
<theme-body-top/>     <!-- After <body> opens -->
<theme-body-bottom/>  <!-- Before closing </body> -->
<theme-navbar-start/> <!-- Start of navbar -->
<theme-navbar-center/><!-- Center of navbar -->
<theme-navbar-end/>   <!-- End of navbar -->
<!-- ... and many more! -->
```

## 🚀 Performance

- **Static Site Generation** - Blazing fast static HTML
- **Automatic Optimization** - Optimized builds by default
- **Lazy Loading** - Components load only when needed
- **Tree Shaking** - Unused code is eliminated

## 📦 What's Next?

Check out these links to see the features in action:

- **[Blog Index](/blog)** - See the auto-generated blog listing
- **[Documentation](/guides/getting-started)** - Explore docs with sidebar and TOC
- **[Plugins Guide](/guides/plugins)** - Learn how to create your own plugins

---

*This demo page showcases the power and flexibility of MarkoPress. Built with ❤️ using Marko.js v6*

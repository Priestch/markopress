---
title: "Marko Tags Example"
description: "A minimal example demonstrating Marko components in Markdown"
---

# Welcome to Marko Tags! 👋

This is a minimal example demonstrating how to use Marko components directly in your Markdown files.

## What are Marko Tags?

Marko Tags allows you to create reusable Marko components and use them in Markdown content. Combine the simplicity of Markdown with the power of Marko components!

## Quick Example

<hello-world name="MarkoPress">
  This is a **simple example** of using Marko components in Markdown.
</hello-world>

## Try the Variants

<hello-world name="Developer" variant="info">
  Perfect for highlighting **important information** with `code` examples!
</hello-world>

<hello-world name="Success" variant="success">
  Great for showing **successful** outcomes and positive feedback!
</hello-world>

<hello-world name="Creative" variant="warm">
  Use different styles to match your **content's mood** and purpose!
</hello-world>

## How It Works

1. **Create a component** in the `tags/` directory (see `tags/hello-world.marko`)
2. **Use it in Markdown** with kebab-case tag names
3. **Enable the feature** in `markopress.config.js`

## Key Features

- ✅ **Reusable components** - Create once, use everywhere
- ✅ **Markdown content** - Full markdown support inside components
- ✅ **Dynamic attributes** - Pass data to your components
- ✅ **Inline styles** - Each component can have its own styling
- ✅ **Build-time validation** - Get errors for missing components

## Learn More

Check out the [main documentation](../../docs/guides/marko-tags.md) for:

- Complete component library reference
- Marko.js v6 syntax guide
- Common patterns and best practices
- Troubleshooting tips

Happy coding! 🚀

# Marko Tags Example

A minimal working example demonstrating the Marko Tags in Markdown feature.

## What This Demonstrates

- **Simple component creation** - `tags/hello-world.marko`
- **Usage in Markdown** - `content/pages/index.md`
- **Configuration** - `markopress.config.js`
- **Inline styles** - Scoped CSS per component
- **Dynamic attributes** - `name` and `variant` props
- **Markdown content** - Full markdown support inside components

## Quick Start

### 1. Install Dependencies

```bash
cd examples/marko-tags
pnpm install
```

### 2. Start Development Server

```bash
npx markopress dev
```

Visit `http://localhost:3000` to see the example.

### 3. Build for Production

```bash
npx markopress build
```

Output will be in the `dist/` directory.

## Project Structure

```
marko-tags-example/
├── markopress.config.js    # Marko Tags configuration
├── tags/
│   └── hello-world.marko   # Example component
├── content/
│   └── pages/
│       └── index.md        # Example usage
└── README.md               # This file
```

## Component Example

**File:** `tags/hello-world.marko`

```marko
<div class=["hello-world", input.variant && "hello-" + input.variant]>
  <div class="hello-content">
    <h2>Hello, ${input.name || 'World'}!</h2>
    <${input.content}/>
  </div>
</div>

<style>
  .hello-world {
    padding: 2rem;
    border-radius: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
</style>
```

## Usage in Markdown

**File:** `content/pages/index.md`

```markdown
---
title: "Welcome"
---

# Welcome!

<hello-world name="MarkoPress">
  This is **markdown** content inside a component!
</hello-world>
```

## Configuration

**File:** `markopress.config.js`

```javascript
export default {
  site: {
    title: 'Marko Tags Example',
  },

  markdown: {
    markoTags: {
      enabled: true,      // Enable the feature
      tagsDir: 'tags/',   // Component directory
    },
  },
};
```

## Key Patterns Demonstrated

### 1. Component Naming
- ✅ **Kebab-case:** `<hello-world>` (required)
- ❌ **Not:** `<HelloWorld>` or `<helloWorld>`

### 2. Dynamic Classes
```marko
<div class=["base-class", input.variant && "base-" + input.variant]>
```
Uses array syntax, NOT template literals.

### 3. Body Content
```marko
<${input.content}/>  <!-- Renders markdown content -->
```
Use `<${input.content}/>`, NOT `<input.text/>`.

### 4. Inline Styles
```marko
<style>
  .hello-world { /* styles */ }
</style>
```
Styles are scoped to the component.

### 5. Default Values
```marko
${input.name || 'World'}  <!-- Falls back to 'World' -->
```

## Next Steps

1. **Modify the component** - Edit `tags/hello-world.marko`
2. **Create new components** - Add files to `tags/`
3. **Add more pages** - Create `.md` files in `content/pages/`
4. **Read the docs** - See [Marko Tags Guide](../../docs/guides/marko-tags.md)

## Common Issues

### Component Not Rendering?

**Check:**
1. `markopress.config.js` has `markoTags.enabled: true`
2. Component file exists in `tags/` directory
3. Tag name is kebab-case: `<hello-world>`
4. Rebuild after component changes

### Build Errors?

**Common errors:**
- `Component 'hello-world' used but file doesn't exist` → Create `tags/hello-world.marko`
- `Syntax error in component` → Check Marko v6 syntax

## See Also

- [Marko Tags Feature Guide](../../docs/guides/marko-tags.md) - Complete feature overview
- [Component API Reference](../../docs/guides/marko-components.md) - Component library
- [Marko.js v6 Syntax](../../docs/guides/marko-v6-syntax.md) - Syntax reference
- [Example Components](../../packages/markopress/templates/example-tags/) - More examples

---

**Last Updated:** 2025-01-17
**Status:** ✅ Working Example

# Marko Tags in Markdown

Use Marko components directly in your Markdown files with kebab-case custom tags.

## Overview

Marko Tags allows you to create reusable Marko components and use them in Markdown content files. This bridges the gap between static Markdown content and dynamic Marko components.

**Example:**
```markdown
<alert-box kind="warning">
  This is a **warning** alert with `code` support!
</alert-box>
```

## Features

- ✅ **Kebab-case components**: `<my-component>`, `<alert-box>`, `<user-card>`
- ✅ **Self-closing tags**: `<icon name="check" />`
- ✅ **Nested components**: `<card><card-header>...</card-header></card>`
- ✅ **All attribute types**: String, dynamic, boolean
- ✅ **Markdown content**: Full markdown support inside components
- ✅ **Build-time validation**: Checks if components exist
- ✅ **Named slots**: Multiple content areas per component

## Quick Start

### 1. Enable the Feature

Add to your `markopress.config.ts`:

```typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  markdown: {
    markoTags: {
      enabled: true,
      tagsDir: 'tags/',
    },
  },
});
```

### 2. Create a Component

Create `tags/alert-box.marko`:

```marko
<div class=["alert", input.kind && "alert-" + input.kind]>
  <${input.content}/>
</div>

<style>
  .alert { padding: 1rem; border-radius: 8px; }
  .alert-warning { background: #fff3cd; border: 1px solid #ffc107; }
</style>
```

### 3. Use in Markdown

In any markdown file:

```markdown
# My Document

<alert-box kind="warning">
  This is a **warning** alert!
</alert-box>

More content here.
```

## Component Syntax

### Tag Names

- ✅ **Kebab-case only**: `<my-component>`, `<alert-box>`, `<user-profile-card>`
- ❌ **No PascalCase**: `<MyComponent>` won't be detected
- ❌ **No camelCase**: `<myButton>` won't be detected
- ❌ **No HTML5 conflicts**: `<button>`, `<input>` reserved

### Attributes

**String attributes:**
```marko
<alert-box kind="warning">
```

**Dynamic attributes (unquoted):**
```marko
<button-primary href=input.link>
```

**Boolean attributes:**
```marko
<button-primary disabled>
```

**Multiple attributes:**
```marko
<button-primary href="/docs" disabled icon="📚">
```

### Body Content

Use `<${input.content}/>` to render content between tags:

```marko
<div class="alert">
  <${input.content}/>  <!-- Renders markdown content -->
</div>
```

### Dynamic Classes

Use array syntax (NOT template literals):

```marko
<!-- ✅ CORRECT -->
<div class=["alert", "alert-" + input.kind]>

<!-- ❌ WRONG - Template literals not supported -->
<div class="alert alert-${input.kind}">
```

### Conditionals

Use `<if=condition>` syntax (NOT `<if(condition)>`):

```marko
<!-- ✅ CORRECT -->
<if=input.kind>
  <div class="alert-${input.kind}">
    <${input.content}/>
  </div>
</if>

<!-- ❌ WRONG - Old Marko v5 syntax -->
<if(input.kind)>
  content
</if>
```

## Common Patterns

### Alert Boxes

```marko
<alert-box kind="note">
  This is a note with **markdown** support!
</alert-box>

<alert-box kind="warning">
  Warning: `code` works too!
</alert-box>

<alert-box kind="danger">
  **Danger:** Critical information
</alert-box>
```

### Buttons

```marko
<button-primary href="/docs" icon="📚">
  Documentation
</button-primary>

<button-secondary href="/blog">
  Blog
</button-secondary>
```

### Cards with Slots

```marko
<card>
  <card-header>
    <h3>Card Title</h3>
  </card-header>
  <card-body>
    - List item 1
    - List item 2
  </card-body>
  <card-footer>
    <button-primary href="/learn">Learn More</button-primary>
  </card-footer>
</card>
```

### Icons

```marko
<icon name="check" size="24" color="success" />
<icon name="warning" size="32" color="warning" />
<icon name="x-circle" size="24" color="danger" />
```

## Reserved HTML Attributes

These are reserved by HTML5 spec and **cannot** be used as custom attributes:

❌ **Don't use:** `type`, `id`, `class`, `style`, `name`, `value`, `for`

✅ **Use instead:**
- `kind`, `variant`, `category` instead of `type`
- `uid`, `itemId` instead of `id`
- `css`, `styles` instead of `style`

## Validation

Build-time validation ensures all used components exist:

```bash
$ markopress build

❌ Error: Component 'alert-boxx' used in content/pages/index.md:15
   but 'tags/alert-boxx.marko' does not exist.
```

## Examples

See the examples directory for complete working examples:

- **Basic usage**: `examples/marko-tags/`
- **Component library**: `packages/markopress/templates/example-tags/`

## Troubleshooting

### Component Not Rendering

**Problem:** Component shows as literal text `<alert-box>content</alert-box>`

**Solutions:**
1. Check `markopress.config.ts` has `markoTags.enabled: true`
2. Verify `tags/` directory is in project root
3. Ensure component file exists: `tags/alert-box.marko`
4. Check tag name is kebab-case: `<alert-box>`, not `<AlertBox>`

### Attribute Not Working

**Problem:** Dynamic attribute shows as literal string `input.link`

**Solution:** Use unquoted syntax for dynamic values:
```marko
<!-- ✅ CORRECT -->
<button-primary href=input.link>

<!-- ❌ WRONG -->
<button-primary href="input.link">
```

### Content Not Showing

**Problem:** Component renders but no content inside

**Solution:** Use `<${input.content}/>` in your component:
```marko
<div class="alert">
  <${input.content}/>  <!-- This renders the content -->
</div>
```

## Limitations

- **No hot-reload**: Must rebuild after changing component files
- **No escaping**: Can't show literal component syntax in markdown (use code blocks)
- **Kebab-case only**: PascalCase and camelCase not supported
- **Reserved attributes**: Can't use HTML5 reserved attributes

## Related Documentation

- **[Component Support Analysis](./marko-components-support.md)** - Detailed feature coverage
- **[Marko Components Guide](./marko-components.md)** - Component API reference
- **[Marko.js v6 Syntax Guide](./marko-v6-syntax.md)** - Complete syntax reference
- **[Lessons Learned](../development/marko-tags-lessons.md)** - Common mistakes to avoid

## Status

✅ **Production Ready**

Core implementation complete with ~85% coverage of typical use cases.

---

**Last Updated:** 2025-01-17
**Implementation:** `packages/markopress/src/markdown/preserve-tags.ts`

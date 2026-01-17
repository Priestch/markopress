# Marko Tags Example Components

This directory contains example Marko components demonstrating best practices for the Marko Tags in Markdown feature.

## Available Components

### Alert Boxes

**File:** `alert-box.marko`

A styled alert component with 6 variants: note, tip, warning, danger, info, caution

**Usage:**
```markdown
<alert-box kind="warning">
  This is a **warning** alert with `code` support!
</alert-box>
```

**Features:**
- Emoji icons for each variant
- Left icon bar
- Gradient overlay
- Proper markdown content rendering
- Responsive styling

### Buttons

**Files:** `button-primary.marko`, `button-secondary.marko`, `button.marko`

Styled button components with icon support.

**Usage:**
```markdown
<button-primary href="/docs" icon="📚">
  Documentation
</button-primary>

<button-secondary href="/blog">
  Blog
</button-secondary>
```

**Features:**
- Primary and secondary styles
- Optional icon attribute (emoji)
- Dynamic href binding
- Proper body content rendering

### Cards

**Files:** `card.marko`, `card-header.marko`, `card-body.marko`, `card-footer.marko`

Card components with named slots for flexible content layout.

**Usage:**
```markdown
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

**Features:**
- Named slots (header, body, footer)
- Nested component support
- Flexible content layout

### Icons

**File:** `icon.marko`

SVG icon component with customizable size and color.

**Usage:**
```markdown
<icon name="check" size="24" color="success" />
<icon name="warning" size="32" color="warning" />
```

**Available Icons:**
- **Actions:** check, x-circle, plus, minus
- **Navigation:** arrow-right, arrow-left, arrow-up, arrow-down
- **Status:** info, warning, danger, success, error
- **Social:** star, heart, bookmark
- **And more...** (18+ icons included)

**Features:**
- 18+ built-in SVG icons
- Customizable size
- Color variants (success, warning, danger, info, default)
- Self-closing syntax

## Component Patterns

These examples demonstrate key Marko Tags patterns:

### 1. Body Content Rendering
```marko
<div class="my-component">
  <${input.content}/>  <!-- Renders markdown content -->
</div>
```

### 2. Dynamic Classes (Array Syntax)
```marko
<div class=["base-class", input.variant && "base-" + input.variant]>
```

### 3. Conditional Attributes
```marko
<div class=["alert", input.kind && "alert-" + input.kind, !input.kind && "alert-note"]>
```

### 4. Named Slots
```marko
<!-- Parent component -->
<div class="card">
  <${input@header}/>  <!-- Renders header slot -->
  <${input@body/>     <!-- Renders body slot -->
  <${input@footer}/>  <!-- Renders footer slot -->
</div>
```

### 5. Self-Closing Components
```marko
<icon name="check" size="24" />
```

### 6. Inline Styles
```marko
<style>
  .my-component {
    padding: 1rem;
    border-radius: 8px;
  }
</style>
```

## Best Practices

1. **Use kebab-case tag names:** `<my-component>`, not `<MyComponent>`
2. **Avoid reserved HTML attributes:** Use `kind` instead of `type`, `uid` instead of `id`
3. **Use array syntax for dynamic classes:** `class=["base", modifier]`
4. **Use `<${input.content}/>` for body content:** Not `<input.text/>`
5. **Use unquoted attributes for dynamic values:** `href=input.link`, not `href="input.link"`
6. **Include inline styles:** Components should be self-contained with styling

## Copying to Your Project

To use these components in your project:

1. **Create a `tags/` directory** in your project root
2. **Copy components** from this directory to `tags/`
3. **Enable Marko Tags** in your config:

```typescript
// markopress.config.ts
export default defineConfig({
  markdown: {
    markoTags: {
      enabled: true,
      tagsDir: 'tags/',
    },
  },
});
```

4. **Use in Markdown:**

```markdown
<alert-box kind="tip">
  Check out the **documentation** for more info!
</alert-box>
```

## Customization

These are examples - feel free to:

- Modify styles to match your design system
- Add new variants (e.g., `<alert-box kind="custom">`)
- Create new components based on these patterns
- Extend icon component with more SVG icons

## Technical Notes

- **Marko Version:** v6 syntax
- **Markdown Support:** Full markdown rendering inside components
- **CSS:** Inline styles per component (scoped)
- **Build-time Validation:** Missing components trigger build errors
- **Performance:** Components compiled at build time

## See Also

- [Marko Tags Guide](../../../docs/guides/marko-tags.md) - Feature overview
- [Component API Reference](../../../docs/guides/marko-components.md) - Detailed API docs
- [Marko.js v6 Syntax](../../../docs/guides/marko-v6-syntax.md) - Syntax reference
- [Lessons Learned](../../../docs/development/marko-tags-lessons.md) - Common mistakes to avoid

---

**Last Updated:** 2025-01-17
**Status:** ✅ Production Ready

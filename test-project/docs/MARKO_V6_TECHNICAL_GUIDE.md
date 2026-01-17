# Marko.js v6 Technical Guide

Essential syntax, patterns, and common pitfalls for working with Marko.js v6 components.

## 📋 Table of Contents

- [Component Syntax](#component-syntax)
- [Body Content](#body-content)
- [Attributes](#attributes)
- [Conditionals](#conditionals)
- [Common Pitfalls](#common-pitfalls)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Component Syntax

### ✅ Correct Syntax

#### 1. Kebab-case Component Names
```marko
<!-- ✅ CORRECT: kebab-case -->
<my-component></my-component>
<user-card></user-card>
<alert-box></alert-box>

<!-- ❌ WRONG: PascalCase or camelCase -->
<MyComponent></MyComponent>
<myButton></myButton>
```

#### 2. Self-closing Tags
```marko
<!-- ✅ CORRECT: space before slash -->
<icon name="check" />
<alert-box kind="tip" />

<!-- ❌ WRONG: no space -->
<icon name="check"/>
<alert-box kind="tip"/>
```

#### 3. Attribute Values
```marko
<!-- ✅ CORRECT: unquoted for dynamic values -->
<a href=input.link>Link</a>
<div class=["active", input.isCurrent && "current"]></div>

<!-- ✅ CORRECT: quoted for static values -->
<a href="/about">About</a>
<div class="container">Content</div>

<!-- ❌ WRONG: quoted dynamic values -->
<a href="${input.link}">Link</a>
<div class="${input.class}">Content</div>
```

---

## Body Content

### ✅ Rendering Body Content

To render the content between opening and closing tags:

```marko
<!-- ✅ CORRECT: Use input.content -->
<div class="my-component">
  <${input.content}/>
</div>

<!-- Usage in markdown -->
<my-component>
  This is the body content
</my-component>
```

### ❌ Common Mistakes

```marko
<!-- ❌ WRONG: Renders as <input class=text> HTML element -->
<div><input.text/></div>

<!-- ❌ WRONG: Renders as <input> HTML element -->
<div><input/></div>

<!-- ❌ WRONG: Renders as literal <body> tag -->
<div><body/></div>

<!-- ❌ WRONG: Expects input.renderBody which doesn't exist -->
<div><${input.renderBody}/></div>
```

### Named Slots

For components with multiple content areas:

```marko
<!-- Component: card.marko -->
<div class="card">
  <if=input.header>
    <div class="card-header">
      <input.header/>
    </div>
  </if>
  <if=input.body>
    <div class="card-body">
      <input.body/>
    </div>
  </if>
  <if=input.footer>
    <div class="card-footer">
      <input.footer/>
    </div>
  </if>
</div>

<!-- Usage -->
<card>
  <card-header><h3>Title</h3></card-header>
  <card-body>Content here</card-body>
  <card-footer>Footer info</card-footer>
</card>
```

---

## Attributes

### ✅ Dynamic Attributes

#### 1. Array Syntax for Classes
```marko
<!-- ✅ CORRECT -->
<div class=["alert", input.kind && "alert-" + input.kind, !input.kind && "alert-default"]>
  Content
</div>

<!-- Results: -->
<!-- kind="note" → class="alert alert-note" -->
<!-- kind="tip" → class="alert alert-tip" -->
<!-- kind undefined → class="alert alert-default" -->
```

#### 2. Fallback Values
```marko
<!-- ✅ CORRECT: || operator -->
<a href=input.link || "#">Link</a>

<!-- ✅ CORRECT: inline ternary -->
<div class=input.type ? "type-" + input.type : "type-default">
  Content
</div>
```

### ❌ Reserved HTML Attributes

**AVOID** these attribute names as they're reserved in HTML:

```marko
<!-- ❌ WRONG: type is reserved (used by input, button, etc.) -->
<alert-box type="note">Content</alert-box>

<!-- ✅ CORRECT: Use kind or variant instead -->
<alert-box kind="note">Content</alert-box>
<alert-box variant="note">Content</alert-box>
```

**Other reserved names to avoid:**
- `id` - Use `uid`, `itemId`, etc.
- `class` - Use `className` (but class is OK if using array syntax)
- `style` - Use `css` or `styles`
- `name` - Use `kind`, `variant`, etc.
- `value` - Use `defaultValue`, `content`, etc.
- `for` - Use `htmlFor` (label context)

---

## Conditionals

### ✅ If Statement

```marko
<!-- ✅ CORRECT: no parentheses around expression -->
<if=input.isVisible>
  <div>This is visible</div>
</if>

<!-- ✅ CORRECT: with else -->
<if=input.type === "primary">
  <button-primary>Click</button-primary>
<else/>
  <button-secondary>Click</button-secondary>
</if>

<!-- ❌ WRONG: parentheses around expression -->
<if(input.isVisible)>
  <div>This is visible</div>
</if>

<!-- ❌ WRONG: if() syntax -->
<if(input.isVisible)>
  <div>This is visible</div>
</if>
```

### ✅ For Loops

```marko
<!-- ✅ CORRECT: pipe syntax -->
<for|item| of=input.items>
  <div>${item.name}</div>
</for>

<!-- ✅ CORRECT: with index -->
<for|item, index| of=input.items>
  <div>${index + 1}. ${item.name}</div>
</for>

<!-- ✅ CORRECT: range -->
<for|i| from=0 to=10>
  <div>Item ${i}</div>
</for>
```

---

## Common Pitfalls

### 1. Template Literals in Attributes

```marko
<!-- ❌ WRONG: Not supported in Marko v6 -->
<div class="alert alert-${input.type}">
  Content
</div>

<!-- ✅ CORRECT: Use array syntax -->
<div class=["alert", "alert-" + input.type]>
  Content
</div>

<!-- ✅ CORRECT: Use ternary -->
<div class=input.type ? "alert alert-" + input.type : "alert">
  Content
</div>
```

### 2. Attribute Binding

```marko
<!-- ❌ WRONG: Quoted dynamic values -->
<div class="${input.className}">Content</div>

<!-- ✅ CORRECT: Unquoted for dynamic -->
<div class=input.className>Content</div>

<!-- ✅ CORRECT: Array for classes -->
<div class=["base-class", input.className]>Content</div>
```

### 3. Text Content

```marko
<!-- ✅ CORRECT: Direct text -->
<div>Hello ${input.name}</div>

<!-- ❌ WRONG: Using <input.text/> for body content -->
<div><input.text/></div>

<!-- ✅ CORRECT: For body content between tags -->
<div><${input.content}/></div>
```

### 4. Component Discovery

**Problem:** Components in `tags/` directory not rendering

**Solution:**
1. Ensure tags are copied to build output
2. Use kebab-case filenames: `alert-box.marko` ✅, `AlertBox.marko` ❌
3. Rebuild after adding new components

---

## Best Practices

### 1. Component Structure

```marko
<!-- ✅ GOOD: Clear, documented component -->
<!--
  Alert Box Component

  Types: note, tip, warning, danger, info, caution
  Example: <alert-box kind="warning">Important!</alert-box>
-->
<div class=["alert", input.kind && "alert-" + input.kind, !input.kind && "alert-note"]>
  <${input.content}/>
</div>
```

### 2. Attribute Naming

```marko
<!-- ✅ GOOD: Descriptive, non-conflicting names -->
<my-component
  kind="primary"       <!-- NOT type -->
  variant="large"      <!-- NOT size -->
  isDisabled=true      <!-- NOT disabled -->
  onItemClick=handleClick  <!-- NOT onClick -->
>
  Content
</my-component>
```

### 3. Default Values

```marko
<!-- ✅ GOOD: Provide sensible defaults -->
<div class=["base-class", input.modifier && "base-" + input.modifier]>
  <${input.content}/>
</div>

<a href=input.link || "#">
  <input.text/>
</a>
```

### 4. Conditional Rendering

```marko
<!-- ✅ GOOD: Simple conditionals -->
<if=input.showHeader>
  <div class="header">
    <input.header/>
  </div>
</if>

<!-- ✅ GOOD: Multiple conditions -->
<div class=[
  "alert",
  input.kind === "error" && "alert-error",
  input.kind === "warning" && "alert-warning",
  !input.kind && "alert-default"
]>
  <${input.content}/>
</div>
```

---

## Troubleshooting

### Problem: Component Shows Raw Template Syntax

**Symptom:**
```html
<div class="alert alert-${input.type || 'note'}"><input class=text></div>
```

**Causes:**
1. Template literal used in attribute → Use array syntax
2. Tags directory not copied to dist → Ensure build copies tags
3. Component not discovered → Rebuild project

### Problem: Body Content Not Rendering

**Symptom:**
```html
<div class="alert"></div>
<!-- Content is missing -->
```

**Causes:**
1. Using `<input.text/>` → Use `<${input.content}/>`
2. Using `<input/>` → Use `<${input.content}/>`
3. Using `<body/>` → Use `<${input.content}/>`
4. Attribute name mismatch → Check component expects `input.content`

### Problem: Attributes Not Being Passed

**Symptom:**
```html
<!-- All components have default values -->
<div class="alert alert-note"></div>
<div class="alert alert-note"></div>
```

**Causes:**
1. Using reserved attribute name (e.g., `type`) → Use `kind`, `variant`, etc.
2. Attribute value not being passed → Check compiled output for function call
3. Component needs rebuild → Delete `dist/` and rebuild

### Problem: Build Errors

**Common errors:**
```
Tag does not support arguments. <if(expression)>
```

**Solution:** Change to `<if=expression>` (no parentheses)

```
Missing semicolon
```

**Solution:** Remove script blocks or fix syntax (Marko v6 has limited script support)

---

## Quick Reference

### Component Template

```marko
<!--
  Component Name

  Description of what it does

  Attributes:
    - kind: Component variant (required)
    - size: Size variant (optional, default: "medium")

  Example: <my-component kind="primary">Content</my-component>
-->

<div class=[
  "my-component",
  input.kind && "my-component-" + input.kind,
  input.size && "my-component-" + input.size
]>
  <${input.content}/>
</div>
```

### Debugging Checklist

1. ✅ Component name is kebab-case
2. ✅ File is in `tags/` directory
3. ✅ Using `<${input.content}/>` for body content
3. ✅ Not using reserved attribute names
4. ✅ Using array syntax for dynamic classes
4. ✅ Using `<if=expression>` not `<if(expression)>`
7. ✅ Rebuilt after changes
8. ✅ Tags copied to `dist/`

---

## Additional Resources

- Marko Documentation: https://markojs.com/docs/
- @marko/run Docs: https://github.com/marko-js/run
- MarkoPress Component Guide: `MARKO_COMPONENTS_GUIDE.md`

---

**Last Updated:** 2025-01-17

**Version:** Marko.js v6, @marko/run v0.9.4

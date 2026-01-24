# Marko Styling Guide - Complete Content

## Overview
The styling guide covers multiple approaches for styling HTML within Marko, ranging from simple inline styles to advanced CSS Modules for organized stylesheets.

## Inline Styles

Marko enhances the HTML `<style>` tag for processing and optimization through the project's bundler. Templates can include multiple `<style>` tags, with all styles being **globally scoped** by default.

Basic example demonstrates a globally scoped `.fancy` class applied to a div element. The guide notes that projects typically adopt naming conventions like BEM to prevent class name conflicts.

### Preprocessor Support

The `<style>` tag accepts file extensions to enable CSS preprocessors:
- **SCSS**: Use `<style.scss>` syntax with variables and nested selectors
- **LESS**: Use `<style.less>` syntax with variable definitions

Both preprocessors compile their syntax into standard CSS bundled with the application.

### Inline CSS Modules

Adding a tag variable to `<style>` leverages CSS Modules, exposing classes as an object. This approach enables class name scoping without following naming conventions like BEM.

Usage patterns include:
- Direct class reference: `class=styles.foo`
- Array of classes: `class=[styles.foo, styles.bar]`

**Conditional Classes with CSS Modules:**

The conditional object syntax like `class={ [styles.bar]: true }` does NOT work with CSS module references. The conditional syntax only works with string literal class names.

To conditionally apply CSS module classes, pre-compute the class value using `<let>`:

```marko
<style/styles>
  .base { padding: 8px }
  .active { background: blue }
  .disabled { opacity: 0.5 }
</style>

<!-- ❌ WRONG: These syntaxes don't work with CSS modules -->
<div class=[styles.base, styles.active: isActive]/>
<div class={styles.base: true, styles.active: isActive}/>
<div class="${styles.base} ${isActive ? styles.active : ''}"/>

<!-- ✅ CORRECT: Pre-compute with <let> -->
<let/divClass=isActive ? styles.base + ' ' + styles.active : styles.base + ' ' + styles.disabled/>
<div class=divClass/>

<!-- ✅ ALSO CORRECT: Separate if blocks for simple cases -->
<if=isActive>
  <div class=[styles.base, styles.active]/>
</if>
<if=!isActive>
  <div class=[styles.base, styles.disabled]/>
</if>
```

Preprocessors combine with CSS Modules using syntax like `<style.scss/styles>`.

## Auto-Discovered Styles

Styling files adjacent to custom tags are automatically discovered and processed identically to inline styles. This helps when templates become large, allowing developers to extract styling into associated files like `style.css`.

## Imported Styles

Styles can be explicitly imported using the import statement. While inline or auto-discovered approaches are generally preferred, imports assist when sharing styles across multiple templates.

### Imported CSS Modules

CSS Module files using the `*.module.css` naming convention can be imported with namespace syntax: `import * as styles from "./something.module.css"`. Most bundlers support this configuration by default.

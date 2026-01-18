# MarkoPress Development - Lessons Learned

This document captures critical lessons learned during MarkoPress development to prevent repeating the same mistakes.

---

## Table of Contents

1. [Marko v6 Syntax](#marko-v6-syntax)
2. [Content Rendering](#content-rendering)
3. [Build System](#build-system)
4. [Templates vs Generated Files](#templates-vs-generated-files)
5. [Project Structure](#project-structure)

---

## Marko v6 Syntax

### ❌ Mistake 1: Wrong `<if>` syntax

**Wrong:**
```marko
<if($global.condition)>
  content
</if>
```

**Correct:**
```marko
<if=$global.condition>
  content
</if>
```

**Rule:** Use `<if=condition>` NOT `<if(condition)>`

---

### ❌ Mistake 2: Wrong event handler syntax

**Wrong:**
```marko
<button on-click('toggleDarkMode')>Click</button>
```

**Correct:**
```marko
<button on-click=toggleDarkMode>Click</button>
```

**Rule:** Use `on-click=methodName` without quotes or parentheses

---

### ❌ Mistake 3: Using `onCreate()` for state

**Wrong:**
```marko
<script>
  class Layout {
    onCreate() {
      this.state = { darkMode: false };
    }
  }
</script>
```

**Correct:**
```marko
<script>
  class Layout {
    state = {
      darkMode: false,
    };
  }
</script>
```

**Rule:** Use class properties for state, not `onCreate()`

---

## Content Rendering

### ❌ Mistake 4: Confusing `<${input.content}/>` with `$!{html}`

**Know the difference:**

| Syntax | Use Case | Example |
|--------|----------|---------|
| `<${input.content}/>` | Dynamic tag content (components) | `<${input.component}/>` renders a component |
| `${input.name}` | Text content with interpolation | `<div>Hello ${input.name}</div>` |
| `$!{htmlContent}` | Raw HTML content | `$!{$global.content}` renders HTML from markdown |

**Wrong (using `<${}/>` for HTML):**
```marko
<div>
  <${$global.content}/>  <!-- Tries to create a tag named after the HTML string -->
</div>
```

**Correct (using `$!{}` for HTML):**
```marko
<div>
  $!{$global.content}  <!-- Renders raw HTML from markdown -->
</div>
```

**Correct (using `<${}/>` for dynamic components):**
```marko
<!-- Component that wraps other components -->
<div class="wrapper">
  <${input.content}/>  <!-- Renders nested component -->
</div>

<!-- Usage -->
<wrapper>
  <my-component/>
</wrapper>
```

**Correct (using `${}` for text):**
```marko
<div>
  Hello, ${input.name}!  <!-- Interpolates text -->
</div>
```

**Rule:**
- Use `<${input.content}/>` when building component wrappers (dynamic tags)
- Use `${variable}` for text interpolation
- Use `$!{variable}` for raw HTML (like markdown content)

---

### ❌ Mistake 5: Escaping HTML content

**Wrong:**
```javascript
const content = escapeMarkoTemplate(page.processed.html);
// Then using string replacement: {{CONTENT}}
```

**Correct:**
```javascript
context.content = page.processed.html;
// In template: $!{$global.content}
```

**Rule:** Let Marko handle HTML rendering with `$!{}`, don't escape it yourself

---

### ❌ Mistake 6: Using template string replacement for content

**Wrong:**
```javascript
const template = await loadTemplate('page.marko.template', {
  CONTENT: content,  // String replacement
});
```

**Correct:**
```javascript
context.content = content;  // Pass via handler
const template = await loadTemplate('page.marko.template', {});
```

**Rule:** Pass data through `$global` context, not template replacement

---

## Build System

### ❌ Mistake 7: Running `@marko/run` directly instead of MarkoPress CLI

**Wrong:**
```json
{
  "scripts": {
    "dev": "marko-run",
    "build": "marko-run build"
  }
}
```

**Correct:**
```json
{
  "scripts": {
    "dev": "npx markopress dev",
    "build": "npx markopress build"
  }
}
```

**Rule:** Use `markopress` CLI to scan content and generate routes

---

### ❌ Mistake 8: Forgetting to rebuild the TypeScript package

**Wrong:**
1. Edit TypeScript source in `packages/markopress/src/`
2. Run `pnpm dev` (uses old compiled code)

**Correct:**
1. Edit TypeScript source
2. Run `pnpm run build` in `packages/markopress/`
3. Run `pnpm dev`

**Rule:** Always rebuild the package after TypeScript changes

---

## Templates vs Generated Files

### ❌ Mistake 9: Editing generated route files

**Wrong:**
- Edit `src/routes/+layout.marko`
- Changes get overwritten on next build

**Correct:**
- Edit `packages/markopress/templates/layout.marko.template`
- Build generates routes from template

**Rule:** Edit template files, NOT generated files

---

## Project Structure

### ❌ Mistake 10: Hard-coded values instead of config

**Wrong:**
```marko
<html lang="en">
<span class="navbar-title">MarkoPress Site</span>
```

**Correct:**
```marko
<html lang=$global.lang||"en">
<span class="navbar-title">${$global.site?.title || 'MarkoPress'}</span>
```

**Rule:** Use config values from `$global` for flexibility

---

### ❌ Mistake 11: Missing `ref` attributes for JavaScript access

**Wrong:**
```marko
<span class="icon-sun">☀️</span>
<button on-click=toggleDarkMode>Toggle</button>

<script>
  toggleDarkMode() {
    const sunIcon = this.getEl('sun-icon');  // Can't find it!
  }
</script>
```

**Correct:**
```marko
<span ref="sun-icon" class="icon-sun">☀️</span>
<button on-click=toggleDarkMode>Toggle</button>

<script>
  toggleDarkMode() {
    const sunIcon = this.getEl('sun-icon');  // Works!
  }
</script>
```

**Rule:** Add `ref` attribute to elements you need to access from JavaScript

---

## Common Error Messages and Solutions

### Error: "Tag does not support arguments"

**Cause:** Using `<if($condition)>` instead of `<if=$condition>`

**Solution:** Remove parentheses around condition

---

### Error: "Unable to find entry point for custom tag `<xxx>`"

**Cause:** Trying to use a component that doesn't exist or isn't in the right location

**Solution:**
- Create component in `src/tags/` or `src/routes/components/`
- Or use built-in Marko syntax instead

---

### Error: "The closing 'code' tag does not match the corresponding opening 'span' tag"

**Cause:** Shiki-generated HTML with nested spans being parsed by Marko

**Solution:** Use `$!{variable}` to render HTML without parsing

---

## Quick Reference

### Marko v6 Syntax Cheatsheet

| Feature | Wrong | Correct |
|---------|-------|---------|
| Conditionals | `<if(x)>` | `<if=x>` |
| Loops | `<for(item of list)>` | `<for\|item\| of=list>` |
| Event handlers | `on-click('fn')` | `on-click=fn` |
| Raw HTML | `<${html}/>` | `$!{html}` |
| Attributes | `href="${url}"` | `href=url` |
| Class state | `onCreate()` | `state = {}` |

### File Locations

| What to edit | Location |
|--------------|----------|
| Layout template | `packages/markopress/templates/layout.marko.template` |
| Page template | `packages/markopress/templates/page.marko.template` |
| Doc template | `packages/markopress/templates/doc.marko.template` |
| Blog template | `packages/markopress/templates/blog-post.marko.template` |
| Build logic | `packages/markopress/src/build/index.ts` |

### Commands

| Task | Command |
|------|---------|
| Build package | `cd packages/markopress && pnpm run build` |
| Start dev server | `pnpm dev` (from root) |
| Build production | `pnpm run build` (from root) |
| Preview build | `pnpm run preview` (from root) |

---

## Review Checklist

Before committing changes, verify:

- [ ] Using correct Marko v6 syntax (`<if=`, `on-click=`, `for\|\|`)
- [ ] Using `$!{}` for raw HTML, not `<${}/>`
- [ ] Passing content via `$global` context, not template replacement
- [ ] Editing template files, not generated files
- [ ] Rebuilt TypeScript package after changes
- [ ] Using config values, not hard-coded strings
- [ ] Added `ref` attributes for JavaScript access
- [ ] Tested dev server starts without errors
- [ ] Tested build completes successfully

---

**Remember:** These lessons were learned through debugging and frustration. Don't repeat them!

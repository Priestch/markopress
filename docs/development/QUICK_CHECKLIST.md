# MarkoPress Development - Quick Checklist

Quick reference for common development tasks. Keep this handy!

---

## Before You Start

```bash
# Make sure you're in the right directory
cd /home/gp/Projects/markopress

# Make sure the package is built
cd packages/markopress && pnpm run build && cd ../..
```

---

## Common Tasks

### Adding a New Feature

1. [ ] Edit template in `packages/markopress/templates/`
2. [ ] Edit build logic in `packages/markopress/src/build/index.ts` (if needed)
3. [ ] Rebuild package: `cd packages/markopress && pnpm run build`
4. [ ] Test: `pnpm dev` (from root)
5. [ ] Test build: `pnpm run build` (from root)

---

## Syntax Check (CRITICAL!)

### Marko v6 Syntax

| ✅ Correct | ❌ Wrong | Use Case |
|-----------|----------|----------|
| `<if=$global.x>` | `<if($global.x)>` | Conditionals |
| `<for\|item\| of=list>` | `<for(item of list)>` | Loops |
| `on-click=handleClick` | `on-click('handleClick')` | Event handlers |
| `$!{$global.html}` | `<${$global.html}/>` | **Raw HTML content** |
| `<${input.content}/>` | N/A | **Dynamic tag/component** |
| `${input.name}` | N/A | **Text interpolation** |
| `href=input.link` | `href="${input.link}"` | Attributes |
| `state = {}` | `onCreate() { this.state = {} }` | Class state |

### Content Rendering Quick Guide

```marko
<!-- ✅ Raw HTML (markdown content) -->
<div>$!{$global.content}</div>

<!-- ✅ Dynamic component (wrapper) -->
<div><${input.content}/></div>

<!-- ✅ Text interpolation -->
<div>Hello ${input.name}!</div>
```

---

## File Locations

```
packages/markopress/
├── src/build/index.ts          # Build logic
├── templates/
│   ├── layout.marko.template     # Root layout
│   ├── page.marko.template       # Page template
│   ├── doc.marko.template        # Doc template
│   └── blog-post.marko.template  # Blog template
```

---

## Error Solutions

### "Tag does not support arguments"
- **Cause:** `<if($x)>` instead of `<if=x>`
- **Fix:** Remove parentheses

### "Unable to find entry point for custom tag"
- **Cause:** Component doesn't exist
- **Fix:** Create component or use Marko built-ins

### "The closing tag does not match"
- **Cause:** Shiki HTML being parsed
- **Fix:** Use `$!{variable}` for raw HTML

---

## Content Rendering Pattern

### Correct Way (Use This!)

**Template:**
```marko
<div class="content">
  $!{$global.content}
</div>
```

**Handler:**
```javascript
context.content = page.processed.html;
```

**Build Code:**
```javascript
const content = page.processed.html || '';
const handlerCode = `export async function GET(context, next) {
  context.content = ${JSON.stringify(content)};
}`;
```

### When to Use Each Syntax

| Syntax | When to Use | Example |
|--------|-------------|---------|
| `$!{html}` | **Raw HTML from markdown, trusted content** | `$!{$global.content}` for blog posts, docs |
| `<${comp}/>` | **Dynamic components, wrappers** | `<${input.content}/>` in layout components |
| `${var}` | **Text values, safe interpolation** | `${$global.title}`, `${input.name}` |

**Key Point:** The layout (`+layout.marko`) uses `<${input.content}/>` correctly because it's wrapping child components, not rendering HTML.

## Testing Your Changes

```bash
# 1. Build the package
cd packages/markopress && pnpm run build && cd ..

# 2. Clean old routes (optional but recommended)
rm -rf src/routes/*

# 3. Start dev server
pnpm dev

# 4. Check output for:
#    ✓ "Routes generated"
#    ✓ No Marko parser errors
#    ✓ Server listening

# 5. In another terminal, test build
pnpm run build
```

---

## Git Workflow

```bash
# After making changes
git status                          # See what changed
git add packages/markopress/src/    # Add source files
git add packages/markopress/templates/
git commit -m "feat: description"

# Don't commit:
# - src/routes/* (generated)
# - dist/* (build output)
# - node_modules/* (dependencies)
```

---

## Quick Debugging

### Dev server won't start?
```bash
# Check if package is built
ls packages/markopress/dist/build/index.js

# If not, build it
cd packages/markopress && pnpm run build
```

### Routes not updating?
```bash
# Clean and regenerate
rm -rf src/routes/*
pnpm dev
```

### Template changes not showing?
```bash
# You edited the wrong file!
# Should be: packages/markopress/templates/*.template
# NOT: src/routes/+layout.marko
```

---

## Most Common Mistakes

1. **Editing `src/routes/+layout.marko`** → Edit `packages/markopress/templates/layout.marko.template` instead
2. **Forgetting to rebuild package** → Run `pnpm run build` in `packages/markopress/`
3. **Using `<if($x)>`** → Use `<if=x>`
4. **Confusing `<${}/>` with `$!{}`** → Use `$!{}` for HTML, `<${}/>` for dynamic components
5. **Using `on-click('fn')`** → Use `on-click=fn`

---

**Remember:** When in doubt, check `docs/development/LESSONS_LEARNED.md` for detailed explanations!

# Fix Marko Tag Resolution for Theme Components

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix theme component tag resolution so Marko can find and use `<theme-navbar-end/>`, `<sidebar/>`, and other theme tags from the installed `@markopress/theme-default` package.

**Architecture:**
- Theme packages export tags via `marko.json` → `exports: "./dist/tags"`
- Marko discovers installed package tags automatically
- Tags are referenced using kebab-case filenames: `ThemeNavbarEnd.marko` → `<theme-navbar-end/>`
- The layout template uses these tags directly without `<components/>` wrapper or imports

**Tech Stack:**
- Marko 6 taglib discovery system
- pnpm workspace with symlinked packages
- `marko.json` for tag exports
- @marko/run routing system

**Root Cause Analysis:**
The layout template was using invalid `<components/xxx>` syntax. Marko interprets this as JavaScript expression, not a tag. The theme package is correctly set up with:
- `marko.json` with `"exports": "./dist/tags"`
- Symlinked in `node_modules/@markopress/theme-default`
- Component files in `dist/tags/` directory

The fix is simple: use kebab-case tag names directly in the template.

---

## Task 1: Fix Layout Template Tag Syntax

**Files:**
- Modify: `packages/markopress/templates/layout.marko.template`

**Step 1: Update the layout template to use correct tag syntax**

Replace invalid `<components/xxx>` syntax with correct kebab-case tag names:

```marko
<!DOCTYPE html>
<html lang=$global.lang||"en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${$global.title || '{{SITE_TITLE}}'}</title>
  <if=$global.description>
    <meta name="description" content=$global.description>
  </if>
  <link rel="stylesheet" href="/theme.css">
</head>
<body>
  <div class="app-container">
    <!-- Navbar -->
    <nav class="navbar">
      <div class="navbar-container">
        <a href="/" class="navbar-brand">
          <span class="navbar-title">{{SITE_TITLE}}</span>
        </a>

        <!-- Desktop Nav -->
        <if=$global.navbar>
          <nav class="navbar-nav desktop-only">
            <for|item| of=$global.navbar>
              <a href=item.link class="nav-link">${item.text}</a>
            </for>
          </nav>
        </if>

        <!-- Header Actions -->
        <theme-navbar-end/>

        <!-- Fallback for theme-navbar-end if not provided -->
        <div class="navbar-actions" no-adopt>
          <button class="btn-icon mobile-menu-toggle" aria-label="Toggle menu" on-click('toggleMobileMenu')>
            <span class="icon-menu">☰</span>
            <span class="icon-close">✕</span>
          </button>
        </div>
      </div>

      <!-- Mobile Menu -->
      <if=$global.navbar>
        <nav class=state.mobileMenuOpen ? 'navbar-mobile-menu is-open' : 'navbar-mobile-menu'>
          <for|item| of=$global.navbar>
            <a href=item.link class="nav-link">${item.text}</a>
          </for>
        </nav>
      </if>
    </nav>

    <!-- Main content area with optional sidebar -->
    <div class="main-wrapper">
      <if=$global.sidebar>
        <!-- Sidebar for docs -->
        <aside class="sidebar desktop-only">
          <theme-sidebar-top/>
          <sidebar sections=$global.sidebar/>
          <theme-sidebar-bottom/>
        </aside>
      </if>

      <!-- Page content -->
      <main id="main-content" class="main-content">
        <${input.content}/>
      </main>

      <if=$global.toc>
        <aside class="toc-aside desktop-only">
          <theme-aside-top toc=$global.toc/>
          <theme-aside-bottom toc=$global.toc/>
        </aside>
      </if>
    </div>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-container">
        <p>&copy; 2024 {{SITE_TITLE}}. Built with MarkoPress.</p>
      </div>
    </footer>
  </div>

  <script>
    class Layout {
      state = {
        mobileMenuOpen: false,
      };

      toggleMobileMenu() {
        this.state.mobileMenuOpen = !this.state.mobileMenuOpen;
      }

      onMount() {
        this.$observe('mobileMenuOpen', (isOpen) => {
          if (typeof document !== 'undefined') {
            document.body.style.overflow = isOpen ? 'hidden' : '';
          }
        });
      }
    }
  </script>

  <style>
    .icon-menu, .icon-close {
      font-size: 1.2rem;
      line-height: 1;
    }

    .desktop-only {
      display: block;
    }

    @media (max-width: 768px) {
      .desktop-only {
        display: none;
      }
    }

    .btn-icon {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.5rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .navbar-mobile-menu {
      display: none;
      padding: 1rem;
      border-top: 1px solid var(--border-default, #e5e7eb);
    }

    .navbar-mobile-menu.is-open {
      display: block;
    }

    .navbar-mobile-menu .nav-link {
      display: block;
      padding: 0.5rem 0;
      color: inherit;
      text-decoration: none;
    }
  </style>
</body>
</html>
```

**Step 2: Rebuild the markopress package**

Run: `cd /home/gp/Projects/markopress && pnpm --filter markopress build`
Expected: Build completes with no errors

**Step 3: Clean generated routes and tags**

Run: `cd /home/gp/Projects/markopress/website && rm -rf src/routes/components src/.markopress`
Expected: Directories removed

**Step 4: Restart dev server**

Run: `pnpm dev`
Expected: Server starts without errors

**Step 5: Test the website**

Run: `curl -s http://localhost:3000 | grep -c "<nav"`
Expected: Returns count > 0 (page renders successfully)

**Step 6: Verify tags are resolved**

Check browser console or HTML output for:
- `<search>` button rendered
- `<theme-toggle>` button rendered
- No "Unable to find entry point" errors

**Step 7: Commit**

```bash
git add packages/markopress/templates/layout.marko.template
git commit -m "fix: use correct kebab-case tag syntax in layout template"
```

---

## Task 2: Remove Unused copyThemeComponents Function

**Files:**
- Modify: `packages/markopress/src/build/index.ts`

**Step 1: Remove the copyThemeComponents function and calls**

The `copyThemeComponents` function was added to work around a non-existent problem. Since installed package tags work through Marko's taglib discovery, this code is unnecessary.

Remove these lines from `src/build/index.ts`:
- Lines 179-182: The Step 13 that calls `copyThemeComponents`
- Lines 894-979: The entire `copyThemeComponents` function
- Lines 129-132: The call in `src/dev/index.ts` (if present)

**Step 2: Remove unused pascalToKebab function**

Since `copyThemeComponents` is removed, the `pascalToKebab` helper is also unused. Remove lines 894-899.

**Step 3: Update step numbers in comments**

The remaining steps need renumbering:
- Step 14 → Step 13
- Step 15 → Step 14
- Step 16 → Step 15
- Step 17 → Step 16
- Step 18 → Step 17

**Step 4: Rebuild and test**

Run: `pnpm --filter markopress build && cd website && pnpm dev`
Expected: Build succeeds, dev server starts, website loads

**Step 5: Commit**

```bash
git add packages/markopress/src/build/index.ts packages/markopress/src/dev/index.ts
git commit -m "refactor: remove unnecessary copyThemeComponents function"
```

---

## Task 3: Clean Up marko.json Files

**Files:**
- Modify: `website/marko.json`
- Modify: `website/src/routes/marko.json`

**Step 1: Remove unnecessary marko.json files**

These files were created to work around the tag resolution issue. They're no longer needed since tags are discovered from the installed package.

Delete or empty the files:
- `website/marko.json` - keep as empty `{}`
- `website/src/routes/marko.json` - keep as empty `{}`

**Step 2: Verify tags still work**

Run: `pnpm dev`
Expected: Tags resolve without explicit `tags-dir` configuration

**Step 3: Commit**

```bash
git add website/marko.json website/src/routes/marko.json
git commit -m "chore: clean up unnecessary marko.json configuration"
```

---

## Task 4: Document Tag Resolution for Users

**Files:**
- Modify: `CLAUDE.md` (add documentation about tag resolution)

**Step 1: Add documentation section**

Add to `CLAUDE.md` after the "Theming" section:

```markdown
## Tag Resolution

MarkoPress theme components are automatically discoverable through Marko's taglib system:

### Using Theme Tags

Theme tags from `@markopress/theme-default` are automatically available in your templates:

```marko
<theme-navbar-end/>
<sidebar sections=$global.sidebar/>
<theme-toggle/>
<search/>
```

### Creating Custom Tags

Place `.marko` files in `src/tags/` and they'll be automatically discovered:

```
src/tags/
  my-custom-tag.marko
  another-tag.marko
```

Use them as: `<my-custom-tag/>`, `<another-tag/>`

### Tag Naming

Tags use kebab-case based on filename:
- `ThemeNavbarEnd.marko` → `<theme-navbar-end/>`
- `my-custom-tag.marko` → `<my-custom-tag/>`

### Creating Theme Components

When creating theme packages:

1. Add `marko.json` to your package:
```json
{
  "exports": "./dist/tags"
}
```

2. Place `.marko` files in `dist/tags/`

3. Use kebab-case filenames for easy tag reference
```
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add tag resolution documentation"
```

---

## Testing Checklist

After completing all tasks:

- [ ] Dev server starts without errors
- [ ] Homepage renders with navbar
- [ ] Theme toggle button appears and works
- [ ] Search button appears (with keyboard shortcut indicator)
- [ ] Doc pages show sidebar navigation
- [ ] Sidebar items are clickable
- [ ] Active page is highlighted in sidebar
- [ ] Footer appears on all pages
- [ ] No console errors about missing tags
- [ ] Production build succeeds: `pnpm build`
- [ ] Production preview works: `pnpm preview`

---

## References

- Marko 6 Custom Tags: `/docs/marko6/custom-tags.md`
- Theme package: `/packages/theme-default/`
- Theme tag exports: `/packages/theme-default/marko.json`
- Theme tags directory: `/packages/theme-default/dist/tags/`

# Marko Tags Implementation - Lessons Learned

Documenting mistakes and solutions from implementing Marko components in Markdown.

## 🔴 Critical Mistakes

### 1. Reserved Attribute Names

**Mistake:** Used `type="note"` on custom components
```marko
<!-- ❌ WRONG -->
<alert-box type="note">Content</alert-box>
```

**Why it failed:** `type` is a reserved HTML attribute (used by `<input>`, `<button>`, etc.). Marko's compiler ignored it.

**Solution:** Rename to `kind`, `variant`, or any non-reserved name
```marko
<!-- ✅ CORRECT -->
<alert-box kind="note">Content</alert-box>
```

**Files affected:**
- `tags/alert-box.marko`
- `my-content/pages/component-showcase.md`
- All markdown files using alert-box

---

### 2. Wrong Body Content Syntax

**Mistake:** Tried 5 different wrong syntaxes before finding the right one

| Syntax | Result | Problem |
|--------|--------|---------|
| `<input.text/>` | Renders as `<input class=text>` | Text content is a special input type |
| `<input/>` | Renders as `<input>` | HTML5 input element |
| `<body/>` | Renders as `<body>` | HTML5 body tag |
| `<${input.renderBody}/>` | Empty content | `renderBody` doesn't exist on input |
| `<${input.content}/>` | ✅ **WORKS!** | Correct syntax |

**Solution:** Always use `<${input.content}/>` for body content
```marko
<div class="alert">
  <${input.content}/>
</div>
```

---

### 3. Configuration Pipeline Disconnected

**Mistake:** Markdown options not passed through build pipeline

**The chain:** config → build → scanner → loader

**What was missing:**
1. `ContentScannerOptions` interface didn't have `markdownOptions` field
2. Content scanner didn't destructure `markdownOptions`
3. Build system didn't pass `config.markdown` to scanner

**Files modified:**
- `packages/markopress/src/content/types.ts` - Added `markdownOptions?: MarkdownOptions`
- `packages/markopress/src/content/scanner.ts` - Passed options through
- `packages/markopress/src/build/index.ts` - Passed `config.markdown` to scanner

**Solution:** Explicitly pass options through each layer
```typescript
// Build system
await scanContent({
  rootDir: process.cwd(),
  dirs: config.content,
  markdownOptions: config.markdown,  // ✅ Added this
});

// Scanner
async function scanDirectory(
  dirPath: string,
  type: ContentType,
  rootDir: string,
  markdownOptions?: MarkdownOptions  // ✅ Added this
): Promise<ContentFile[]>
```

---

### 4. Placeholder Offset Tracking Bug

**Mistake:** When replacing Marko tags with placeholders, didn't account for string position changes

**The bug:**
```typescript
// ❌ WRONG: Doesn't account for shifting positions
for (const token of tokens) {
  const placeholder = createPlaceholder(token.id);
  processedSrc = processedSrc.substring(0, token.start) +
                  placeholder +
                  processedSrc.substring(token.end);
}
```

**Problem:** After first replacement, all subsequent positions shift but we used original positions.

**Solution:**
```typescript
// ✅ CORRECT: Track offset
let offset = 0;
for (const token of tokens) {
  const placeholder = createPlaceholder(token.id);
  const adjustedStart = token.start + offset;
  const adjustedEnd = token.end + offset;
  processedSrc = processedSrc.substring(0, adjustedStart) +
                  placeholder +
                  processedSrc.substring(adjustedEnd);
  offset += placeholder.length - (token.end - token.start);
}
```

**File:** `packages/markopress/src/markdown/preserve-tags.ts:175-186`

---

### 5. Wrong Placeholder Format

**Mistake:** Used simple text placeholders that markdown-it didn't recognize as block elements

**First attempt:**
```typescript
const placeholder = `MARKO_TAG_${id}_`;
// Results in: MARKO_TAG_0_
```

**Problem:** Markdown-it treats this as inline text, wraps it in `<p>` tags, causing malformed HTML.

**Solution:** Use HTML `<div>` elements
```typescript
const placeholder = `<div data-marko-tag="${id}"></div>`;
// Markdown-it recognizes <div> as block element
```

**File:** `packages/markopress/src/markdown/preserve-tags.ts:71`

---

### 6. Tags Directory Not Copied to Build Output

**Mistake:** Tags existed in `tags/` but weren't available at runtime

**Symptom:** Components showed raw template syntax instead of rendering

**Solution:** Added `copyTagsDirectory()` function
```typescript
export async function copyTagsDirectory(
  rootDir: string,
  outDir: string,
  config: ResolvedConfig,
  debug: boolean
): Promise<void> {
  const tagsDir = path.join(rootDir, tagsDirConfig);
  const distTagsDir = path.join(outDir, 'tags');

  // Copy all tag files
  await fs.mkdir(distTagsDir, { recursive: true });
  // ... copy logic
}
```

**When to call:** AFTER `@marko/run` build, not before (build cleans dist)

**File:** `packages/markopress/src/build/index.ts:654-713`

---

### 7. Tag Detection Regex Bug

**Mistake:** Used regex that didn't properly extract tag names from closing tags

**The bug:**
```typescript
// In callback
onTagDetected(
  token.tag.match(/<([a-z][a-z0-9]*)/)?.[1] || ''  // ❌ WRONG
  lineNumber
);
```

**Problem:** For closing tag `</alert-box>`, regex extracted empty string.

**Solution:** Store tagName during detection
```typescript
// During detection
tokens.push({
  id: id++,
  start: match.index!,
  end: match.index! + match[0].length,
  tag: match[0],
  tagName: match[1],  // ✅ Store directly
});

// In callback
onTagDetected(
  token.tagName,  // ✅ Use stored value
  lineNumber
);
```

**File:** `packages/markopress/src/markdown/preserve-tags.ts:131-137`

---

## 🟡 Important Learnings

### 8. Comparison Operators in If-Attributes

**Mistake:** Used `>` and `<` operators directly in `<if>` tag attributes
```marko
<!-- ❌ WRONG: Outputs "0>" as text -->
<if=input.toc && input.toc.length > 0>
  Content
</if>

<!-- ❌ WRONG: Outputs "<" as text -->
<if=input.index < 10>
  Content
</if>
```

**Why it failed:** Marko's template parser doesn't recognize comparison operators in attributes and outputs them as literal text.

**Solution:** Use `<let>` variables for complex conditions
```marko
<!-- ✅ CORRECT: Compute condition in let variable -->
<let/hasToc= (input.toc && input.toc.length)>
<if=hasToc>
  Content
</if>

<!-- ✅ CORRECT: For greater-than check -->
<let/isValidIndex= (input.index <= 10)>
<if=isValidIndex>
  Content
</if>
```

**Files affected:**
- `packages/theme-default/src/components/theme/ThemeAsideTop.marko`

---

### 9. Boolean Conversion for Let Variables

**Mistake:** Expression returning `0` instead of `false` causes "0>" artifact
```marko
<!-- ❌ WRONG: Returns 0 for empty array -->
<let/hasChildren= (input.item.children && input.item.children.length)>
<if=hasChildren>
  Content
</if>
<!-- Outputs: "0>" when hasChildren is 0 -->
```

**Why it failed:** The `&&` operator returns the last truthy value or the first falsy value. An empty array `[]` is truthy, but `[].length` is `0` (falsy). When `0` is passed to `<if>`, Marko outputs "0>" as text.

**Solution:** Use double negation `!!` for proper boolean conversion
```marko
<!-- ✅ CORRECT: Returns true/false -->
<let/hasChildren= !!(input.item.children && input.item.children.length)>
<if=hasChildren>
  Content
</if>
```

**Files affected:**
- `packages/theme-default/src/components/theme/ThemeTocItem.marko`

---

### 10. Self-Closing Component Tags Output Text

**Mistake:** Used self-closing syntax for custom components
```marko
<!-- ❌ WRONG: Outputs "/>" as text -->
<theme-toc-item item=item/>
<my-component data=input.data/>
```

**Why it failed:** Self-closing custom components in Marko v6 may output the `/>` sequence as text in the HTML output.

**Solution:** Use explicit opening and closing tags
```marko
<!-- ✅ CORRECT: Explicit closing tag -->
<theme-toc-item item=item></theme-toc-item>
<my-component data=input.data></my-component>
```

**Note:** Self-closing tags work fine for HTML elements (`<img/>`, `<input/>`, `<br/>`) but should be avoided for custom components.

**Files affected:**
- `packages/theme-default/src/components/theme/ThemeAsideTop.marko`
- `packages/theme-default/src/components/theme/ThemeTocItem.marko`

---

### 11. Theme Components Are Copied During Build

**Mistake:** Modified component files in `website/src/routes/tags/` expecting changes to persist

**Why it failed:** The build process copies theme components from `packages/theme-default/` to the website, overwriting local modifications.

**Build flow:**
```
packages/theme-default/src/components/theme/*.marko
    → (build)
website/src/routes/tags/*.marko (gets overwritten)
```

**Solution:** Always modify source files in the theme package
```bash
# ✅ CORRECT: Edit source
vim packages/theme-default/src/components/theme/ThemeAsideTop.marko

# Then rebuild both
cd packages/theme-default && pnpm build
cd ../website && pnpm build
```

**Files affected:**
- Build process in `packages/markopress/src/build/index.ts`

---

### 12. If-Statement Syntax (Legacy)

**Rule:** No parentheses around the expression

```marko
<!-- ✅ CORRECT -->
<if=input.isVisible>
  Content
</if>

<!-- ❌ WRONG: Marko v5 style -->
<if(input.isVisible)>
  Content
</if>
```

**Impact:** Had to fix 30+ `.marko` files

---

### 9. Dynamic Class Syntax

**Marko v6 does NOT support template literals in attributes**

```marko
<!-- ❌ WRONG: Template literal -->
<div class="alert alert-${input.kind}">Content</div>

<!-- ✅ CORRECT: Array syntax -->
<div class=["alert", "alert-" + input.kind]>Content</div>

<!-- ✅ CORRECT: Ternary -->
<div class=input.kind ? "alert alert-" + input.kind : "alert">Content</div>
```

---

### 10. Rebuild Required After Component Changes

**Mistake:** Modified component files but expected dev server to hot-reload

**Reality:** Route files are generated during build, not hot-reloaded

**Solution:**
```bash
npx markopress build  # Regenerate routes
npx markopress dev     # Start dev server
```

---

## 📊 Time Spent on Each Issue

| Issue | Time | Root Cause |
|-------|------|------------|
| Reserved attribute names | 30 min | Used `type` instead of `kind` |
| Wrong body syntax | 45 min | Tried 5 wrong syntaxes |
| Config pipeline | 20 min | Options not passed through |
| Offset tracking | 15 min | String position math |
| Placeholder format | 10 min | Text vs HTML elements |
| Tags not copied | 25 min | Build process missing step |
| Regex bug | 10 min | Closing tags not handled |
| If-statement syntax | 15 min | Marko v5 vs v6 difference |
| Comparison operators in `<if>` | 45 min | `>` outputs as text in templates |
| Boolean conversion | 20 min | `0` passed to `<if>` outputs "0>" |
| Self-closing tags | 15 min | `/>` outputs as text for components |
| Theme component source | 10 min | Modified wrong file, build overwrites |

**Total:** ~4 hours of debugging for what should have been 45 minutes of work

---

## ✅ Prevention Checklist

Before implementing a feature:

- [ ] Read latest framework docs (Marko v6 ≠ v5)
- [ ] Check reserved attribute names
- [ ] Test simple case first (hello world)
- [ ] Verify build pipeline connections
- [ ] Add comprehensive error messages
- [ ] Document correct syntax immediately

### Marko v6 Syntax Rules (CRITICAL)

- [ ] **NO comparison operators in `<if>` attributes** - Use `<let>` variable first
- [ ] **NO self-closing custom components** - Use explicit closing tags
- [ ] **Use `!!` for boolean conversion** in `<let>` variables used in `<if>`
- [ ] **Edit theme source files** in `packages/theme-default/`, not in `website/`
- [ ] **Rebuild theme package** before rebuilding website
- [ ] **Use `<if=expression>`** not `<if(expression)>` (no parentheses)

---

## 🎯 Key Takeaways

1. **Reserved words matter** - Check HTML5 spec before naming attributes
2. **Syntax is strict** - Small differences (parentheses, quotes) break compilation
3. **Pipeline must be complete** - Options flow through ALL layers explicitly
4. **Build vs runtime** - Generated files ≠ source files
5. **Test incrementally** - Don't implement 5 things at once
6. **Document immediately** - Write down what works BEFORE moving on

---

## 📚 Related Documentation

- `MARKO_V6_TECHNICAL_GUIDE.md` - Comprehensive syntax reference
- `MARKO_COMPONENTS_GUIDE.md` - Component usage guide
- `IMPLEMENTATION_PLAN.md` - Original implementation plan

---

**Date:** 2025-01-17 (updated 2025-01-25 for TOC debugging)
**Project:** MarkoPress Marko Tags Feature
**Status:** ✅ Complete and Working

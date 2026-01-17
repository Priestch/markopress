# Marko Tags Feature Tests

This directory contains comprehensive tests for the Marko tags feature.

## Test Files

- `my-content/pages/marko-tags-basic.md` - Basic tag preservation
- `my-content/pages/marko-tags-nested.md` - Nested components
- `my-content/pages/marko-tags-missing.md` - Missing component (should fail)
- `my-content/pages/marko-tags-attributes.md` - Tag attributes
- `my-content/pages/marko-tags-standard-html.md` - Standard HTML (not preserved)
- `my-content/pages/marko-tags-markdown-inside.md` - Markdown inside tags

## Example Components

- `tags/alert-box.marko` - Alert component
- `tags/button.marko` - Button component
- `tags/card.marko` - Card component

## Quick Start

### Run All Tests
```bash
./run-marko-tests.sh
```

### Run Manual Tests
```bash
# Build and verify
npx markopress build

# Start dev server
npx markopress dev
# Open http://localhost:3000
```

## Expected Behavior

### ✅ Should Work
- Kebab-case tags preserved: `<alert-box>`, `<button>`, `<card>`
- Standard HTML processed: `<div>`, `<button>`, `<span>`
- Markdown inside tags formatted: `**bold**`, `*italic*`

### ❌ Should Fail
- Build fails if `<custom-tag>` used (component doesn't exist)
- Error message shows file:line number

### Marko Syntax Rules

✅ **Kebab-case only**: `<my-tag>` preserved
❌ **PascalCase**: `<MyTag>` NOT preserved (processed as HTML)
❌ **camelCase**: `<myTag>` NOT preserved (processed as HTML)
❌ **Standard HTML**: `<button>`, `<div>` NOT preserved (processed by markdown-it)

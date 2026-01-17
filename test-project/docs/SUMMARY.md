# Marko Tags Feature Documentation

Complete documentation for the Marko Tags in Markdown feature.

## 📚 Documentation Files

### User Guides

1. **[README-MARKO-TAGS.md](./README-MARKO-TAGS.md)**
   - Feature overview and quick start
   - Basic usage examples
   - Configuration guide

2. **[MARKO_COMPONENTS_GUIDE.md](./MARKO_COMPONENTS_GUIDE.md)**
   - Component library reference
   - Usage examples for all components
   - Props and attributes documentation

### Technical Guides

3. **[MARKO_V6_TECHNICAL_GUIDE.md](./MARKO_V6_TECHNICAL_GUIDE.md)**
   - Marko.js v6 syntax reference
   - Common pitfalls and solutions
   - Best practices
   - Troubleshooting guide

4. **[LESSONS_LEARNED.md](./LESSONS_LEARNED.md)**
   - All mistakes encountered during implementation
   - Root cause analysis
   - Solutions and prevention strategies
   - Time spent on each issue

## 🚀 Quick Start

1. **Enable the feature in `markopress.config.js`:**
   ```javascript
   markdown: {
     markoTags: {
       enabled: true,
       tagsDir: 'tags/',
     },
   }
   ```

2. **Create components in `tags/` directory:**
   ```marko
   <!-- tags/alert-box.marko -->
   <div class=["alert", input.kind && "alert-" + input.kind]>
     <${input.content}/>
   </div>
   ```

3. **Use components in Markdown:**
   ```markdown
   <alert-box kind="warning">
     This is a **warning** alert!
   </alert-box>
   ```

## 📦 Available Components

- **Alert Boxes** - `note`, `tip`, `warning`, `danger`, `info`, `caution`
- **Buttons** - Primary and secondary buttons with icons
- **Cards** - With header, body, and footer slots
- **Icons** - SVG icons with customizable size and color

## 🔧 Technical Details

- **Tag Detection:** Kebab-case tags (`<my-component>`)
- **Attribute Syntax:** Unquoted for dynamic values (`href=input.link`)
- **Body Content:** Use `<${input.content}/>`
- **Dynamic Classes:** Array syntax (`class=["base", input.modifier]`)
- **Conditionals:** `<if=condition>` not `<if(condition)>`

## ⚠️ Common Mistakes

1. ❌ Using reserved HTML attributes (`type`, `id`, `name`) → Use `kind`, `uid`
2. ❌ Using `<input.text/>` for body content → Use `<${input.content}/>`
3. ❌ Template literals in attributes → Use array syntax
4. ❌ `<if(expression)>` syntax → Use `<if=expression>`

See [LESSONS_LEARNED.md](./LESSONS_LEARNED.md) for complete details.

## 📖 Additional Resources

- **Implementation Review:** `../IMPLEMENTATION_REVIEW.md`
- **Final Review:** `../FINAL_REVIEW.md` (archived)
- **Component Examples:** `../tags/` directory
- **Test Pages:** `../my-content/pages/` directory

---

**Last Updated:** 2025-01-17
**Status:** ✅ Complete and Working

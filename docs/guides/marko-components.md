# Marko Components Quick Reference

Beautiful, styled components ready to use in your markdown files!

## 🚀 Quick Start

1. **Enable Marko tags** in `markopress.config.js`:
   ```js
   markdown: {
     markoTags: {
       enabled: true,
       tagsDir: 'tags/'
     }
   }
   ```

2. **Use components in markdown**:
   ```markdown
   <alert-box type="warning">Important message!</alert-box>
   ```

## 📦 Component Library

### 📢 Alert Boxes

**6 types** with gradient backgrounds, icons, and hover effects:

```markdown
<alert-box type="note">Default info alert</alert-box>
<alert-box type="tip">Pro tip!</alert-box>
<alert-box type="warning">Warning message</alert-box>
<alert-box type="danger">Critical error</alert-box>
<alert-box type="info">Additional info</alert-box>
<alert-box type="caution">Be careful!</alert-box>
```

**Features:**
- ✨ Gradient backgrounds
- 🎨 Auto icons (💡⚠️🚫ℹ️⚡)
- 🖱️ Hover lift effect
- 🌙 Dark mode support

### 🔘 Buttons

**Primary & Secondary** with smooth animations:

```markdown
<button-primary href="/docs">Docs</button-primary>
<button-primary href="#" arrow>Get Started →</button-primary>
<button-secondary href="#" icon="📚">Learn More</button-secondary>
<button-primary href="#" disabled>Disabled</button-primary>
```

**Features:**
- 🎨 Gradient backgrounds
- ➡️ Animated arrow on hover
- 🚫 Disabled state
- 🌙 Dark mode support

### 🃏 Cards

**Nested structure** with full markdown support:

```markdown
<card>
  <card-header><h3>Card Title</h3></card-header>
  <card-body>
    **Bold**, *italic*, lists, code...
  </card-body>
  <card-footer>Footer info</card-footer>
</card>
```

**Features:**
- 📦 Header, body, footer sections
- 📝 Full markdown inside
- 🎭 Hover lift effect
- 🌙 Dark mode support

### 🎯 Icons

**18+ SVG icons** with customization:

```markdown
<icon name="check" size="24" color="success" />
<icon name="warning" size="20" color="warning" />
<icon name="settings" size="24" spin />
```

**Available icons:**
- `user`, `settings`, `check`, `check-circle`
- `home`, `menu`, `close`, `search`
- `arrow`, `arrow-left`
- `star`, `heart`
- `info`, `warning`
- `download`, `upload`, `external-link`

**Features:**
- 📏 Customizable size
- 🎨 Color themes (primary, success, warning, danger, light)
- 🔄 Spin animation option
- 🌙 Dark mode support

## 🎨 Styling Features

### Global Styles (`public/components.css`)

- **CSS Variables** - Easy theming
- **Responsive Design** - Mobile-friendly
- **Dark Mode** - Automatic support
- **Smooth Animations** - Professional feel
- **Hover Effects** - Interactive feedback

### Component Features

| Component | Gradient | Hover | Icon | Dark Mode |
|-----------|----------|-------|------|-----------|
| Alert Box | ✅ | ✅ | ✅ | ✅ |
| Button Primary | ✅ | ✅ | - | ✅ | - |
| Button Secondary | ✅ | ✅ | - | ✅ | - |
| Card | - | ✅ | - | ✅ | - |
| Icon | - | - | N/A | ✅ | - |

## 📝 Example Combinations

### Call-to-Action Section
```markdown
<card>
  <card-header><h3>🚀 Get Started Today</h3></card-header>
  <card-body>
    <alert-box type="tip">
      Start with our quick start guide!
    </alert-box>
  </card-body>
  <card-footer>
    <button-primary href="/docs" arrow>Read Docs →</button-primary>
  </card-footer>
</card>
```

### Feature List
```markdown
<card>
  <card-header><h3><icon name="check" size="20" color="success" /> Features</h3></card-header>
  <card-body>
    - Fast performance
    - Beautiful themes
    - Easy to use
  </card-body>
</card>
```

### Status Messages
```markdown
<alert-box type="success">
  <icon name="check-circle" size="20" /> Success! Your changes were saved.
</alert-box>

<alert-box type="danger">
  <icon name="warning" size="20" /> Error! Please try again.
</alert-box>
```

## 🌐 Live Demo Pages

Visit these URLs to see components in action:

- `/component-showcase` - Complete component showcase
- `/marko-tags-basic` - Basic component usage
- `/marko-tags-attributes` - Components with attributes
- `/marko-tags-nested` - Nested components

## 🎯 Best Practices

1. **Use appropriate alert types**
   - `note` - General information
   - `tip` - Helpful suggestions
   - `warning` - Important warnings
   - `danger` - Critical errors
   - `info` - Additional context
   - `caution` - Warnings with lower severity

2. **Button hierarchy**
   - Primary - Main CTA
   - Secondary - Alternative actions

3. **Card organization**
   - Keep related content together
   - Use headers for clear structure
   - Add footers for metadata

4. **Icon usage**
   - Match icon to context
   - Use consistent sizes
   - Leverage colors for meaning

## 🔧 Customization

Edit `public/components.css` to customize:

- Colors (CSS variables)
- Spacing
- Border radius
- Shadows
- Transitions
- Responsive breakpoints

## 📚 Learn More

- Component source: `tags/*.marko`
- Styles: `public/components.css`
- Demo: `my-content/pages/component-showcase.md`

---

**Made with ❤️ using MarkoPress**

# MarkoPress Test Project

Test project for demonstrating and testing the Marko Tags feature in MarkoPress.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Development mode
npx markopress dev

# Build for production
npx markopress build

# Preview production build
npx markopress preview
```

## 📚 Documentation

See [docs/](./docs/) for complete documentation:

- **[docs/SUMMARY.md](./docs/SUMMARY.md)** - Documentation index and quick start
- **[docs/README-MARKO-TAGS.md](./docs/README-MARKO-TAGS.md)** - Feature overview
- **[docs/MARKO_COMPONENTS_GUIDE.md](./docs/MARKO_COMPONENTS_GUIDE.md)** - Component usage guide
- **[docs/MARKO_V6_TECHNICAL_GUIDE.md](./docs/MARKO_V6_TECHNICAL_GUIDE.md)** - Marko.js v6 technical guide
- **[docs/LESSONS_LEARNED.md](./docs/LESSONS_LEARNED.md)** - Lessons learned during development

## 🎨 Available Components

### Alert Boxes
```markdown
<alert-box kind="note">This is a note</alert-box>
<alert-box kind="warning">This is a warning</alert-box>
<alert-box kind="danger">This is danger info</alert-box>
```

### Buttons
```markdown
<button-primary href="/docs">Documentation</button-primary>
<button-secondary href="/about">About</button-secondary>
```

### Cards
```markdown
<card>
  <card-header><h3>Title</h3></card-header>
  <card-body>Content</card-body>
  <card-footer>Footer</card-footer>
</card>
```

### Icons
```markdown
<icon name="check" size="24" color="success" />
<icon name="warning" size="20" spin />
```

## 📁 Project Structure

```
test-project/
├── docs/                    # Documentation
│   ├── SUMMARY.md          # Documentation index
│   ├── README-MARKO-TAGS.md
│   ├── MARKO_COMPONENTS_GUIDE.md
│   ├── MARKO_V6_TECHNICAL_GUIDE.md
│   ├── LESSONS_LEARNED.md
│   └── archive/            # Archived implementation docs
├── tags/                   # Marko components
│   ├── alert-box.marko
│   ├── button-primary.marko
│   ├── button-secondary.marko
│   ├── card.marko
│   └── icon.marko
├── my-content/            # Markdown content
│   ├── pages/            # Pages
│   └── docs/             # Documentation
├── public/               # Static assets
│   ├── components.css   # Component styles
│   └── theme.css        # Theme styles
└── markopress.config.js # Configuration
```

## 🔧 Configuration

Marko Tags feature is configured in `markopress.config.js`:

```javascript
markdown: {
  markoTags: {
    enabled: true,
    tagsDir: 'tags/',
  },
}
```

## 📖 More Information

- [MarkoPress Main Project](../)
- [Full Documentation](./docs/)
- [Component Examples](http://localhost:3000/component-showcase)

---

**Last Updated:** 2025-01-17
**Status:** ✅ Feature Complete and Working

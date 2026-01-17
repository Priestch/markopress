---
title: Marko Component Showcase
description: Beautiful, styled Marko components for your markdown
---

# Marko Component Showcase

Welcome to the Marko component showcase! All components are beautifully styled and ready to use.

## Alert Boxes

### Note Alert
<alert-box kind="note">
  This is a **note** alert with <code>inline code</code> and support for markdown formatting.
</alert-box>

### Tip Alert
<alert-box kind="tip">
  This is a **tip** alert! Great for helpful suggestions.
</alert-box>

### Warning Alert
<alert-box kind="warning">
  This is a **warning** alert. Use this for important warnings.
</alert-box>

### Danger Alert
<alert-box kind="danger">
  This is a **danger** alert. Use for critical information.
</alert-box>

### Info Alert
<alert-box kind="info">
  This is an **info** alert. Great for additional context.
</alert-box>

### Caution Alert
<alert-box kind="caution">
  This is a **caution** alert. Use carefully!
</alert-box>

## Buttons

### Primary Buttons
<button-primary href="/docs">Documentation</button-primary>

<button-primary href="#" arrow>Get Started →</button-primary>

<button-primary href="#" disabled>Disabled Button</button-primary>

### Secondary Buttons
<button-secondary href="/about">Learn More</button-secondary>

<button-secondary href="#" arrow>View Details →</button-secondary>

### Buttons with Icons
<button-primary href="#" icon="⭐">Star Us</button-primary>

<button-secondary href="#" icon="📚">Read Docs</button-secondary>

## Cards

### Simple Card
<card>
  <card-header><h3>Quick Start</h3></card-header>
  <card-body>
    Get started with MarkoPress in just a few minutes. It's fast, easy, and powerful!
  </card-body>
</card>

### Card with Markdown
<card>
  <card-header><h3>Rich Content</h3></card-header>
  <card-body>
    Cards support **full markdown formatting**:

    - Unordered lists
    - *Italic* and **bold** text
    - `inline code`
    - And more!

    > This is a blockquote inside a card
  </card-body>
  <card-footer>
    Last updated: January 2025
  </card-footer>
</card>

### Feature Cards
<card>
  <card-header><h3>🚀 Fast Performance</h3></card-header>
  <card-body>
    Blazing fast static site generation powered by Marko.js v6.
  </card-body>
</card>

<card>
  <card-header><h3>🎨 Beautiful Themes</h3></card-header>
  <card-body>
    Modern, responsive design with dark mode support out of the box.
  </card-body>
</card>

## Icons

### Basic Icons
<icon name="check" size="20" color="success" />
<icon name="warning" size="24" color="warning" />
<icon name="info" size="20" color="primary" />

### Icon Sizes
<icon name="star" size="16" />
<icon name="star" size="20" />
<icon name="star" size="24" />
<icon name="star" size="32" />

### Icon Colors
<icon name="heart" size="24" color="danger" />
<icon name="check-circle" size="24" color="success" />
<icon name="info" size="24" color="primary" />

### Spinning Icon (Loading)
<icon name="settings" size="24" spin />

### All Available Icons
<icon name="user" size="20" /> User |
<icon name="settings" size="20" /> Settings |
<icon name="check" size="20" /> Check |
<icon name="check-circle" size="20" /> Check Circle |
<icon name="home" size="20" /> Home |
<icon name="menu" size="20" /> Menu |
<icon name="close" size="20" /> Close |
<icon name="search" size="20" /> Search |
<icon name="arrow" size="20" /> Arrow |
<icon name="arrow-left" size="20" /> Arrow Left |
<icon name="star" size="20" /> Star |
<icon name="heart" size="20" /> Heart |
<icon name="info" size="20" /> Info |
<icon name="warning" size="20" /> Warning |
<icon name="download" size="20" /> Download |
<icon name="upload" size="20" /> Upload |
<icon name="external-link" size="20" /> External Link

## Component Reference

### Alert Box
```markdown
<alert-box kind="note|tip|warning|danger|info|caution" dismissible>
  Your message here with **markdown** support
</alert-box>
```

**Attributes:**
- `type` - Alert type: `note`, `tip`, `warning`, `danger`, `info`, `caution` (default: `note`)

### Button Primary
```markdown
<button-primary href="/link" icon="emoji" arrow disabled>
  Button Text
</button-primary>
```

**Attributes:**
- `href` - Link URL (default: `#`)
- `icon` - Emoji or icon text (optional)
- `arrow` - Show arrow (optional)
- `disabled` - Disable button (optional)

### Button Secondary
```markdown
<button-secondary href="/link" icon="emoji" arrow disabled>
  Button Text
</button-secondary>
```

**Attributes:** Same as button-primary

### Card Components
```markdown
<card>
  <card-header><h3>Title</h3></card-header>
  <card-body>
    Content with **markdown** support
  </card-body>
  <card-footer>
    Footer text
  </card-footer>
</card>
```

### Icon
```markdown
<icon name="icon-name" size="24" color="primary" spin />
```

**Attributes:**
- `name` - Icon name (required)
- `size` - Size in pixels (default: `20`)
- `color` - Color: `primary|success|warning|danger|light` (default: current color)
- `spin` - Add spinning animation (optional)
- `strokeWidth` - Stroke width (default: `2`)
- `fill` - Fill color (default: `none`)

---

**Pro Tip:** All components support dark mode and are fully responsive! 🌙

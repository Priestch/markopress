---
title: "Image Component Guide"
description: "Learn how to use the Image component for responsive, optimized images"
order: 15
---

# Image Component Guide

The `<image>` component provides responsive, optimized images similar to Gatsby's `GatsbyImage` and Astro's `Image`.

## Quick Start

### Fixed Layout

<image
  src="/images/demos/demo-fixed-1600x1200.webp"
  alt="Fixed size 800x600"
  width=800
  height=600
  layout="fixed"
/>

```marko
<image
  src="/images/demos/demo-fixed-1600x1200.webp"
  width=800
  height=600
  layout="fixed"
/>
```

### Fluid Layout

<div style="border: 2px dashed #e5e7eb; padding: 1rem; border-radius: 8px; background: #f9fafb;">
  <image
    src="/images/demos/demo-fluid-1800x900.webp"
    alt="Fluid landscape image"
    layout="fluid"
    placeholder="blur"
  />
</div>

```marko
<image src="/images/demos/demo-fluid-1800x900.webp" layout="fluid" placeholder="blur" />
```

### Circular Avatars

<div style="display: flex; gap: 1.5rem; align-items: center;">
  <image
    src="/images/demos/demo-avatar-1.webp"
    alt="Avatar 1"
    width=100
    height=100
    layout="fixed"
    style={ borderRadius: '50%',
      border: '3px solid white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }
  />
  <image
    src="/images/demos/demo-avatar-2.webp"
    alt="Avatar 2"
    width=120
    height=120
    layout="fixed"
    style={ borderRadius: '50%',
      border: '4px solid white',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }
  />
</div>

```marko
<image
  src="/images/demos/demo-avatar-1.webp"
  width=100
  height=100
  layout="fixed"
  style={ borderRadius: '50%',
    border: '3px solid white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }
/>
```

### Image Gallery

<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem;">
  <image
    src="/images/demos/demo-gallery-1.webp"
    alt="Gallery image 1"
    width=400
    height=300
    layout="fixed"
    style={ borderRadius: '8px' }
  />
  <image
    src="/images/demos/demo-gallery-2.webp"
    alt="Gallery image 2"
    width=400
    height=300
    layout="fixed"
    style={ borderRadius: '8px' }
  />
  <image
    src="/images/demos/demo-gallery-3.webp"
    alt="Gallery image 3"
    width=400
    height=300
    layout="fixed"
    style={ borderRadius: '8px' }
  />
  <image
    src="/images/demos/demo-gallery-4.webp"
    alt="Gallery image 4"
    width=400
    height=300
    layout="fixed"
    style={ borderRadius: '8px' }
  />
</div>

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | **required** | Image path or URL |
| `alt` | `string` | `''` | Alt text |
| `width` | `number` | `undefined` | Width in pixels |
| `height` | `number` | `undefined` | Height in pixels |
| `layout` | `'fixed' \| 'fluid' \| 'responsive'` | `'responsive'` | Layout mode |
| `loading` | `'lazy' \| 'eager'` | `'lazy'` | Loading strategy |
| `placeholder` | `'blur' \| 'none'` | `'none'` | Show blur placeholder |
| `class` | `string` | `undefined` | CSS class |
| `style` | `object` | `undefined` | Inline styles |

---
title: Image Component Demos
---

# Image Component - Live Demos

The `<image>` component provides responsive, optimized images.

## Fixed Layout Images

<image
  src="/images/demos/placeholder-800x600.svg"
  alt="Fixed size 800x600"
  width=800
  height=600
  layout="fixed"
/>

<image
  src="/images/demos/placeholder-400x300.svg"
  alt="Fixed size 400x300"
  width=400
  height=300
  layout="fixed"
/>

## Fluid Layout

<div style="border: 2px dashed #e5e7eb; padding: 1rem; border-radius: 8px; background: #f9fafb;">
  <image
    src="/images/demos/landscape.svg"
    alt="Fluid landscape"
    layout="fluid"
    placeholder="blur"
  />
</div>

## Circular Avatars

<div style="display: flex; gap: 1.5rem; align-items: center;">
  <image
    src="/images/demos/avatar-1.svg"
    width=100
    height=100
    layout="fixed"
    style={ borderRadius: '50%', border: '3px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }
  />
  <image
    src="/images/demos/avatar-2.svg"
    width=120
    height=120
    layout="fixed"
    style={ borderRadius: '50%', border: '4px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }
  />
  <image
    src="/images/demos/avatar-3.svg"
    width=150
    height=150
    layout="fixed"
    style={ borderRadius: '50%', border: '5px solid white', boxShadow: '0 6px 16px rgba(0,0,0,0.25)' }
  />
</div>

## Image Gallery

<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem;">
  <image
    src="/images/demos/gallery-1.svg"
    width=400
    height=300
    layout="fixed"
    style={ borderRadius: '8px' }
  />
  <image
    src="/images/demos/gallery-2.svg"
    width=400
    height=300
    layout="fixed"
    style={ borderRadius: '8px' }
  />
  <image
    src="/images/demos/gallery-3.svg"
    width=400
    height=300
    layout="fixed"
    style={ borderRadius: '8px' }
  />
  <image
    src="/images/demos/gallery-4.svg"
    width=400
    height=300
    layout="fixed"
    style={ borderRadius: '8px' }
  />
</div>

## Rounded with Shadow

<image
  src="/images/demos/placeholder-800x600.svg"
  width=600
  height=450
  layout="fixed"
  style={ borderRadius: '16px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    border: '4px solid white' }
/>

## Profile Card Example

<div style="display: flex; align-items: center; gap: 1.5rem; padding: 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; color: white;">
  <image
    src="/images/demos/avatar-1.svg"
    width=120
    height=120
    layout="fixed"
    style={ borderRadius: '50%',
      border: '4px solid white',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }
  />
  <div>
    <h2 style="margin: 0 0 0.5rem 0; font-size: 1.5rem;">John Doe</h2>
    <p style="margin: 0; opacity: 0.9;">Full Stack Developer</p>
  </div>
</div>

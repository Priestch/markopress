---
title: Image Component
description: Responsive, optimized images with the Image component - similar to Gatsby and Astro
order: 10
---

# Image Component

The `<image>` component provides responsive, optimized images similar to Gatsby's `GatsbyImage` and Astro's `Image`.

## Features

- **Responsive Images**: Automatic adaptation to different screen sizes
- **Layout Modes**: Fixed, fluid, and responsive layouts
- **Lazy Loading**: Built-in lazy loading for better performance
- **Blur Placeholder**: Smooth loading experience with blur placeholders
- **Error Handling**: Graceful fallback when images fail to load
- **Custom Styling**: Full control over appearance with CSS

## Layout Modes

### Fixed Layout

Fixed layout images maintain exact dimensions. Perfect for avatars and thumbnails.

<image
  src="/images/demos/placeholder-800x600.svg"
  alt="Fixed size 800x600"
  width=800
  height=600
  layout="fixed"
/>

```marko
<image
  src="/photo.jpg"
  width=800
  height=600
  layout="fixed"
/>
```

### Fluid Layout

Fluid images fill their container's width. Great for banners and hero images.

<div style="border: 2px dashed #e5e7eb; padding: 1rem; border-radius: 8px; background: #f9fafb;">
  <image
    src="/images/demos/landscape.svg"
    alt="Fluid landscape image"
    layout="fluid"
    placeholder="blur"
  />
</div>

```marko
<image src="/banner.jpg" layout="fluid" placeholder="blur" />
```

### Responsive Layout

Responsive images adapt to viewport size. Best for content images.

<image
  src="/images/demos/landscape.svg"
  alt="Responsive image"
  layout="responsive"
  placeholder="blur"
/>

```marko
<image src="/content.jpg" layout="responsive" placeholder="blur" />
```

## Custom Styling

### Rounded Corners

<image
  src="/images/demos/placeholder-400x300.svg"
  alt="Rounded image"
  width=400
  height=300
  layout="fixed"
  style={ borderRadius: '16px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }
/>

```marko
<image
  src="/photo.jpg"
  width=400
  height=300
  layout="fixed"
  style={ borderRadius: '16px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }
/>
```

### Circular Images

<div style="display: flex; gap: 1.5rem; align-items: center;">
  <image
    src="/images/demos/avatar-1.svg"
    alt="Avatar 1"
    width=100
    height=100
    layout="fixed"
    style={ borderRadius: '50%',
      border: '3px solid white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }
  />
  <image
    src="/images/demos/avatar-2.svg"
    alt="Avatar 2"
    width=120
    height=120
    layout="fixed"
    style={ borderRadius: '50%',
      border: '4px solid white',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }
  />
  <image
    src="/images/demos/avatar-3.svg"
    alt="Avatar 3"
    width=150
    height=150
    layout="fixed"
    style={ borderRadius: '50%',
      border: '5px solid white',
      boxShadow: '0 6px 16px rgba(0,0,0,0.25)' }
  />
</div>

```marko
<image
  src="/avatar.jpg"
  width=100
  height=100
  layout="fixed"
  style={ borderRadius: '50%',
    border: '3px solid white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }
/>
```

## Real-World Examples

### Image Gallery

<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem;">
  <image
    src="/images/demos/gallery-1.svg"
    alt="Gallery image 1"
    width=400
    height=300
    layout="fixed"
    style={ borderRadius: '8px' }
  />
  <image
    src="/images/demos/gallery-2.svg"
    alt="Gallery image 2"
    width=400
    height=300
    layout="fixed"
    style={ borderRadius: '8px' }
  />
  <image
    src="/images/demos/gallery-3.svg"
    alt="Gallery image 3"
    width=400
    height=300
    layout="fixed"
    style={ borderRadius: '8px' }
  />
  <image
    src="/images/demos/gallery-4.svg"
    alt="Gallery image 4"
    width=400
    height=300
    layout="fixed"
    style={ borderRadius: '8px' }
  />
</div>

### Profile Card

<div style="display: flex; align-items: center; gap: 1.5rem; padding: 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; color: white;">
  <image
    src="/images/demos/avatar-1.svg"
    alt="Profile picture"
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

### Blog Post Featured Image

<image
  src="/images/demos/landscape.svg"
  alt="Blog post featured image"
  layout="responsive"
  placeholder="blur"
  style={ borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }
/>
<p style="font-size: 0.875rem; color: #6b7280; margin-top: 0.5rem; font-style: italic;">Featured image for blog post</p>

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | **required** | Image path or URL |
| `alt` | `string` | `''` | Alt text for accessibility |
| `width` | `number` | `undefined` | Width in pixels |
| `height` | `number` | `undefined` | Height in pixels |
| `layout` | `'fixed' \| 'fluid' \| 'responsive'` | `'responsive'` | Layout mode |
| `loading` | `'lazy' \| 'eager'` | `'lazy'` | Loading strategy |
| `placeholder` | `'blur' \| 'none'` | `'none'` | Show blur placeholder |
| `class` | `string` | `undefined` | CSS class name |
| `style` | `object` | `undefined` | Inline styles object |

## Best Practices

1. **Always provide alt text** for accessibility
2. **Choose the right layout** for your use case
3. **Use lazy loading** for below-the-fold images
4. **Specify dimensions** to prevent layout shift
5. **Use appropriate placeholders** for large images

## Migration from Other SSGs

### From Gatsby

- Gatsby: `&lt;Img fluid={data.file.childImageSharp.fluid} /&gt;`
- MarkoPress: `&lt;image src=data.file.publicURL layout="fluid" /&gt;`

### From Astro

- Astro: `&lt;Image src={heroImage} alt="Hero" /&gt;`
- MarkoPress: `&lt;image src=heroImage.src alt="Hero" layout="responsive" /&gt;`

### From Next.js

- Next.js: `&lt;Image src="/photo.jpg" width={800} height={600} /&gt;`
- MarkoPress: `&lt;image src="/photo.jpg" width=800 height=600 layout="fixed" /&gt;`

## Future Enhancements

- [ ] Build-time image optimization with sharp
- [ ] Automatic srcset generation
- [ ] WebP/AVIF format support
- [ ] Real blur data URL generation
- [ ] Image CDN integrations

---

**Ready to use the Image component?** Start with the examples above!

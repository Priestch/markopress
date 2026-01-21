# Custom Tag Discovery in Marko - Complete Reference

## Overview

"Custom Tags in Marko allow for reusing markup across the application." The framework resolves tags through a prioritized discovery system with four distinct mechanisms.

## Resolution Priority

Tags are resolved in this specific order:

1. Local Variable Custom Tags
2. Relative Custom Tags
3. Installed Custom Tags
4. Supporting Files

## Local Variable Custom Tags

Tags beginning with uppercase letters prompt Marko to check for corresponding local variables. This mechanism enables importing custom tags that cannot be discovered automatically.

**Usage pattern:**
```marko
import MyTag from "./my-tag.marko"
<MyTag/>
```

Tags can also be defined using the `<define>` tag construct:
```marko
<define/MyTag|input: { name: string }| foo=1>
  <span>Hello ${input.name}</span>
</define>

<MyTag name="HTML"/>
```

Non-PascalCase variables require dynamic tag syntax: `<${camelCaseTag}/>`.

## Relative Custom Tags

When local variables don't resolve a tag, Marko searches the filesystem recursively upward for three patterns:

- `tags/TAG_NAME.marko`
- `tags/TAG_NAME/index.marko`
- `tags/TAG_NAME/TAG_NAME.marko`

**Example directory structure:**
```
tags/
  app-header.marko
  app-footer.marko
pages/
  about/
    tags/
      team-members.marko
    page.marko
  home/
    tags/
      home-banner.marko
    page.marko
```

The `pages/home/page.marko` file resolves `<app-header>`, `<app-footer>`, and `<home-banner>`. The `pages/about/page.marko` file resolves the first two plus `<team-members>`. Nested tag directories scope page-specific components appropriately.

## Installed Custom Tags

Packages providing Marko tags require a `marko.json` file specifying exported tag locations:

```json
{
  "exports": "./dist/tags"
}
```

This configuration exposes all tags directly under the designated directory. Libraries can maintain private tags within exported directories (e.g., `dist/tags/tags/`). When tag name collisions occur between packages, the first discovered package wins. Libraries are encouraged to use prefixes like `ebay-` to prevent conflicts.

## Supporting Files

Marko discovers associated `style` files and `marko-tag.json` metadata adjacent to `.marko` files:

```
foo.marko
foo.style.css
foo.marko-tag.json
```

For `index.marko` files, the prefix becomes optional:

```
tags/
  bar/
    index.marko
    style.css
  baz/
    index.marko
    marko-tag.json
```

Style files support any extension, enabling CSS preprocessors (`.less`, `.scss`).

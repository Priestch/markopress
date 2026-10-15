---
title: Home
---

# markopress spike

This page is `content/index.md`, rendered through a **generated** Marko route.
The HTML you are reading was inlined into a `+page.marko` wrapper by the
route generator, and the surrounding chrome comes from a generated
`+layout.marko`.

## What this proves

- `.md` files become routes without patching `@marko/run` internals
- frontmatter (`title`) and the markdown body both make it to the page
- the footer counter is interactive — Marko 6 resumability, no hydration code

CONTENTPROBE-77

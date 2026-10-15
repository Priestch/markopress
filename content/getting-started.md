---
title: Getting Started
---

## Create a page

Drop a `.md` file in `content/`. It becomes a route named after the file.
Nested files nest: `content/guide/install.md` would serve at
`/guide/install`.

## EDITED JUST NOW

Save the file and reload the browser — the dev watcher regenerates the route
wrapper, and `@marko/run`'s own watcher picks it up.

```js
// code fences survive the trip through marked
console.log("hello from markdown");
```

> Adding and *deleting* files in `content/` is the core thing this spike
> exists to validate.

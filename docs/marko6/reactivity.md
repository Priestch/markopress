# Marko Reactivity Reference - Complete Content

## Overview
Marko's reactivity system enables developers to build performant applications with rich client interactions by automatically tracking what needs updating and when. The system is built around the `<let>` tag as its core foundation.

## Reactive Variables

"Tag Variables, Tag Parameters, and `input` are all reactive" in Marko. The compiler tracks these values, ensuring dependent render expressions update automatically when changes occur.

## Render Expressions

Any template expression referencing reactive variables qualifies as reactive and updates alongside those variables. These expressions can appear in attributes, dynamic text, dynamic tag names, and script content.

**Important limitation:** Static statements (including `import`, `export`, `static`, `server` and `client`) evaluate only once when templates load—they're not reactive.

## Code Example Pattern

The documentation demonstrates a counter button:
- A `count` variable decrements via click handler
- Button text displays current count value
- Changes sync automatically without manual updates

## Scheduling Updates

Marko automatically batches changes for optimal performance:

- Updates queue after microtask execution
- Additional updates post-paint defer until next frame
- This prevents content blocking, infinite loops, and application lockups

The batching strategy also enables animation capabilities through the update loop, though CSS animations and Web Animations API are recommended alternatives.

## Contributors
Documentation maintained by DylanPiercey and LuLaValva, with community contributions welcome.

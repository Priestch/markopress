# Marko 5 Interop Guide - Complete Content

## Overview

The page addresses using multiple Marko versions simultaneously. Key points:

- **Marko 6 is not backward compatible** with Marko 5's Class API
- **Marko 5 is forward compatible**, allowing coexistence with Marko 6
- To use both versions together, ensure Marko 5 is installed at the project root
- The two versions have "interoperable but distinct" runtimes

## Core Incompatibility

Marko 5 uses the Class API, while current versions employ the Tags API. The compiler determines which runtime to use based on heuristics rather than version numbers.

## Tags/Class API Heuristics (Priority Order)

### 1. Directory Name
Files under `/tags` directories "must use the Tags API" since this directory structure is new to Marko 6. Marko 5 used `/components` for auto-discovered custom tags.

### 2. Comment Opt-In
Explicit API selection using comments like `// use class` or `<!-- use tags -->` can override other heuristics.

### 3. Class API Syntax Indicators
Files containing these features trigger Class API compilation:
- `class {}` blocks
- `style {}` blocks
- `$ scriptlet;` inline JavaScript
- Attribute arguments like `<button onClick("handleClick")>`
- Attribute modifiers (`:scoped`, `:no-update`)
- Legacy tags: `<await-reorderer>`, `<class>`, `<include-html>`, `<include-text>`, `<init-components>`, `<macro>`, `<module-code>`, `<while>`

### 4. Tags API Syntax Indicators
These features trigger Tags API compilation:
- Tag variables (`<div/var>`)
- Bind shorthand (`:=`)
- Modern tags: `<const>`, `<debug>`, `<define>`, `<id>`, `<let>`, `<lifecycle>`, `<log>`, `<return>`, `<try>`

### 5. Exclusive Tag Library
If only `/tags` directories exist without `/components` directories, ambiguous files default to Tags API.

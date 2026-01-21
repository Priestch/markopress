# Marko TypeScript Reference - Complete Content

## Overview
Marko's TypeScript support provides in-editor error checking, safer refactoring, data validation, and API design assistance.

## Enabling TypeScript

**Two approaches (non-exclusive):**

1. **Sites/Web Apps**: Add `tsconfig.json` at project root
2. **NPM Tag Packages**: Set `"script-lang": "ts"` in `marko.json`

The `marko.json` method allows directory-level opt-in/opt-out during incremental migrations.

## Typing Input Objects

### Basic Pattern
Export `Input` type or interface from `.marko` files to type the `input` object:

```typescript
export interface Input {
  currency: string;
  amount: number;
}
```

This `Input` becomes importable by other files.

### Generic Input Types
Type parameters work throughout templates (except static statements):

```typescript
export interface Input<T> {
  options: T[];
  onSelect: (newVal: T) => unknown;
}
```

Generic syntax: `<const/instanceFn(val: T) { /* can use T */ }>`

## Built-in Marko Types

**Key types from `Marko` namespace:**

- `Marko.Template<Input, Return>` — `.marko` file type
- `Marko.TemplateInput<Input>` — render method input object
- `Marko.Body<Params, Return>` — tag content typing
- `Marko.Renderable` — values accepted by `<${dynamic}/>`
- `Marko.Global` — `$global` object type
- `Marko.RenderResult` — render operation result
- `Marko.NativeTags` — all native tags and types
- `Marko.Input<TagName>`, `Marko.Return<TagName>` — extract tag types
- `Marko.AttrTag<T>` — attribute tag representation
- `Marko.BodyParameters<Body>`, `Marko.BodyReturnType<Body>` — body type extraction

**Deprecated:** `Marko.Component`, `Marko.Out`, `Marko.Emitter`

## Typing Content

Use `Marko.Body` for typed `input.content`:

```typescript
export interface Input {
  content?: Marko.Body;
}
```

Accepts text, nested components, or any combination.

### Tag Parameters
Content can receive typed parameters:

```typescript
export interface Input {
  to: number;
  content: Marko.Body<[number]>
}
```

## Typing Attribute Tags

Wrap attribute tag inputs in `Marko.AttrTag`:

```typescript
export interface Input {
  option: Marko.AttrTag<Marko.HTML.Option>
}
```

## Native Tag Extensions

Extend native HTML tag types via `Marko.HTML` namespace:

```typescript
export interface Input extends Marko.HTML.Button {
  color: string;
}
```

### Registering Custom Elements

```typescript
declare global {
  namespace Marko {
    interface NativeTags {
      "my-custom-element": MyCustomElementAttributes;
    }
  }
}
```

### Global HTML Attributes

```typescript
declare global {
  namespace Marko {
    interface HTMLAttributes {
      "my-non-standard-attribute"?: string;
    }
  }
}
```

### CSS Properties

```typescript
declare global {
  namespace Marko {
    namespace CSS {
      interface Properties {
        "--foo"?: string;
      }
    }
  }
}
```

## TypeScript Syntax in `.marko` Files

- **Type assertions**: `${(input.el as HTMLInputElement).value}`
- **Tag type parameters**: `<child <T>|value: T|>`
- **Tag type arguments**: `<child<number> value=1/>`
- **Method shorthand**: `<child process<T>() { /* ... */ }/>`
- **Attribute assertions**: `<component number=1 as const/>`

## JSDoc Support

For incremental typing without full TypeScript:

1. Add `// @ts-check` comment at file top
2. Use `jsconfig.json` for project-wide checking
3. Add `// @ts-nocheck` to skip specific files

Example:
```javascript
// @ts-check
/**
 * @typedef {{
 *   firstName: string,
 *   lastName: string,
 * }} Input
 */
```

## CI Type Checking

Use `@marko/type-check` CLI for editor-external type validation.

## Performance Profiling

Use `--generateTrace TRACE_DIR` flag to identify resource-intensive type checking areas.

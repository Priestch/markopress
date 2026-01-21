# Marko Core Tags Reference

## Control Flow Tags

### `<if>` / `<else>`
Conditionally displays content when expressions are truthy. Chains multiple conditions with `<else if=EXPRESSION>` and fallback `<else>`. "Expressions in the if/else chain are evaluated in order."

### `<for>`
Iterates over collections with multiple modes:
- **Arrays/Iterables**: `of=` attribute with parameters `|item, index|`
- **Objects**: `in=` attribute with `|key, value|` parameters
- **Exclusive ranges**: `until=`, `from=`, `step=` attributes (0-4 example)
- **Inclusive ranges**: `to=`, `from=`, `step=` attributes (0-5 example)

Includes `by=` attribute for state preservation during reordering, accepting functions or string property names.

## State Management Tags

### `<let>`
Introduces mutable state through tag variables. Updates trigger reactivity downstream. "When a tag variable is updated, everywhere it is used also re-runs."

**Controllable variant**: Uses `valueChange=` handler for intercepting state changes or parent-child synchronization.

### `<const>`
Exposes derived data through tag variables. Re-initializes per component instance. Conceptually equivalent to `<return>`ing its value.

### `<return>`
Allows custom tags to expose tag variables. Supports `valueChange=` for assignable return values with transformation capability.

## Styling & Scripting Tags

### `<style>`
Bundled and loaded once regardless of render frequency. Supports preprocessors via extensions (`.scss`, `.less`). Enables CSS Modules via tag variables.

### `<script>`
Executes after rendering and re-runs when referenced tag variables/parameters change. "Runs in the browser for each instance of this tag."

## Template Organization

### `<define>`
Creates reusable markup snippets. Tag variable reflects provided attributes including content.

### `<lifecycle>`
Synchronizes side effects with lifecycle hooks: `onMount()`, `onUpdate()`, `onDestroy()`. Maintains consistent `this` context across lifetime.

## Utility Tags

### `<id>`
Exposes unique ID string compatible with HTML id and aria attributes. Accepts optional `value=` override.

### `<log>`
Performs `console.log` of `value=` attribute, re-executing on updates.

### `<debug>`
Injects debugger statements for development inspection. Optional `value=` triggers on changes.

### `<await>`
Unwraps promises, exposing results through tag parameters. Integrates with `<try>` for loading states.

### `<try>`
Catches runtime errors and manages async boundaries:
- **`@catch`**: Handles errors, exposes error object
- **`@placeholder`**: Shows content while `<await>` pending

## HTML Tags

### `<html-comment>`
Outputs literal HTML comments. Exposes comment node getter as tag variable.

### `<html-script>` & `<html-style>`
Vanilla versions of enhanced `<script>`/`<style>` tags for specialized use cases. "Should _almost never_ be used" over their enhanced counterparts.

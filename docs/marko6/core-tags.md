# Marko Core Tags Reference

## Control Flow Tags

### `<if>` / `<else>`
Conditionally displays content when expressions are truthy. Chains multiple conditions with `<else if=EXPRESSION>` and fallback `<else>`. "Expressions in the if/else chain are evaluated in order."

**Important:** The `<else>` tag must immediately follow its corresponding `</if>` closing tag. Any content between `</if>` and `<else>` will cause a parsing error:

```marko
<!-- ❌ WRONG: Content between </if> and <else> -->
<if=condition>
  <div>Content</div>
</if>
<!-- This comment breaks the if-else chain! -->
<else>
  <div>Alternative</div>
</else>

<!-- ✅ CORRECT: <else> directly follows </if> -->
<if=condition>
  <div>Content</div>
</if>
<else>
  <div>Alternative</div>
</else>

<!-- ✅ ALTERNATIVE: Use separate if blocks with negated condition -->
<if=condition>
  <div>Content</div>
</if>
<if=!condition>
  <div>Alternative</div>
</if>
```

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
Bundled and loaded once regardless of render frequency. Supports preprocessors via extensions (`.scss`, `.less`).

#### CSS Modules

Use `<style/styles>` to enable CSS Modules via tag variables:

```marko
<style/styles>
  .foo { border: 1px solid red }
  .bar { background: green }
</style>

<div class=styles.foo/>
<div class=[styles.foo, styles.bar]/>
<div class={[styles.bar]: true}/>
<div class=styles.foo/>
```

**Conditional Classes with CSS Modules:**

Conditional class syntax like `class={[styles.foo, styles.bar: condition]}` does NOT work with CSS module references. The `:` conditional syntax only works with string literal class names, not expressions like `styles.foo`.

To conditionally apply CSS module classes, pre-compute the class value using `<let>`:

```marko
<style/styles>
  .base { border: 1px solid gray }
  .active { border-color: blue }
  .disabled { opacity: 0.5 }
</style>

<!-- ❌ WRONG: Conditional syntax with CSS modules -->
<div class=[styles.base, styles.active: isActive]/>

<!-- ✅ CORRECT: Pre-compute with <let> -->
<let/divClass=isActive ? styles.base + ' ' + styles.active : styles.base + ' ' + styles.disabled/>
<div class=divClass/>

<!-- ✅ CORRECT: For simple cases, use separate if blocks -->
<if=isActive>
  <div class=[styles.base, styles.active]/>
</if>
<if=!isActive>
  <div class=[styles.base, styles.disabled]/>
</if>
```

### `<script>`
Executes after rendering and re-runs when referenced tag variables/parameters change. "Runs in the browser for each instance of this tag."

## Module-Level Statements

### `static`
Statements prefixed with `static` allow running JavaScript expressions in module scope. The statements will run when the template is loaded on the server and in the browser.

```marko
static const answer = 41
static function getAnswer() {
  return answer + 1;
}

<div data-answer=getAnswer()/>
```

All valid JavaScript statements are allowed, including functions, declarations, conditions, and blocks.

```marko
static {
  console.log("this will be logged only ONE time");
  console.log("no matter how often the component is used");
  console.log("or how many requests are made to the server");
}
```

### `server` / `client`
As an alternative to `static`, statements prefixed with `server` or `client` allow arbitrary module-scoped JavaScript expressions that are exclusively executed when the template is loaded in a specific environment (the server or the browser).

```marko
server console.log("on the server")
client console.log("in the browser")
```

All valid JavaScript statements are allowed, including functions, declarations, conditions, and blocks.

```marko
server {
  import { connectToDatabase } from './database';
  const db = connectToDatabase();
  console.log('Database connection established on server');

  // Only happens ONCE, when the application loads
  // and this component is used for the first time
  const users = await db.query('SELECT * FROM users');
  console.log(`Found ${users.length} users in the database`);
}
```

**Tip:** The `import` statement is really a shortcut for `static import`. This can be leveraged with `server` and `client` if you want a module to only be imported on one platform:

```marko
server import "./init-db"
client import "bootstrap"
```

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

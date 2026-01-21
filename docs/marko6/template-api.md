# Marko Template API Reference - Complete Content

## Template.render(input)

**Purpose:** Server-side HTML string generation API

**Parameter:**
- `input` (default: `{}`): The input object for the template, may include `$global` for global state

### Async Iterator
Allows consumption via `for await` statement for streaming HTML chunks:

```javascript
import Template from "./template.marko";

for await (const chunk of Template.render({})) {
  // send the html chunk somewhere.
}
```

### Pipe Method
Sends HTML string into a NodeJS `stream.Writable`:

```javascript
import Template from "./template.marko";
import http from "node:http";

http
  .createServer((req, res) => {
    Template.render({}).pipe(res);
  })
  .listen(3000);
```

### ReadableStream
Returns a WHATWG ReadableStream via `.toReadable()` method:

```javascript
const webHTMLResponse = new Response(Template.render({}).toReadable(), {
  headers: { "content-type": "text/html" },
});
```

### Thenable
Render result is thenable, returning `Promise<string>` with buffered HTML:

```javascript
const html = await Template.render({});
```

**Note:** Using thenable/await opts out of streaming capabilities.

#### toString()
Returns buffered HTML synchronously if possible:

```javascript
const html = Template.render({}).toString();
```

**Caution:** Throws if async behavior exists (e.g., `<await>` tag).

---

## Template.mount(input, node, position?)

**Purpose:** Browser/client-side reactive DOM building and insertion

**Parameters:**
- `input` (default: `{}`): Input object for template
- `node` (required): DOM node reference for rendering
- `position` (default: `"beforeend"`): Insertion location following `Element.insertAdjacentHTML` API

### Valid Position Values
- `"beforebegin"`: Before the element
- `"afterbegin"`: Inside, before first child
- `"beforeend"`: Inside, after last child (default)
- `"afterend"`: After the element

### Usage Examples

```javascript
template.mount({}, document.body); // append to body
template.mount({}, document.body, "afterbegin"); // prepend to body
```

### Render Result Object

Returns object with helpers for updating and destroying template instances:

```javascript
const instance = template.mount({ name: "foo" }, document.body);
```

**Warning:** Not recommended for production use; reactive system preferred.

#### instance.update(input)
Applies new input with reactive updates (synchronous):

```javascript
instance.update({ name: "bar" });
```

#### instance.destroy()
Aborts all signals and runs cleanup:

```javascript
instance.destroy();
```

---

## input.$global

Passed via render/mount APIs to strip off and use as global state across templates.

### $global.signal
Type: `AbortSignal | undefined`

Marko listens and auto-cleans async activity when aborted, preventing rendering continuation after request abort.

### $global.cspNonce
Type: `string | undefined`

Valid CSP nonce string applied automatically to all assets (`<script>`, `<style>`, etc).

### $global.renderId
Type: `string | undefined`

Isolates distinct server renders using same runtime; not automatically set but should be unique per server-rendered segment.

### $global.runtimeId
Type: `string | undefined`

Isolates multiple runtime copies on same page; automatically provided by `@marko/vite` and `@marko/webpack` plugins based on project package.json name.

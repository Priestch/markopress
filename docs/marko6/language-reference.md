# Marko Language Reference - Complete Content

## Overview
Marko is a superset of well-formed HTML that combines JavaScript syntax with HTML while adding control flow and reactive data bindings. "Most HTML is valid Marko but there are some important deviations."

## Core Template Variables

**input**: A globally available JavaScript object in templates providing access to attributes from custom tags or data passed through the top-level API.

**$signal**: An AbortSignal available in all JavaScript statements and expressions. It aborts when expressions are invalidated or when template/tag content is removed from the DOM, primarily handling cleanup of side effects.

**$global**: Provides access to render globals supplied through the top-level API.

## Module-Level Statements

**import**: Standard JavaScript import statements allowed at template root, with special support for custom tag discovery using angle bracket syntax: `import MyTag from "<my-tag>"`

**export**: JavaScript export statements permitted at template root for exposing functions and variables.

**static**: Module-scoped JavaScript expressions executing once when templates load, regardless of component usage frequency or server requests.

**server/client**: Alternative to static, allowing platform-specific code execution. Server code runs only on the server; client code only in browsers.

## Tags and Attributes

Tags support all native HTML/SVG elements plus Marko-specific core tags and custom tags. Tags can be self-closed: `<div/>` is valid unlike standard HTML.

Attribute values are JavaScript expressions: `<my-tag str="Hello" num=1+1 date=new Date()/>`. Nearly all valid JavaScript expressions work as attribute values, though unenclosed `>` requires parentheses.

### Attribute Shorthands

**Skipped Attributes**: Values of `null`, `undefined`, or `false` are omitted from HTML output (though `0`, `NaN`, and `""` render normally).

**Boolean Attributes**: HTML boolean attributes become JavaScript booleans. ARIA enumerated attributes require string values to avoid outputting empty strings.

**Spread Attributes**: Dynamically include attributes via spread syntax: `<my-tag ...input foo="bar"/>`. Attributes merge left-to-right with later values overriding earlier ones.

**Shorthand Methods**: Concise function definition syntax for event handlers: `<button onClick(e) { console.log(e.target) }>Click Me</button>`

**Change Handlers (Two-Way Binding)**: The `:=` operator provides both value and change handler: `<counter value:=count/>` desugars to `<counter value=count valueChange(newCount) { count = newCount }>`

**class/id Shorthands**: Emmet-style syntax supported: `<div#foo.bar.baz/>` equals `<div id="foo" class="bar baz"/>`

**value Shorthand**: Omit attribute name for single input property: `<my-tag=1/>` becomes `<my-tag value=1/>`

**Attribute Termination**: Commas can terminate attributes, useful in multiline scenarios. Sequence expressions with comma operators require parentheses.

## Tag Content and Dynamic Text

Content within tag bodies becomes the `content` property of input. Dynamic text uses template literal syntax: `<div>Hello ${input.name}</div>`. Interpolated values are automatically escaped for XSS prevention.

## Attribute Tags

Tags prefixed with `@` pass as attributes alongside normal attributes rather than rendering. They enable passing named or repeated content: `<my-layout><@header class="foo">Content</@header></my-layout>`

Attribute tags can be nested within other attribute tags. When multiple attribute tags share names, all instances are consumed via iterable protocol, accessible through `Symbol.iterator`.

Control flow tags enable conditional and repeated attribute tags through `<if>` and `<for>` structures.

## Tag Variables

Tag variables expose values from tags using `/` syntax: `<my-tag/foo/>` or destructured: `<my-other-tag/{ bar, baz }/>`. Native tags implicitly return element references: `<div/myDiv/>`. Variables are automatically hoisted and accessible anywhere except module statements.

Custom tags can return values via the `<return>` core tag.

## Tag Parameters and Arguments

Child components pass information back to parents via tag parameters in pipes: `<child|params|>Content</child>`. Parameters function like JavaScript function parameters, supporting destructuring.

Tag Arguments use JavaScript spread syntax: `<${input.content}(1, 2, 3)/>`, passing multiple arguments back to parents. "Tag content may use attributes _or_ arguments, but not both at once."

Parameters scope to tag content only and cannot be accessed by attribute tags.

## Comments

Both HTML comments (`<!-- comment -->`) and JavaScript comments (`//` and `/** */`) are supported and completely ignored in output. To include literal HTML comments, use the `<html-comment>` core tag.

## Dynamic Tags

Interpolations can replace tag names to dynamically output native tags, custom tags, or tag content. String values render as native tags: `<${"h" + input.headingSize}>Hello!</>`. Custom tags require references to the actual component.

When dynamic tag names are falsy, only content outputs, enabling conditional parenting: `<${input.href && "a"} href=input.href>Hello World</>`

PascalCase variable names function as tag names without explicit dynamic syntax: `<MyTag/>` equals `<${MyTag}/>`

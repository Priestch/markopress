# Marko Concise Syntax Reference

## Overview

Marko's concise syntax removes angle brackets and uses indentation-based nesting. "All Marko files are in concise mode by default, and switch to HTML mode once there is a tag that uses the HTML syntax."

**Example comparison:**
```
div class="thumbnail"
    img src="https://example.com/thumb.png"

// identical to

<div class="thumbnail"><img src="https://example.com/thumb.png" /></div>
```

## Attributes on Multiple Lines

Attributes support comma separation across multiple lines. This pattern enables flexible formatting:

```
div id="hello", class=["class1", "class2", "class3"], style={ border: "1px solid red" }
```

Commas signal additional attributes are expected, allowing line breaks:

```
div id="hello" class="world",
  style={ border: "1px solid red" }
```

Best practice places commas at line beginnings for improved readability:

```
div
  ,id="hello"
  ,class=["class1", "class2", "class3"]
  ,style={ border: "1px solid red" }
  -- hello
```

## Text Content

Two or more hyphens (`--`) followed by whitespace initiate content. Single-line text terminates at end of line:

```
-- Hello world
div -- Hello world
```

Multi-line text uses matching hyphens as delimiters or terminates at dedentation:

```
--
This is
a bunch of
text at the
root of
the tag
--
```

Nested tags can include HTML Mode syntax:

```
details
  --
  since this is normal tag content,
  regular <strong>HTML Mode</strong>
  tags may be used freely.
  --
  summary --
    This content is
    implicitly closed
```

**Note:** Hyphen counts in opening and closing tags must match. Additional hyphens work when necessary.

## Root Level Text

The parser begins in concise mode, causing bare text to create tags:

```
Hello World
Welcome to Marko
```

Produces unwanted tag output. The solution uses code fences:

```
-- Welcome to Marko
```

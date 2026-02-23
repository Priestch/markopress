---
title: "Syntax Highlighting Test"
description: "Testing Shiki code highlighting"
---

# Syntax Highlighting Test

This page tests Shiki syntax highlighting.

## JavaScript

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
  return true;
}

greet('MarkoPress');
```

## TypeScript

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const user: User = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com'
};
```

## Python

```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(factorial(5))
```

## Bash

```bash
#!/bin/bash
echo "Hello from Bash!"
for file in *.md; do
  echo "Processing $file"
done
```

## JSON

```json
{
  "name": "markopress",
  "version": "0.1.0",
  "features": ["markdown", "syntax-highlighting", "ssg"]
}
```

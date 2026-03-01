# Head Injection Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a type-safe plugin for injecting scripts, links, and meta tags into the `<head>` section via declarative configuration.

**Architecture:** Built-in plugin that transforms typed head tag config into Marko-compatible format, injects data via `$global` in the config hook, and renders through theme extension points (`<theme-head-top/>` and `<theme-head-bottom/>`).

**Tech Stack:** TypeScript, Marko.js, Vitest, Zod (validation)

---

## Task 1: Create Type Definitions

**Files:**
- Create: `src/plugins/head-inject/types.ts`

**Step 1: Write type definitions file**

```typescript
/**
 * Head injection plugin types
 * Type-safe definitions for head tags with configurable positioning
 */

export type HeadTag = MetaTag | LinkTag | ScriptTag | BaseTag;

export interface BaseHeadTag {
  /** Position in head: 'top' for <theme-head-top/>, 'bottom' for <theme-head-bottom/> */
  position?: 'top' | 'bottom';
}

// Meta tags: <meta name="..." content="...">
export interface MetaTag extends BaseHeadTag {
  type: 'meta';
  name?: string;
  property?: string;     // For Open Graph (og:*, twitter:card)
  httpEquiv?: string;    // For http-equiv="refresh", etc.
  content: string;
  charset?: string;      // For <meta charset="UTF-8">
}

// Link tags: <link rel="..." href="...">
export interface LinkTag extends BaseHeadTag {
  type: 'link';
  rel: string;
  href: string;
  as?: string;          // For preconnect/prefetch (script, style, font)
  type?: string;        // MIME type
  media?: string;       // Media query
  sizes?: string;       // For icons
  crossorigin?: 'anonymous' | 'use-credentials';
  integrity?: string;   // SRI hash
  disabled?: boolean;
  title?: string;      // For alternate stylesheets
}

// Script tags: <script src="..."> or <script>content</script>
export interface ScriptTag extends BaseHeadTag {
  type: 'script';
  src?: string;         // External script (mutually exclusive with content)
  content?: string;     // Inline script
  async?: boolean;
  defer?: boolean;
  type?: string;        // module, text/javascript, etc.
  crossorigin?: 'anonymous' | 'use-credentials';
  integrity?: string;   // SRI hash
  nonce?: string;       // CSP nonce
}

// Base tag: <base href="...">
export interface BaseTag extends BaseHeadTag {
  type: 'base';
  href: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
}

// Renderable format for Marko templates: [tagName, attributesObject]
export type RenderableHeadTag = [string, Record<string, unknown>];

// Grouped tags by position
export interface GroupedHeadTags {
  headTop: RenderableHeadTag[];
  headBottom: RenderableHeadTag[];
}
```

**Step 2: Commit**

```bash
git add src/plugins/head-inject/types.ts
git commit -m "feat(head-inject): add type definitions for head tags"
```

---

## Task 2: Create Validator

**Files:**
- Create: `src/plugins/head-inject/validator.ts`
- Test: `src/plugins/head-inject/validator.test.ts`

**Step 1: Write failing validator tests**

```typescript
import { describe, it, expect } from 'vitest';
import { validateHeadTag, validateHeadConfig } from './validator.js';
import type { HeadTag } from './types.js';

describe('validateHeadTag', () => {
  it('should validate a valid meta tag', () => {
    const tag: HeadTag = { type: 'meta', name: 'description', content: 'Test' };
    expect(() => validateHeadTag(tag)).not.toThrow();
  });

  it('should validate a valid link tag', () => {
    const tag: HeadTag = { type: 'link', rel: 'stylesheet', href: '/style.css' };
    expect(() => validateHeadTag(tag)).not.toThrow();
  });

  it('should validate a valid script tag with src', () => {
    const tag: HeadTag = { type: 'script', src: '/script.js' };
    expect(() => validateHeadTag(tag)).not.toThrow();
  });

  it('should validate a valid script tag with content', () => {
    const tag: HeadTag = { type: 'script', content: 'console.log("hi");' };
    expect(() => validateHeadTag(tag)).not.toThrow();
  });

  it('should reject meta tag without content', () => {
    const tag: HeadTag = { type: 'meta', name: 'description' };
    expect(() => validateHeadTag(tag)).toThrow('content');
  });

  it('should reject meta tag without any identifier', () => {
    const tag: HeadTag = { type: 'meta', content: 'test' };
    expect(() => validateHeadTag(tag)).toThrow('name|property|httpEquiv|charset');
  });

  it('should reject link tag without rel', () => {
    const tag: HeadTag = { type: 'link', href: '/style.css' };
    expect(() => validateHeadTag(tag)).toThrow('rel');
  });

  it('should reject link tag without href', () => {
    const tag: HeadTag = { type: 'link', rel: 'stylesheet' };
    expect(() => validateHeadTag(tag)).toThrow('href');
  });

  it('should reject script tag with both src and content', () => {
    const tag: HeadTag = { type: 'script', src: '/script.js', content: 'console.log("hi");' };
    expect(() => validateHeadTag(tag)).toThrow('mutually exclusive');
  });

  it('should reject script tag without src or content', () => {
    const tag: HeadTag = { type: 'script' };
    expect(() => validateHeadTag(tag)).toThrow('src or content');
  });

  it('should reject base tag without href', () => {
    const tag: HeadTag = { type: 'base' };
    expect(() => validateHeadTag(tag)).toThrow('href');
  });

  it('should reject invalid position', () => {
    const tag: HeadTag = { type: 'meta', name: 'test', content: 'test', position: 'middle' as any };
    expect(() => validateHeadTag(tag)).toThrow('position');
  });
});

describe('validateHeadConfig', () => {
  it('should pass valid config', () => {
    const config: HeadTag[] = [
      { type: 'meta', name: 'description', content: 'Test' },
      { type: 'link', rel: 'icon', href: '/favicon.ico' }
    ];
    expect(() => validateHeadConfig(config)).not.toThrow();
  });

  it('should reject multiple base tags', () => {
    const config: HeadTag[] = [
      { type: 'base', href: 'https://example.com' },
      { type: 'base', href: 'https://other.com' }
    ];
    expect(() => validateHeadConfig(config)).toThrow('Only one');
  });

  it('should reject old array format', () => {
    const config = [['meta', { name: 'test' }]] as any;
    expect(() => validateHeadConfig(config)).toThrow('object with type');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/gp/Projects/markopress/packages/markopress/.worktrees/head-inject-plugin
pnpm vitest run src/plugins/head-inject/validator.test.ts
```

Expected: FAIL with "Cannot find module './validator.js'"

**Step 3: Implement validator**

```typescript
import type { HeadTag, MetaTag, LinkTag, ScriptTag, BaseTag } from './types.js';

class ValidationError extends Error {
  constructor(tagType: string, message: string) {
    super(`[head-inject] ${tagType} tag: ${message}`);
    this.name = 'ValidationError';
  }
}

export function validateHeadTag(tag: HeadTag): void {
  // Validate position
  if (tag.position && !['top', 'bottom'].includes(tag.position)) {
    throw new ValidationError(tag.type, `Invalid position '${tag.position}', must be 'top' or 'bottom'`);
  }

  switch (tag.type) {
    case 'meta':
      validateMetaTag(tag);
      break;
    case 'link':
      validateLinkTag(tag);
      break;
    case 'script':
      validateScriptTag(tag);
      break;
    case 'base':
      validateBaseTag(tag);
      break;
    default:
      throw new ValidationError('unknown', `Unknown tag type '${(tag as any).type}'`);
  }
}

function validateMetaTag(tag: MetaTag): void {
  if (!tag.content) {
    throw new ValidationError('meta', 'Missing required attribute: content');
  }
  const hasIdentifier = tag.name || tag.property || tag.httpEquiv || tag.charset;
  if (!hasIdentifier) {
    throw new ValidationError('meta', 'Must have one of: name, property, httpEquiv, or charset');
  }
}

function validateLinkTag(tag: LinkTag): void {
  if (!tag.rel) {
    throw new ValidationError('link', 'Missing required attribute: rel');
  }
  if (!tag.href) {
    throw new ValidationError('link', 'Missing required attribute: href');
  }
}

function validateScriptTag(tag: ScriptTag): void {
  const hasSrc = tag.src !== undefined;
  const hasContent = tag.content !== undefined;

  if (!hasSrc && !hasContent) {
    throw new ValidationError('script', 'Must have either src or content');
  }
  if (hasSrc && hasContent) {
    throw new ValidationError('script', 'src and content are mutually exclusive');
  }
}

function validateBaseTag(tag: BaseTag): void {
  if (!tag.href) {
    throw new ValidationError('base', 'Missing required attribute: href');
  }
}

export function validateHeadConfig(config: unknown[]): void {
  // Check for old array format
  if (config.length > 0 && Array.isArray(config[0])) {
    throw new Error('[head-inject] Invalid config format. Head tags must be objects with a "type" property, not arrays. See documentation for the new format.');
  }

  // Check for multiple base tags
  let baseCount = 0;
  for (const tag of config) {
    if (typeof tag !== 'object' || tag === null) {
      throw new Error('[head-inject] Invalid head tag: must be an object');
    }
    if ((tag as HeadTag).type === 'base') {
      baseCount++;
    }
  }

  if (baseCount > 1) {
    throw new Error('[head-inject] Only one <base> tag is allowed per page');
  }

  // Validate each tag
  for (const tag of config as HeadTag[]) {
    validateHeadTag(tag);
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/plugins/head-inject/validator.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/head-inject/validator.ts src/plugins/head-inject/validator.test.ts
git commit -m "feat(head-inject): add head tag validation"
```

---

## Task 3: Create Transformer

**Files:**
- Create: `src/plugins/head-inject/transformer.ts`
- Test: `src/plugins/head-inject/transformer.test.ts`

**Step 1: Write failing transformer tests**

```typescript
import { describe, it, expect } from 'vitest';
import { transformHeadConfig } from './transformer.js';
import type { HeadTag } from './types.js';

describe('transformHeadConfig', () => {
  it('should transform meta tag to renderable format', () => {
    const config: HeadTag[] = [
      { type: 'meta', name: 'description', content: 'Test site' }
    ];
    const result = transformHeadConfig(config);
    expect(result.headBottom).toEqual([['meta', { name: 'description', content: 'Test site' }]]);
    expect(result.headTop).toEqual([]);
  });

  it('should transform link tag to renderable format', () => {
    const config: HeadTag[] = [
      { type: 'link', rel: 'stylesheet', href: '/style.css' }
    ];
    const result = transformHeadConfig(config);
    expect(result.headBottom).toEqual([['link', { rel: 'stylesheet', href: '/style.css' }]]);
  });

  it('should transform script tag with src', () => {
    const config: HeadTag[] = [
      { type: 'script', src: '/script.js', async: true }
    ];
    const result = transformHeadConfig(config);
    expect(result.headBottom).toEqual([['script', { src: '/script.js', async: true }]]);
  });

  it('should transform script tag with content', () => {
    const config: HeadTag[] = [
      { type: 'script', content: 'console.log("hi");' }
    ];
    const result = transformHeadConfig(config);
    expect(result.headBottom).toEqual([['script', { 'text': 'console.log("hi");' }]]);
  });

  it('should place tags with position: top in headTop', () => {
    const config: HeadTag[] = [
      { type: 'meta', name: 'viewport', content: 'width=device-width', position: 'top' },
      { type: 'meta', name: 'description', content: 'Test' }
    ];
    const result = transformHeadConfig(config);
    expect(result.headTop).toHaveLength(1);
    expect(result.headBottom).toHaveLength(1);
  });

  it('should handle mixed positions', () => {
    const config: HeadTag[] = [
      { type: 'link', rel: 'preconnect', href: 'https://fonts.googleapis.com', position: 'top' },
      { type: 'script', src: '/analytics.js', position: 'top', async: true },
      { type: 'link', rel: 'stylesheet', href: '/style.css' }
    ];
    const result = transformHeadConfig(config);
    expect(result.headTop).toHaveLength(2);
    expect(result.headBottom).toHaveLength(1);
  });

  it('should filter out undefined attributes', () => {
    const config: HeadTag[] = [
      { type: 'link', rel: 'stylesheet', href: '/style.css', as: undefined }
    ];
    const result = transformHeadConfig(config);
    expect(result.headBottom[0][1]).not.toHaveProperty('as');
  });

  it('should handle boolean attributes correctly', () => {
    const config: HeadTag[] = [
      { type: 'script', src: '/script.js', async: true, defer: false }
    ];
    const result = transformHeadConfig(config);
    expect(result.headBottom[0][1]).toEqual({ src: '/script.js', async: true });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/plugins/head-inject/transformer.test.ts
```

Expected: FAIL with "Cannot find module './transformer.js'"

**Step 3: Implement transformer**

```typescript
import type { HeadTag, RenderableHeadTag, GroupedHeadTags } from './types.js';

/**
 * Transform typed head tag config to Marko-compatible renderable format
 */
export function transformHeadConfig(config: HeadTag[]): GroupedHeadTags {
  const headTop: RenderableHeadTag[] = [];
  const headBottom: RenderableHeadTag[] = [];

  for (const tag of config) {
    const position = tag.position || 'bottom';
    const target = position === 'top' ? headTop : headBottom;
    target.push(transformTag(tag));
  }

  return { headTop, headBottom };
}

/**
 * Transform a single head tag to renderable format
 */
function transformTag(tag: HeadTag): RenderableHeadTag {
  switch (tag.type) {
    case 'meta':
      return transformMetaTag(tag);
    case 'link':
      return transformLinkTag(tag);
    case 'script':
      return transformScriptTag(tag);
    case 'base':
      return transformBaseTag(tag);
  }
}

function transformMetaTag(tag: HeadTag): RenderableHeadTag {
  const { type, position, ...attrs } = tag as any;
  return ['meta', filterUndefined(attrs)];
}

function transformLinkTag(tag: HeadTag): RenderableHeadTag {
  const { type, position, ...attrs } = tag as any;
  return ['link', filterUndefined(attrs)];
}

function transformScriptTag(tag: HeadTag): RenderableHeadTag {
  const { type, position, src, content, ...attrs } = tag as any;

  // Inline scripts use text attribute in Marko
  if (content) {
    return ['script', { ...filterUndefined(attrs), text: content }];
  }
  return ['script', filterUndefined({ src, ...attrs })];
}

function transformBaseTag(tag: HeadTag): RenderableHeadTag {
  const { type, position, ...attrs } = tag as any;
  return ['base', filterUndefined(attrs)];
}

/**
 * Remove undefined values from attributes object
 */
function filterUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/plugins/head-inject/transformer.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/head-inject/transformer.ts src/plugins/head-inject/transformer.test.ts
git commit -m "feat(head-inject): add head tag transformer"
```

---

## Task 4: Create Plugin Entry Point

**Files:**
- Create: `src/plugins/head-inject/index.ts`
- Test: `src/plugins/head-inject/index.test.ts`

**Step 1: Write failing plugin tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { headInjectPlugin } from './index.js';
import type { ResolvedConfig } from '../../config/types.js';

describe('headInjectPlugin', () => {
  it('should have correct plugin name', () => {
    expect(headInjectPlugin.name).toBe('head-inject');
  });

  it('should have config hook', () => {
    expect(headInjectPlugin.config).toBeInstanceOf(Function);
  });

  it('should transform head config and store grouped tags', () => {
    const config = {
      site: {
        title: 'Test',
        head: [
          { type: 'meta', name: 'description', content: 'Test', position: 'top' },
          { type: 'link', rel: 'icon', href: '/favicon.ico' }
        ]
      }
    } as any;

    const result = headInjectPlugin.config!(config);

    expect((result as any)._headInject).toBeDefined();
    expect((result as any)._headInject.headTop).toHaveLength(1);
    expect((result as any)._headInject.headBottom).toHaveLength(1);
  });

  it('should handle empty head config', () => {
    const config = {
      site: { title: 'Test' }
    } as any;

    const result = headInjectPlugin.config!(config);
    expect((result as any)._headInject).toBeUndefined();
  });

  it('should validate head config', () => {
    const config = {
      site: {
        title: 'Test',
        head: [{ type: 'link', rel: 'icon' } as any] // Missing href
      }
    };

    expect(() => headInjectPlugin.config!(config)).toThrow();
  });

  it('should not modify other config properties', () => {
    const config = {
      site: {
        title: 'Test',
        description: 'Test site',
        head: [{ type: 'meta', name: 'viewport', content: 'width=device-width' }]
      },
      build: { outDir: 'dist' }
    } as any;

    const result = headInjectPlugin.config!(config);

    expect(result.site.title).toBe('Test');
    expect(result.site.description).toBe('Test site');
    expect(result.build.outDir).toBe('dist');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/plugins/head-inject/index.test.ts
```

Expected: FAIL with "Cannot find module './index.js'"

**Step 3: Implement plugin**

```typescript
import type { MarkoPressPlugin } from '../../plugin/types.js';
import type { HeadTag } from './types.js';
import { validateHeadConfig } from './validator.js';
import { transformHeadConfig } from './transformer.js';

/**
 * Head injection plugin
 * Injects custom content into <head> section via declarative configuration
 */
export const headInjectPlugin: MarkoPressPlugin = {
  name: 'head-inject',

  config(config) {
    const { head } = config.site;

    if (!head || head.length === 0) {
      return config;
    }

    // Validate head config
    validateHeadConfig(head as unknown[]);

    // Transform to renderable format and group by position
    const { headTop, headBottom } = transformHeadConfig(head as HeadTag[]);

    // Store for use in build (will be passed to $global)
    return {
      ...config,
      _headInject: { headTop, headBottom }
    } as unknown as typeof config;
  }
};
```

**Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/plugins/head-inject/index.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/head-inject/index.ts src/plugins/head-inject/index.test.ts
git commit -m "feat(head-inject): add plugin entry point"
```

---

## Task 5: Register Built-in Plugin

**Files:**
- Modify: `src/plugin/manager.ts`

**Step 1: Find plugin registration location**

```bash
grep -n "seoPlugin" src/plugin/manager.ts
```

**Step 2: Add import for head inject plugin**

Add near other plugin imports:
```typescript
import { headInjectPlugin } from '../plugins/head-inject/index.js';
```

**Step 3: Register built-in plugin**

Add to built-in plugins array (near seoPlugin):
```typescript
const builtInPlugins = [
  blogIndexPlugin,
  sidenavPlugin,
  tocPlugin,
  seoPlugin,
  headInjectPlugin, // Add this line
];
```

**Step 4: Run existing tests to ensure no regression**

```bash
pnpm vitest run
```

Expected: All existing tests still pass

**Step 5: Commit**

```bash
git add src/plugin/manager.ts
git commit -m "feat(head-inject): register as built-in plugin"
```

---

## Task 6: Update Theme Extension Points

**Files:**
- Modify: `src/theme/default/tags/theme-head-top.marko`
- Modify: `src/theme/default/tags/theme-head-bottom.marko`

**Step 1: Update theme-head-top.marko**

Replace content with:
```marko
<!-- Extension point: theme head top -->
<if($global.headTop && $global.headTop.length)>
  <for|tag| of=$global.headTop>
    <${tag[0]} ...tag[1]/>
  </for>
</if>
```

**Step 2: Update theme-head-bottom.marko**

Replace content with:
```marko
<!-- Extension point: theme head bottom -->
<if($global.headBottom && $global.headBottom.length)>
  <for|tag| of=$global.headBottom>
    <${tag[0]} ...tag[1]/>
  </for>
</if>
```

**Step 3: Commit**

```bash
git add src/theme/default/tags/theme-head-top.marko src/theme/default/tags/theme-head-bottom.marko
git commit -m "feat(head-inject): update theme extension points"
```

---

## Task 7: Inject Head Data into $global

**Files:**
- Modify: `src/build/index.ts`

**Step 1: Find where $global is set for layouts**

```bash
grep -n "\$global" src/build/index.ts | head -20
```

**Step 2: Add head inject data to $global**

Locate the section where layout data is prepared and add head inject data:

```typescript
// After config is resolved, add head inject data to $global
if ((config as any)._headInject) {
  const { headTop, headBottom } = (config as any)._headInject;
  globalData.headTop = headTop;
  globalData.headBottom = headBottom;
}
```

**Step 3: Commit**

```bash
git add src/build/index.ts
git commit -m "feat(head-inject): inject head data into $global"
```

---

## Task 8: Update Config Types

**Files:**
- Modify: `src/config/types.ts`

**Step 1: Export head tag types**

Add to existing exports:
```typescript
export type { HeadTag } from '../plugins/head-inject/types.js';
```

**Step 2: Update SiteConfig interface**

The `head` property already exists but needs the updated type reference:
```typescript
export interface SiteConfig {
  title: string;
  description?: string;
  base?: string;
  lang?: string;
  head?: HeadTag[];  // This line exists, just confirming it uses the new type
}
```

**Step 3: Commit**

```bash
git add src/config/types.ts
git commit -m "feat(head-inject): update config types"
```

---

## Task 9: Build and Verify

**Files:**
- Create: `test-project/src/.markopress/config.ts` (for testing)

**Step 1: Build the package**

```bash
pnpm build
```

Expected: Build succeeds with no errors

**Step 2: Create test config with head injection**

```bash
cd /home/gp/Projects/markopress/packages/markopress/.worktrees/head-inject-plugin
cat > test-config-test.ts << 'EOF'
import { defineConfig } from '../src/index.js';

export default defineConfig({
  site: {
    title: 'Head Injection Test',
    head: [
      {
        type: 'meta',
        name: 'description',
        content: 'Test site with head injection'
      },
      {
        type: 'link',
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
        position: 'top'
      },
      {
        type: 'script',
        src: 'https://www.googletagmanager.com/gtag/js?id=G-TEST',
        async: true,
        position: 'top'
      },
      {
        type: 'script',
        content: 'console.log("Head injection works!");',
        position: 'bottom'
      }
    ]
  }
});
EOF
```

**Step 3: Test config loading**

```bash
node -e "
const { loadConfig } = require('./dist/config/loader.js');
loadConfig().then(config => {
  console.log('Config loaded successfully');
  console.log('Head tags:', config.site.head?.length || 0);
  console.log('Head inject data:', (config as any)._headInject ? 'Present' : 'Missing');
}).catch(err => {
  console.error('Config load failed:', err.message);
  process.exit(1);
});
"
```

Expected: Success with 4 head tags and _headInject present

**Step 4: Remove test file**

```bash
rm test-config-test.ts
```

**Step 5: Commit**

```bash
git commit -m "chore(head-inject): verify build and config loading"
```

---

## Task 10: Add Documentation

**Files:**
- Create: `docs/plugins/head-injection.md`

**Step 1: Write plugin documentation**

```markdown
# Head Injection Plugin

The head injection plugin allows you to add custom content to the `<head>` section of your pages via declarative configuration.

## Configuration

Add head tags in your `markopress.config.ts`:

\`\`\`typescript
import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'My Site',
    head: [
      // Meta tags
      {
        type: 'meta',
        name: 'description',
        content: 'My awesome site'
      },

      // Link tags (stylesheets, preconnect, etc.)
      {
        type: 'link',
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
        position: 'top'  // Inject at <theme-head-top/>
      },
      {
        type: 'link',
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter'
      },

      // Script tags
      {
        type: 'script',
        src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX',
        async: true,
        position: 'top'
      },
      {
        type: 'script',
        content: \`window.dataLayer = window.dataLayer || [];
               function gtag(){dataLayer.push(arguments);}\`,
        position: 'top'
      }
    ]
  }
});
\`\`\`

## Tag Types

### Meta Tags

\`\`\`typescript
{
  type: 'meta',
  name?: string,          // For standard meta tags
  property?: string,      // For Open Graph (og:*)
  httpEquiv?: string,     // For http-equiv
  content: string,        // Required
  charset?: string,       // For <meta charset="UTF-8">
  position?: 'top' | 'bottom'
}
\`\`\`

### Link Tags

\`\`\`typescript
{
  type: 'link',
  rel: string,                // Required
  href: string,               // Required
  as?: string,                // For preconnect/prefetch
  type?: string,              // MIME type
  media?: string,             // Media query
  sizes?: string,             // For icons
  crossorigin?: 'anonymous' | 'use-credentials',
  integrity?: string,         // SRI hash
  disabled?: boolean,
  title?: string,            // For alternate stylesheets
  position?: 'top' | 'bottom'
}
\`\`\`

### Script Tags

\`\`\`typescript
{
  type: 'script',
  src?: string,                      // External script
  content?: string,                  // Inline script (mutually exclusive with src)
  async?: boolean,
  defer?: boolean,
  type?: string,                     // module, text/javascript, etc.
  crossorigin?: 'anonymous' | 'use-credentials',
  integrity?: string,                // SRI hash
  nonce?: string,                    // CSP nonce
  position?: 'top' | 'bottom'
}
\`\`\`

### Base Tag

\`\`\`typescript
{
  type: 'base',
  href: string,                      // Required
  target?: '_blank' | '_self' | '_parent' | '_top',
  position?: 'top' | 'bottom'
}
\`\`\`

## Positioning

- **`position: 'top'`** - Injects tags at `<theme-head-top/>` (early in head)
- **`position: 'bottom'`** - Injects tags at `<theme-head-bottom/>` (default)

Best practices:
- Use `top` for critical resources (preconnect, early scripts)
- Use `bottom` for everything else (stylesheets, late scripts)

## Examples

### Google Analytics

\`\`\`typescript
head: [
  {
    type: 'script',
    src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX',
    async: true,
    position: 'top'
  },
  {
    type: 'script',
    content: \`window.dataLayer = window.dataLayer || [];
           function gtag(){dataLayer.push(arguments);}
           gtag('js', new Date());
           gtag('config', 'G-XXXXXXXXXX');\`,
    position: 'top'
  }
]
\`\`\`

### Google Fonts

\`\`\`typescript
head: [
  {
    type: 'link',
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
    position: 'top'
  },
  {
    type: 'link',
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossorigin: 'anonymous',
    position: 'top'
  },
  {
    type: 'link',
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'
  }
]
\`\`\`

### Open Graph Meta Tags

\`\`\`typescript
head: [
  {
    type: 'meta',
    property: 'og:type',
    content: 'website'
  },
  {
    type: 'meta',
    property: 'og:image',
    content: 'https://example.com/og-image.jpg'
  },
  {
    type: 'meta',
    property: 'og:image:width',
    content: '1200'
  },
  {
    type: 'meta',
    property: 'og:image:height',
    content: '630'
  }
]
\`\`\`

### Favicon

\`\`\`typescript
head: [
  {
    type: 'link',
    rel: 'icon',
    type: 'image/svg+xml',
    href: '/favicon.svg'
  },
  {
    type: 'link',
    rel: 'apple-touch-icon',
    sizes: '180x180',
    href: '/apple-touch-icon.png'
  },
  {
    type: 'link',
    rel: 'manifest',
    href: '/site.webmanifest'
  }
]
\`\`\`

## Validation

The plugin validates head tags at config load time and throws errors for:

- Missing required attributes
- Conflicting attributes (e.g., script with both src and content)
- Multiple `<base>` tags
- Invalid position values

Example error:
\`\`\`
[head-inject] link tag: Missing required attribute: href
\`\`\`

## Migration from Old Format

The old array format (e.g., `['meta', { name: 'viewport' }]`) is no longer supported.

**Before (no longer works):**
\`\`\`typescript
head: [
  ['meta', { name: 'viewport', content: 'width=device-width' }]
]
\`\`\`

**After (required):**
\`\`\`typescript
head: [
  {
    type: 'meta',
    name: 'viewport',
    content: 'width=device-width'
  }
]
\`\`\`
```

**Step 2: Update main README reference**

Add to plugins section of CLAUDE.md:
```markdown
### Head Injection Plugin

Built-in plugin for injecting custom content into `<head>` section. See [Head Injection Plugin Documentation](../docs/plugins/head-injection.md).
```

**Step 3: Commit**

```bash
git add docs/plugins/head-injection.md CLAUDE.md
git commit -m "docs(head-inject): add plugin documentation"
```

---

## Task 11: Full Integration Test

**Files:**
- Test: `src/plugins/head-inject/integration.test.ts`

**Step 1: Write integration test**

```typescript
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../config/loader.js';
import { headInjectPlugin } from './index.js';

describe('head-inject integration', () => {
  it('should process head config through full plugin lifecycle', async () => {
    const testConfig = `
import { defineConfig } from 'markopress';

export default defineConfig({
  site: {
    title: 'Integration Test',
    head: [
      { type: 'meta', name: 'description', content: 'Test' },
      { type: 'link', rel: 'icon', href: '/favicon.ico', position: 'top' },
      { type: 'script', src: '/analytics.js', async: true }
    ]
  }
});
`;

    // This would require a more complex test setup with temp files
    // For now, verify plugin transforms correctly
    const mockConfig = {
      site: {
        title: 'Integration Test',
        head: [
          { type: 'meta', name: 'description', content: 'Test' },
          { type: 'link', rel: 'icon', href: '/favicon.ico', position: 'top' },
          { type: 'script', src: '/analytics.js', async: true }
        ]
      }
    } as any;

    const result = headInjectPlugin.config!(mockConfig);

    expect((result as any)._headInject).toBeDefined();
    expect((result as any)._headInject.headTop).toHaveLength(1);
    expect((result as any)._headInject.headBottom).toHaveLength(2);
  });
});
```

**Step 2: Run integration test**

```bash
pnpm vitest run src/plugins/head-inject/integration.test.ts
```

Expected: PASS

**Step 3: Run all tests**

```bash
pnpm vitest run
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/plugins/head-inject/integration.test.ts
git commit -m "test(head-inject): add integration test"
```

---

## Task 12: Final Build and Package Verification

**Step 1: Clean build**

```bash
rm -rf dist
pnpm build
```

Expected: Clean build with no errors

**Step 2: Verify exports**

```bash
node -e "
const pkg = require('./package.json');
console.log('Exports:', Object.keys(pkg.exports || pkg));
const main = require('./dist/index.js');
console.log('HeadInjectPlugin available:', !!main.headInjectPlugin);
"
```

Expected: headInjectPlugin is exported

**Step 3: Check dist structure**

```bash
ls -la dist/plugins/head-inject/
```

Expected: All plugin files present (index.js, types.js, validator.js, transformer.js)

**Step 4: Final test suite**

```bash
pnpm test
```

Expected: All tests pass (including existing tests)

**Step 5: Commit**

```bash
git commit -m "chore(head-inject): final build verification"
```

---

## Task 13: Changelog Entry

**Files:**
- Modify: `packages/markopress/CHANGELOG.md` (or create if doesn't exist)

**Step 1: Add changelog entry**

```markdown
## [Unreleased]

### Added

- **head-inject plugin**: Built-in plugin for type-safe head tag injection via declarative configuration
  - Support for meta, link, script, and base tags
  - Configurable positioning (top/bottom of head)
  - Validation at config load time
  - TypeScript type safety

### Changed

- **BREAKING**: `site.head` config format changed from array-of-arrays to typed objects
  - Old: `[['meta', { name: 'viewport' }]]`
  - New: `[{ type: 'meta', name: 'viewport', content: '...' }]`
```

**Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(head-inject): add changelog entry"
```

---

## Completion Checklist

- [ ] All tests pass
- [ ] Build succeeds
- [ ] Documentation complete
- [ ] Changelog updated
- [ ] No breaking changes to existing tests
- [ ] Types exported correctly
- [ ] Theme extension points updated

**Total estimated time:** 2-3 hours

**Ready for execution!**

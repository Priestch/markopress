# Hidden MarkoPress Root Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `markopress` treat `website/.markopress` as the app root while keeping `website/content` and `website/public` as authoring roots.

**Architecture:** Introduce app-root resolution in the CLI and config loader. All build/dev/preview flows use the resolved app root, and config defaults resolve content/public paths relative to that app root. Add targeted tests for root resolution and config defaults.

**Tech Stack:** TypeScript, Commander, Vitest, Node path/fs

---

### Task 1: Add app-root resolution utility

**Files:**
- Modify: `packages/markopress/src/config/loader.ts`
- Create: `packages/markopress/src/config/app-root.ts`
- Test: `packages/markopress/src/config/app-root.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { resolveAppRoot } from './app-root.js';

describe('resolveAppRoot', () => {
  it('resolves .markopress when present', () => {
    const cwd = path.join('/repo', 'website');
    const appRoot = resolveAppRoot({ cwd, appDirName: '.markopress' });
    expect(appRoot).toBe(path.join('/repo', 'website', '.markopress'));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter markopress test -- app-root.test.ts`
Expected: FAIL with module not found or missing export

**Step 3: Write minimal implementation**

```ts
import path from 'node:path';
import fs from 'node:fs';

interface ResolveAppRootOptions {
  cwd?: string;
  appDirName?: string;
}

export function resolveAppRoot(options: ResolveAppRootOptions = {}): string {
  const cwd = options.cwd ?? process.cwd();
  const appDirName = options.appDirName ?? '.markopress';
  const candidate = path.join(cwd, appDirName);
  if (fs.existsSync(candidate)) return candidate;
  return cwd;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter markopress test -- app-root.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git commit -m "feat: resolve hidden app root"
```

### Task 2: Use app-root in CLI and config defaults

**Files:**
- Modify: `packages/markopress/src/cli/index.ts`
- Modify: `packages/markopress/src/config/loader.ts`
- Modify: `packages/markopress/src/dev/index.ts`
- Modify: `packages/markopress/src/build/index.ts`
- Modify: `packages/markopress/src/preview/index.ts`
- Test: `packages/markopress/src/config/loader.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { resolveConfig } from './loader.js';

describe('resolveConfig', () => {
  it('defaults content paths relative to app root', () => {
    const appRoot = '/repo/website/.markopress';
    const resolved = resolveConfig({ site: { title: 'Test' } }, appRoot);
    expect(resolved.content.pages).toBe('..\/content\/pages');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter markopress test -- loader.test.ts`
Expected: FAIL because default is `content/pages`

**Step 3: Write minimal implementation**

- In `config/loader.ts`, change default content paths to `../content/...` and marko tags default to `../.markopress/tags` if needed.
- Use `resolveAppRoot()` in `cli/index.ts` to set process cwd for all commands (or pass appRoot through and update loaders to use it).
- In `dev/index.ts`, `build/index.ts`, `preview/index.ts`, pass the resolved app root to `loadConfig()`.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter markopress test -- loader.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git commit -m "feat: resolve hidden app root in cli"
```

### Task 3: Update website package layout expectations

**Files:**
- Modify: `website/README.md`
- Modify: `website/package.json`
- Modify: `website/.markopress/config.js`

**Step 1: Write the failing test**

No automated test for docs updates. Skip.

**Step 2: Implement updates**

- Update `website/README.md` to explain content-first workflow and `.markopress` as advanced root.
- Update `website/package.json` scripts if needed to ensure CLI runs from `website/` and resolves `.markopress`.
- Update `website/.markopress/config.js` content paths to `../content/...` (if you decide to keep config explicit).

**Step 3: Verify docs lint (manual)**

Run: `pnpm --filter @markopress/website build`
Expected: build succeeds, routes generated, assets loaded

**Step 4: Commit**

```bash
git commit -m "docs: document hidden app root layout"
```

### Task 4: Full verification

**Files:**
- None

**Step 1: Run the package tests**

Run: `pnpm --filter markopress test`
Expected: PASS

**Step 2: Run website build**

Run: `pnpm --filter @markopress/website build`
Expected: PASS

**Step 3: Commit (if any leftover changes)**

```bash
git commit -m "chore: finalize hidden app root implementation"
```

# Website Package Under .markopress Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Relocate the website package root (package.json/scripts/deps) into `website/.markopress` so installs and scripts run from that hidden app root while keeping authors working in `website/content` and `website/public`.

**Architecture:** Treat `website/.markopress` as the actual package root and Vite/Marko app root. Update monorepo workspaces to point to this nested package, move configs (package.json, lock artifacts, Vite/tsconfig) into `.markopress`, and ensure MarkoPress config still targets `../content` and `../public`. Adjust scripts, paths, and ignores so builds, dev, and preview work from `.markopress`, and verify with package tests and site build.

**Tech Stack:** PNPM workspaces, Vite, MarkoPress CLI, TypeScript, Marko, Vitest

---

### Task 1: Prepare hidden package root structure

**Files:**
- Create: `website/.markopress/package.json`
- Create: `website/.markopress/pnpm-workspace.yaml` (if needed for nested lock scope)
- Create: `website/.markopress/.gitignore`
- Modify: `website/.markopress/config.js`
- Modify: `docs/` (project layout docs if needed)

**Step 1: Write failing test/check**

- Command: `pnpm --filter @markopress/website dev`
- Expectation: fails after move because workspace not configured yet.

**Step 2: Scaffold hidden package**

- Copy current `website/package.json` into `website/.markopress/package.json`; keep name `@markopress/website` and scripts.
- Add `.gitignore` under `.markopress` to ignore `node_modules`, `.marko-run`, `.vite`, `dist`, and build caches.
- If monorepo root uses pnpm, ensure `.markopress` participates via root workspace config (next task). Only create nested pnpm-workspace.yaml if pnpm requires it for hoisting scope (likely not needed; prefer root workspace).

**Step 3: Update config paths if necessary**

- Verify `website/.markopress/config.js` still references `../content/...` and `../public` paths; adjust if any absolute paths break after move.

**Step 4: Run check**

- Command: `pnpm install --filter @markopress/website --offline --ignore-scripts`
- Expectation: Should resolve workspace but likely fails until workspace paths updated (next task).

### Task 2: Update workspace/root tooling to point to hidden package

**Files:**
- Modify: `/home/gp/Projects/markopress/package.json`
- Modify: `/home/gp/Projects/markopress/pnpm-workspace.yaml` (if present; else add)
- Modify: root README or docs describing workspace layout

**Step 1: Write failing check**

- Command: `pnpm list --filter @markopress/website`
- Expectation: Not found or points to old path.

**Step 2: Point workspace to `.markopress`**

- Update root workspace patterns to include `website/.markopress` and remove bare `website` if it remains.
- Ensure scripts in root package.json that proxy to website use the new path (e.g., `pnpm --filter @markopress/website dev`).

**Step 3: Run check**

- Command: `pnpm list --filter @markopress/website`
- Expectation: Resolves to `website/.markopress`.

### Task 3: Move supporting config/build files into `.markopress`

**Files:**
- Move/Modify: `website/vite.config.js` -> `website/.markopress/vite.config.js`
- Move/Modify: `website/vite.config.test.mjs` -> `website/.markopress/vite.config.test.mjs`
- Move/Modify: `website/tsconfig.json` (if exists) -> `website/.markopress/tsconfig.json`
- Modify: any import paths referencing config locations
- Update: `website/.markopress/config.js` if it references config file locations

**Step 1: Write failing check**

- Command: `pnpm --filter @markopress/website build`
- Expectation: Fails once files are moved but paths not updated.

**Step 2: Relocate configs**

- Move Vite configs into `.markopress` and update internal relative imports (e.g., `markdownContentPlugin` import stays the same; ensure path resolutions still work from `.markopress`).
- Update any references in docs or scripts to new config locations.

**Step 3: Adjust MarkoPress config if needed**

- Ensure config defaults resolve against `.markopress`; keep content/public paths as `../content/...` and `../public`.

**Step 4: Run check**

- Command: `pnpm --filter @markopress/website build`
- Expectation: Build succeeds and outputs to `website/.markopress/dist` (verify). If output path needs to remain `website/dist`, set Vite/MarkoPress outDir accordingly.

### Task 4: Rewire scripts, entry points, and ignore files

**Files:**
- Modify: `website/.markopress/package.json` scripts to run from `.markopress`
- Modify: root `website/.gitignore` (and/or add `.markopress/.gitignore` already) to ignore new build outputs and caches under `.markopress`
- Modify: `website/README.md` to explain new workflow
- Modify: any CI config referencing website paths (if present)

**Step 1: Write failing check**

- Command: `pnpm --filter @markopress/website dev -- --help`
- Expectation: Works after rewiring; before changes, may still reference old paths.

**Step 2: Update scripts/paths**

- Ensure scripts in `.markopress/package.json` call `markopress` with correct working directory; adjust output directories if we want final `dist` at `../dist` (set `build.outDir` or Vite `build.outDir` to `../dist` to keep existing layout outside hidden root).
- Update `.gitignore` in website root to ignore `.markopress/dist`, `.markopress/.marko-run`, `.markopress/node_modules`, `.markopress/.vite`, or keep ignoring top-level `dist` if using parent outDir.

**Step 3: Run check**

- Command: `pnpm --filter @markopress/website dev -- --help`
- Expectation: Shows CLI help; indicates scripts resolved.

### Task 5: Clean up old artifacts and adjust paths

**Files:**
- Remove/clean: `website/node_modules`, `website/dist`, `website/.marko-run`, `website/vite.config.js*` if moved, `website/tsconfig*` if moved
- Update: references in docs or code that assume package root at `website`

**Step 1: Clean**

- Command: `rm -rf website/node_modules website/dist website/.marko-run website/.vite website/vite.config.js website/vite.config.test.mjs website/tsconfig.json`
- Ensure not tracked by git.

**Step 2: Verify imports/paths**

- Search for `website/vite.config` references and update to `.markopress/vite.config` as needed.

### Task 6: End-to-end verification

**Files:**
- None beyond existing tests

**Step 1: Install and build**

- Command: `pnpm install`
- Command: `pnpm --filter markopress test`
- Command: `pnpm --filter markopress build`
- Command: `pnpm --filter @markopress/website build`
- Expectation: All succeed; website build emits to intended outDir.

**Step 2: Dev sanity**

- Command: `pnpm --filter @markopress/website dev -- --host --open` (start then stop)
- Expectation: Dev server starts from `.markopress` with content/public served correctly from `../content` and `../public`.

**Step 3: Commit**

- Commit message suggestion: `chore: move website package under .markopress`

---

Plan complete and ready for execution.

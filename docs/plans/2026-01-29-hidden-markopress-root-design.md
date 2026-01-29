# Hidden MarkoPress App Root Design

## Goal
Provide a content-first project layout where users edit only `content/` and `public/` by default, while all Marko/MarkoPress implementation lives under `website/.markopress`.

## Summary
MarkoPress will treat `website/.markopress` as the app root and default to `website/content` for content and `website/public` for static assets. The CLI resolves these paths automatically when run from `website/`, and logs the resolved roots to reduce confusion. This keeps advanced configuration hidden while preserving standard asset and content workflows.

## Project Layout
```
website/
  content/               # primary authoring surface
  public/                # user static assets (images, audio, video)
  .markopress/           # hidden app root
    package.json
    src/                 # Marko routes, layouts, components
    public/              # framework/theme assets only
    vite.config.js
    tsconfig.json
    .gitignore
    README.md            # advanced docs
```

## CLI Resolution
- When the user runs `markopress` inside `website/`, resolve `appRoot` to `website/.markopress`.
- Load config from `appRoot` and run @marko/run with `appRoot` as the working root.
- Derive `contentRoot` as `../content` and `publicDir` as `../public` relative to `appRoot`.

## Config Defaults
- Resolve config paths relative to `appRoot` (not cwd).
- Defaults:
  - `content.root = "../content"`
  - `assets.publicDir = "../public"`
- Allow explicit overrides in config when needed.

## Content and Asset Flow
- Markdown is scanned from `contentRoot` and route files are generated into `appRoot/src/routes`.
- Static assets are served from `publicDir` and copied into build output.
- Content can reference assets via absolute URLs like `/images/foo.png`.

## Runtime Guardrails
- Fail fast if `appRoot/package.json` or `appRoot/src` is missing.
- Warn if `contentRoot` or `publicDir` is missing (empty content/assets are allowed).
- Log resolved roots on startup:
  - `App root: website/.markopress`
  - `Content root: website/content`
  - `Assets root: website/public`

## Non-Goals
- No migration tooling for legacy layouts.
- No support for running MarkoPress from outside `website/` in the initial implementation.

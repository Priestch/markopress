#!/usr/bin/env node
/**
 * 性能测试：生成 N 个 markdown 文件，测量 sync/build 时间。
 * 用法：node scripts/perf-test.mjs [count]
 */
import { writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PERF_DIR = join(ROOT, 'content-perf')
const count = Number(process.argv[2] || 100)

console.log(`[perf] generating ${count} markdown files in ${PERF_DIR}`)
rmSync(PERF_DIR, { recursive: true, force: true })
mkdirSync(PERF_DIR, { recursive: true })

for (let i = 0; i < count; i++) {
  const slug = `doc-${String(i).padStart(5, '0')}`
  const content = `---
title: Document ${i}
slug: ${slug}
---

# Document ${i}

This is document number ${i} in the performance test suite.

## Section 1

Lorem ipsum dolor sit amet, consectetur adipiscing elit. **Bold text** and *italic*.

## Section 2

\`\`\`js
function example() {
  return ${i};
}
\`\`\`

- Item 1
- Item 2
- Item 3

> Blockquote with some content for document ${i}.
`
  writeFileSync(join(PERF_DIR, `${slug}.md`), content)
}

console.log(`[perf] done. now run:
  1. pnpm build:perf                # cold build（MP_CONTENT_CONFIG 已指向 perf 配置）
  2. pnpm dev:perf                  # dev server（配合 scripts/perf-dev-probe.mjs）
  3. node scripts/perf-dev-probe.mjs --port 3100 --label rspack -- pnpm dev:perf
  （历史方法学/数据见 docs/perf-rspack-vs-vite.md）`)

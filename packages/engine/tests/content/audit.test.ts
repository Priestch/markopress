import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 依赖红线（AGENTS-content.md）：content 子树（src/content/）不得 import
 * vite / marko / @marko/run / 引擎编排层——content 必须保持 framework-generic
 * （引擎其余部分可以依赖它们，红线只锁这一层）。并包后从「锁 package.json」
 * 升级为「锁实际 import」——更直接。
 */
async function collect(dir: string, out: string[] = []): Promise<string[]> {
	const { readdirSync } = await import('node:fs')
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name)
		if (entry.isDirectory()) await collect(full, out)
		else if (entry.name.endsWith('.ts')) out.push(full)
	}
	return out
}

describe('依赖审计（content 子树红线）', () => {
	it('src/content 不 import vite/marko/@marko/引擎编排层', async () => {
		const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'content')
		const offenders: string[] = []
		for (const file of await collect(root)) {
			const source = await readFile(file, 'utf-8')
			for (const line of source.split('\n')) {
				const m = line.match(/from ['"]([^'"]+)['"]/)
				if (!m) continue
				const spec = m[1]
				if (spec === 'vite' || spec === 'marko' || spec.startsWith('@marko/')) {
					offenders.push(`${file}: ${spec}`)
					continue
				}
				// 相对导入允许（子树内部互引）；逃出 src/content 才是红线——
				// 解析后判断（loaders/../types 仍在子树内，../markdown 即逃逸）
				if (spec.startsWith('.')) {
					const resolved = resolve(dirname(file), spec)
					if (!resolved.startsWith(root)) offenders.push(`${file}: ${spec}（逃出 content 子树）`)
					continue
				}
				// 裸导入白名单：node 内建 + content 自有依赖
				const allow = spec.startsWith('node:') || ['zod', 'devalue', 'tinyglobby', 'xxhash-wasm'].includes(spec)
				if (!allow) offenders.push(`${file}: ${spec}`)
			}
		}
		expect(offenders).toEqual([])
	})
})

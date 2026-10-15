import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

/**
 * 依赖红线（AGENTS.md）：本包不得依赖 vite / marko / @marko/run——
 * content 层必须 framework-generic。新依赖先过这关再装。
 */
describe('依赖审计', () => {
	it('package.json 无 vite/marko/@marko/run', async () => {
		const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf-8'))
		const deps = {
			...pkg.dependencies,
			...pkg.devDependencies,
			...pkg.peerDependencies,
			...pkg.optionalDependencies,
		}
		const forbidden = Object.keys(deps).filter(
			(d) => d === 'vite' || d === 'marko' || d.startsWith('@marko/'),
		)
		expect(forbidden).toEqual([])
	})
})

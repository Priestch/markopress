import { describe, expect, it } from 'vitest'
import { defineCollection, defineLoader } from '../../src/content/index.ts'

describe('defineLoader / defineCollection 形状校验', () => {
	it('defineLoader identity：原样返回合法 loader', () => {
		const loader = defineLoader({
			name: 'test-loader',
			load: async () => {},
		})
		expect(loader.name).toBe('test-loader')
		expect(typeof loader.load).toBe('function')
	})

	it('defineLoader 拒绝非对象', () => {
		expect(() => defineLoader(undefined as never)).toThrow(/A loader must be an object/)
		expect(() => defineLoader(42 as never)).toThrow(/A loader must be an object/)
	})

	it('defineLoader 拒绝缺 load 方法', () => {
		expect(() => defineLoader({ name: 'x' } as never)).toThrow(/must have a `load` method/)
	})

	it('defineLoader 拒绝空/非字符串 name', () => {
		expect(() => defineLoader({ load: async () => {} } as never)).toThrow(/non-empty string `name`/)
		expect(() => defineLoader({ name: '', load: async () => {} })).toThrow(/non-empty string `name`/)
	})

	it('defineCollection 走同一校验（缺 loader / 坏 loader 即时报错）', () => {
		expect(() => defineCollection({} as never)).toThrow(/A loader must be an object/)
		expect(() => defineCollection({ loader: { name: 'x' } as never })).toThrow(/`load` method/)
		// 合法路径不受影响
		const c = defineCollection({ loader: defineLoader({ name: 'x', load: async () => {} }) })
		expect(c.loader.name).toBe('x')
	})
})

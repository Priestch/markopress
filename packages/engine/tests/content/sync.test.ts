import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	defineCollection,
	metaFile,
	MutableStore,
	PersistentMetaStore,
} from '../../src/content/index.ts'
import { ContentSyncer } from '../../src/content/sync.ts'
import type { ContentConfig } from '../../src/content/types.ts'
import { countingSchema, makeFixture, silentLogger } from './helpers.ts'

describe('sync 失效三件套', () => {
	it('1. digest 相同 ⇒ 完全跳过（不重 parse）', async () => {
		const fx = await makeFixture()
		await fx.write('a.tmd', { title: 'A' }, 'body')
		const counter = { count: 0 }
		const config = await fx.config({ schema: countingSchema(counter) })
		await fx.syncer.sync(config)
		expect(counter.count).toBe(1)

		await fx.syncer.sync(config)
		expect(counter.count).toBe(1)
		expect(fx.store.values('docs')).toHaveLength(1)
	})

	it('2. untouched 差集：删文件 ⇒ entry 删除，其余不动', async () => {
		const fx = await makeFixture()
		await fx.write('a.tmd', { title: 'A' }, 'a')
		await fx.write('b.tmd', { title: 'B' }, 'b')
		const counter = { count: 0 }
		const config = await fx.config({ schema: countingSchema(counter) })
		await fx.syncer.sync(config)
		expect(fx.store.keys('docs').sort()).toEqual(['a', 'b'])

		await fx.remove('a.tmd')
		await fx.syncer.sync(config)
		expect(fx.store.keys('docs')).toEqual(['b'])
		// b 的 digest 命中 ⇒ 只有 a 的消失，没有额外 parse
		expect(counter.count).toBe(2)
	})

	it('改文件 ⇒ 只重 parse 该条', async () => {
		const fx = await makeFixture()
		await fx.write('a.tmd', { title: 'A' }, 'a')
		await fx.write('b.tmd', { title: 'B' }, 'b')
		const counter = { count: 0 }
		const config = await fx.config({ schema: countingSchema(counter) })
		await fx.syncer.sync(config)
		expect(counter.count).toBe(2)

		await fx.write('b.tmd', { title: 'B2' }, 'b changed')
		await fx.syncer.sync(config)
		expect(counter.count).toBe(3)
		expect(fx.store.get('docs', 'b')?.data.title).toBe('B2')
	})

	it('重命名文件（路径派生 id）⇒ 旧删新建', async () => {
		const fx = await makeFixture()
		await fx.write('a.tmd', { title: 'A' }, 'same body')
		const counter = { count: 0 }
		const config = await fx.config({ schema: countingSchema(counter) })
		await fx.syncer.sync(config)
		expect(fx.store.keys('docs')).toEqual(['a'])

		await fx.remove('a.tmd')
		await fx.write('z.tmd', { title: 'A' }, 'same body')
		await fx.syncer.sync(config)
		expect(fx.store.keys('docs')).toEqual(['z'])
	})

	it('frontmatter slug 保持 ⇒ 重命名文件不换 id，只更新 filePath', async () => {
		const fx = await makeFixture()
		await fx.write('one.tmd', { title: 'A', slug: 'stable' }, 'body')
		const config = await fx.config()
		await fx.syncer.sync(config)
		expect(fx.store.keys('docs')).toEqual(['stable'])
		expect(fx.store.get('docs', 'stable')?.filePath).toBe('one.tmd')

		await fx.remove('one.tmd')
		await fx.write('two.tmd', { title: 'A', slug: 'stable' }, 'body')
		await fx.syncer.sync(config)
		expect(fx.store.keys('docs')).toEqual(['stable'])
		expect(fx.store.get('docs', 'stable')?.filePath).toBe('two.tmd')
	})

	it('3. 配置指纹变 ⇒ clearAll + 全量重 parse', async () => {
		const fx = await makeFixture()
		await fx.write('a.tmd', { title: 'A' }, 'a')
		await fx.write('b.tmd', { title: 'B' }, 'b')
		const counter = { count: 0 }
		const schema = countingSchema(counter)
		const v1 = await fx.config({ digest: 'config-v1', schema })
		await fx.syncer.sync(v1)
		expect(counter.count).toBe(2)

		// 相同指纹重跑：全部命中 digest
		await fx.syncer.sync(v1)
		expect(counter.count).toBe(2)

		// 换 schema（模拟）= 换配置指纹：旧数据必须全量重建
		const schema2 = countingSchema(counter)
		const v2 = await fx.config({ digest: 'config-v2', schema: schema2 })
		await fx.syncer.sync(v2)
		expect(counter.count).toBe(4) // 清空后 a、b 重新 parse
		expect(fx.store.keys('docs').sort()).toEqual(['a', 'b'])
	})

	it('包版本变 ⇒ clearAll', async () => {
		const fx = await makeFixture()
		await fx.write('a.tmd', { title: 'A' }, 'a')
		const counter = { count: 0 }
		const config = await fx.config({ schema: countingSchema(counter) })
		await fx.syncer.sync(config)
		expect(counter.count).toBe(1)

		// 同一 store 目录、新版本的新 syncer（模拟升级 markopress 后重启）
		const store2 = await MutableStore.fromDir(join(fx.dir, '.markopress', 'store'))
		const meta2 = await PersistentMetaStore.fromFile(
			metaFile(join(fx.dir, '.markopress', 'store')),
		)
		const syncer2 = new ContentSyncer({
			store: store2,
			meta: meta2,
			logger: silentLogger(),
			entryTypes: [(await import('./helpers.ts')).testEntryType],
			version: 'test-2',
		})
		await syncer2.sync(config)
		expect(counter.count).toBe(2) // 版本指纹不同 ⇒ 全量重 parse
	})

	it('跨重启：store/meta 从盘上装载后 digest 仍命中', async () => {
		const fx = await makeFixture()
		await fx.write('a.tmd', { title: 'A' }, 'a')
		const counter = { count: 0 }
		const config = await fx.config({ schema: countingSchema(counter) })
		await fx.syncer.sync(config)
		await Promise.all([
			fx.store.waitUntilSaveComplete(),
			fx.meta.waitUntilSaveComplete(),
		])

		const store2 = await MutableStore.fromDir(join(fx.dir, '.markopress', 'store'))
		const meta2 = await PersistentMetaStore.fromFile(
			metaFile(join(fx.dir, '.markopress', 'store')),
		)
		const syncer2 = new ContentSyncer({
			store: store2,
			meta: meta2,
			logger: silentLogger(),
			entryTypes: [(await import('./helpers.ts')).testEntryType],
			version: 'test-1',
		})
		await syncer2.sync(config)
		expect(counter.count).toBe(1) // 增量命中，零重 parse
		expect(store2.get('docs', 'a')?.data.title).toBe('A')
	})
})

describe('sync 编排', () => {
	it('串行：sync 期间再入队的 sync 排队执行', async () => {
		const fx = await makeFixture()
		await fx.write('a.tmd', { title: 'A' }, 'a')
		const config = await fx.config()
		const order: Array<string> = []
		const p1 = fx.syncer.sync(config).then(() => order.push('sync1'))
		const p2 = fx.syncer.sync(config).then(() => order.push('sync2'))
		await Promise.all([p1, p2])
		expect(order).toEqual(['sync1', 'sync2'])
	})

	it('loader 抛错 ⇒ 本次 sync reject，链不毒化', async () => {
		const fx = await makeFixture()
		const bad: ContentConfig = {
			collections: {
				docs: defineCollection({
					loader: {
						name: 'bad',
						load: () => Promise.reject(new Error('boom')),
					},
				}),
			},
		}
		await expect(fx.syncer.sync(bad)).rejects.toThrow('boom')
		// 链还活着
		await fx.write('a.tmd', { title: 'A' }, 'a')
		await fx.syncer.sync(await fx.config())
		expect(fx.store.keys('docs')).toEqual(['a'])
	})

	it('选择性 sync：只跑指定集合', async () => {
		const fx = await makeFixture()
		await fx.write('a.tmd', { title: 'A' }, 'a')
		const seen: Array<string> = []
		const config: ContentConfig = {
			collections: {
				docs: defineCollection({
					loader: {
						name: 'docs-loader',
						load: async (ctx) => {
							seen.push(ctx.collection)
							await import('node:fs/promises').then((fs) =>
								fs.readFile(join(fx.contentDir, 'a.tmd'), 'utf-8'),
							)
							ctx.store.set({ id: 'a', slug: 'a', data: {} })
						},
					},
				}),
				other: defineCollection({
					loader: {
						name: 'other-loader',
						load: async (ctx) => {
							seen.push(ctx.collection)
						},
					},
				}),
			},
		}
		await fx.syncer.sync(config)
		expect(seen).toEqual(['docs', 'other'])
		seen.length = 0
		await fx.syncer.sync(config, { collections: ['other'] })
		expect(seen).toEqual(['other'])
		// docs 没重跑 ⇒ 数据还在
		expect(fx.store.has('docs', 'a')).toBe(true)
	})

	it('ctx.meta 按集合隔离并持久化（WP 游标场景）', async () => {
		const fx = await makeFixture()
		let token = ''
		const makeConfig = (): ContentConfig => ({
			collections: {
				wp: defineCollection({
					loader: {
						name: 'wp-fake',
						load: async (ctx) => {
							const prev = ctx.meta.get('last-modified')
							expect(prev === undefined || prev === 't1').toBe(true)
							token = prev ?? ''
							ctx.meta.set('last-modified', 't1')
							ctx.store.set({ id: 'p1', slug: 'p1', data: {}, digest: ctx.generateDigest('v1') })
						},
					},
				}),
			},
		})
		await fx.syncer.sync(makeConfig())
		await fx.meta.waitUntilSaveComplete()
		expect(token).toBe('') // 首轮无游标
		await fx.syncer.sync(makeConfig())
		expect(token).toBe('t1') // 游标跨 sync 存活
		// digest 命中 ⇒ 第二轮 store.set 返回前不会覆盖（数据没变，文件不变）
	})
})

describe('基准断言（抄 Astro 最值的一条）', () => {
	it('1k 条目改 1 条，parseData 只被调用 1 次', async () => {
		const fx = await makeFixture()
		const writes: Array<Promise<void>> = []
		for (let i = 0; i < 1000; i++) {
			writes.push(fx.write(`f${i}.tmd`, { title: `T${i}` }, `body ${i}`))
		}
		await Promise.all(writes)
		const counter = { count: 0 }
		const config = await fx.config({ schema: countingSchema(counter) })
		await fx.syncer.sync(config)
		expect(counter.count).toBe(1000)
		expect(fx.store.values('docs')).toHaveLength(1000)

		await fx.write('f500.tmd', { title: 'T500-changed' }, 'body 500 changed')
		await fx.syncer.sync(config)
		expect(counter.count).toBe(1001)
	})
})

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { metaFile, MutableStore, PersistentMetaStore } from '../../src/content/index.ts'
import { collectionFile } from '../../src/content/store.ts'
import { makeTmpDir } from './helpers.ts'

describe('MutableStore scoped 视图', () => {
	it('写不进别的集合；clear 只清自己', () => {
		const store = new MutableStore()
		const docs = store.scopedStore('docs')
		const blog = store.scopedStore('blog')
		docs.set({ id: 'a', slug: 'a', data: { n: 1 } })
		blog.set({ id: 'a', slug: 'a', data: { n: 2 } })
		expect(docs.get('a')?.data.n).toBe(1)
		expect(blog.get('a')?.data.n).toBe(2)
		expect(docs.keys()).toEqual(['a'])
		docs.clear()
		expect(docs.keys()).toEqual([])
		expect(blog.keys()).toEqual(['a'])
	})

	it('set 的 digest 去重：同 id 同 digest ⇒ false 且不产生写盘', async () => {
		const dir = await makeTmpDir()
		const store = await MutableStore.fromDir(dir)
		const scoped = store.scopedStore('docs')
		expect(scoped.set({ id: 'a', slug: 'a', data: {}, digest: 'd1' })).toBe(true)
		await store.waitUntilSaveComplete()

		const written: Array<string> = []
		store.onFileWritten((p) => written.push(p))
		expect(scoped.set({ id: 'a', slug: 'a', data: { changed: true }, digest: 'd1' })).toBe(false)
		expect(scoped.get('a')?.data).toEqual({})
		await store.waitUntilSaveComplete()
		expect(written).toEqual([])
	})

	it('set 拒绝绝对 filePath', () => {
		const store = new MutableStore()
		expect(() =>
			store.scopedStore('docs').set({ id: 'a', slug: 'a', data: {}, filePath: '/abs/a.tmd' }),
		).toThrow(/relative to the site root/)
	})

	it('可选字段缺省时不落键', () => {
		const store = new MutableStore()
		store.scopedStore('docs').set({ id: 'a', slug: 'a', data: {} })
		const entry = store.scopedStore('docs').get('a')!
		expect(entry).toEqual({ id: 'a', slug: 'a', data: {} })
	})

	it('slug 缺省回退为 id', () => {
		const store = new MutableStore()
		// @ts-expect-error 测试运行时容忍（契约里 slug 必填，防御性回退）
		store.scopedStore('docs').set({ id: 'a', data: {} })
		expect(store.scopedStore('docs').get('a')?.slug).toBe('a')
	})
})

describe('持久化', () => {
	it('devalue round-trip：Date/数组/嵌套对象无损', async () => {
		const dir = await makeTmpDir()
		const store = await MutableStore.fromDir(dir)
		store.scopedStore('docs').set({
			id: 'a',
			slug: 'a',
			data: { date: new Date('2026-10-14T00:00:00Z'), tags: ['x', 'y'], meta: { n: 1 } },
			body: '# hi',
			contentType: 'text/test-markdown',
			digest: 'd1',
			filePath: 'content/a.tmd',
		})
		await store.waitUntilSaveComplete()

		const reloaded = await MutableStore.fromDir(dir)
		const entry = reloaded.get('docs', 'a')!
		const data = entry.data as { date: Date; tags: string[]; meta: { n: number } }
		expect(data.date).toBeInstanceOf(Date)
		expect(data.date.toISOString()).toBe('2026-10-14T00:00:00.000Z')
		expect(data.tags).toEqual(['x', 'y'])
		expect(data.meta).toEqual({ n: 1 })
		expect(entry.body).toBe('# hi')
		expect(entry.contentType).toBe('text/test-markdown')
		expect(entry.digest).toBe('d1')
		expect(entry.filePath).toBe('content/a.tmd')
	})

	it('按集合分文件；清空集合 ⇒ 文件移除', async () => {
		const dir = await makeTmpDir()
		const store = await MutableStore.fromDir(dir)
		store.scopedStore('docs').set({ id: 'a', slug: 'a', data: {} })
		store.scopedStore('blog').set({ id: 'b', slug: 'b', data: {} })
		await store.waitUntilSaveComplete()
		expect(existsSync(collectionFile(dir, 'docs'))).toBe(true)
		expect(existsSync(collectionFile(dir, 'blog'))).toBe(true)

		store.scopedStore('docs').clear()
		await store.waitUntilSaveComplete()
		expect(existsSync(collectionFile(dir, 'docs'))).toBe(false)
		expect(existsSync(collectionFile(dir, 'blog'))).toBe(true)
	})

	it('内容未变的 flush 跳过写盘；onFileWritten 只在真写时回调', async () => {
		const dir = await makeTmpDir()
		const store = await MutableStore.fromDir(dir)
		store.scopedStore('docs').set({ id: 'a', slug: 'a', data: { n: 1 }, digest: 'd1' })
		await store.waitUntilSaveComplete()
		const before = await readFile(collectionFile(dir, 'docs'), 'utf-8')

		const written: Array<string> = []
		const unsub = store.onFileWritten((p) => written.push(p))
		// digest 命中 ⇒ set 不写 ⇒ flush 也无事可做
		store.scopedStore('docs').set({ id: 'a', slug: 'a', data: { n: 1 }, digest: 'd1' })
		await store.waitUntilSaveComplete()
		expect(written).toEqual([])
		expect(await readFile(collectionFile(dir, 'docs'), 'utf-8')).toBe(before)

		store.scopedStore('docs').set({ id: 'a', slug: 'a', data: { n: 2 }, digest: 'd2' })
		await store.waitUntilSaveComplete()
		expect(written).toEqual([collectionFile(dir, 'docs')])
		unsub()
	})

	it('同一集合多次 set 合并为一次写盘', async () => {
		const dir = await makeTmpDir()
		const store = await MutableStore.fromDir(dir)
		const written: Array<string> = []
		store.onFileWritten((p) => written.push(p))
		const scoped = store.scopedStore('docs')
		scoped.set({ id: 'a', slug: 'a', data: {} })
		scoped.set({ id: 'b', slug: 'b', data: {} })
		scoped.set({ id: 'c', slug: 'c', data: {} })
		await store.waitUntilSaveComplete()
		expect(written).toEqual([collectionFile(dir, 'docs')])
		expect(scoped.keys().sort()).toEqual(['a', 'b', 'c'])
	})

	it('meta 持久化 round-trip（scoped 视图 + 全局键）', async () => {
		const dir = await makeTmpDir()
		const file = metaFile(dir)
		const meta = await PersistentMetaStore.fromFile(file)
		meta.for('docs').set('last-modified', '2026-10-14T10:00:00Z')
		meta.set(':global', 'content-config-digest', 'abc')
		await meta.waitUntilSaveComplete()

		const reloaded = await PersistentMetaStore.fromFile(file)
		expect(reloaded.for('docs').get('last-modified')).toBe('2026-10-14T10:00:00Z')
		expect(reloaded.get(':global', 'content-config-digest')).toBe('abc')
	})

	it('clearAll 清掉全部集合文件与 meta', async () => {
		const dir = await makeTmpDir()
		const store = await MutableStore.fromDir(dir)
		const meta = await PersistentMetaStore.fromFile(metaFile(dir))
		store.scopedStore('docs').set({ id: 'a', slug: 'a', data: {} })
		store.scopedStore('blog').set({ id: 'b', slug: 'b', data: {} })
		meta.for('docs').set('token', 'x')
		await Promise.all([store.waitUntilSaveComplete(), meta.waitUntilSaveComplete()])

		store.clearAll()
		meta.clearAll()
		await Promise.all([store.waitUntilSaveComplete(), meta.waitUntilSaveComplete()])
		expect(existsSync(collectionFile(dir, 'docs'))).toBe(false)
		expect(existsSync(collectionFile(dir, 'blog'))).toBe(false)
		const reloaded = await PersistentMetaStore.fromFile(metaFile(dir))
		expect(reloaded.for('docs').get('token')).toBeUndefined()
	})
})

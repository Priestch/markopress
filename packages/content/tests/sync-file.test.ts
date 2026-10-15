/**
 * syncFile 单文件增量：glob loader 的 handleFileChange + syncer 编排。
 * 核心断言（对齐 AGENTS「基准断言」）：改 1 个文件只读这 1 个文件。
 * 注意：fx.config() 每次都新建 loader 实例（增量映射在其闭包里），测试内必须复用同一份。
 */
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MutableStore } from '../src/index.ts'
import { glob } from '../src/loaders/glob.ts'
import { defineCollection } from '../src/index.ts'
import type { EntryType, FileChangeEvent } from '../src/types.ts'
import { makeFixture, testEntryType } from './helpers.ts'

const ev = (type: FileChangeEvent['type'], path: string): FileChangeEvent => ({ type, path })

describe('syncFile：增 / 改 / 删', () => {
	it('add：新文件 → handled + changed，entry 进 store', async () => {
		const fx = await makeFixture()
		const config = await fx.config()
		await fx.syncer.sync(config)
		await fx.write('new.tmd', { title: 'N' }, 'n')
		const outcome = await fx.syncer.syncFile(config, ev('add', join(fx.contentDir, 'new.tmd')))
		expect(outcome).toMatchObject({ handled: true, changed: [{ collection: 'docs', id: 'new' }] })
		expect(fx.store.get('docs', 'new')?.body).toBe('n')
	})

	it('change：内容变化 → changed；digest 相同 → 空', async () => {
		const fx = await makeFixture()
		const config = await fx.config()
		await fx.write('a.tmd', { title: 'A' }, 'before')
		await fx.syncer.sync(config)

		await fx.write('a.tmd', { title: 'A' }, 'after')
		const hit = await fx.syncer.syncFile(config, ev('change', join(fx.contentDir, 'a.tmd')))
		expect(hit).toMatchObject({ handled: true, changed: [{ collection: 'docs', id: 'a' }] })
		expect(fx.store.get('docs', 'a')?.body).toBe('after')

		const skip = await fx.syncer.syncFile(config, ev('change', join(fx.contentDir, 'a.tmd')))
		expect(skip).toEqual({ handled: true, changed: [], removed: [] })
	})

	it('change 改 frontmatter slug → changed=新 id，removed=老 id', async () => {
		const fx = await makeFixture()
		const config = await fx.config()
		await fx.write('a.tmd', { title: 'A', slug: 'first' }, 'x')
		await fx.syncer.sync(config)
		expect(fx.store.keys('docs')).toEqual(['first'])

		await fx.write('a.tmd', { title: 'A', slug: 'second' }, 'x')
		const outcome = await fx.syncer.syncFile(config, ev('change', join(fx.contentDir, 'a.tmd')))
		expect(outcome).toMatchObject({
			handled: true,
			changed: [{ collection: 'docs', id: 'second' }],
			removed: [{ collection: 'docs', id: 'first' }],
		})
		expect(fx.store.keys('docs')).toEqual(['second'])
	})

	it('unlink → removed，entry 出 store', async () => {
		const fx = await makeFixture()
		const config = await fx.config()
		await fx.write('a.tmd', { title: 'A' }, 'x')
		await fx.syncer.sync(config)
		await fx.remove('a.tmd')
		const outcome = await fx.syncer.syncFile(config, ev('unlink', join(fx.contentDir, 'a.tmd')))
		expect(outcome).toMatchObject({ handled: true, removed: [{ collection: 'docs', id: 'a' }] })
		expect(fx.store.keys('docs')).toEqual([])
	})

	it('增量后落盘可 round-trip（去抖 flush 后）', async () => {
		const fx = await makeFixture()
		const config = await fx.config()
		await fx.syncer.sync(config)
		await fx.write('disk.tmd', { title: 'D' }, 'd')
		await fx.syncer.syncFile(config, ev('add', join(fx.contentDir, 'disk.tmd')))
		await fx.store.waitUntilSaveComplete() // syncFile 不等落盘（500ms 去抖），显式冲掉
		const reloaded = await MutableStore.fromDir(join(fx.dir, '.markopress', 'store'))
		expect(reloaded.get('docs', 'disk')?.body).toBe('d')
	})
})

describe('syncFile：认领边界', () => {
	it('base 之外的路径 → not handled', async () => {
		const fx = await makeFixture()
		const config = await fx.config()
		await fx.syncer.sync(config)
		const outcome = await fx.syncer.syncFile(config, ev('add', join(fx.dir, 'outside.tmd')))
		expect(outcome.handled).toBe(false)
	})

	it('pattern 不匹配的文件（.txt）→ not handled', async () => {
		const fx = await makeFixture()
		const config = await fx.config()
		await fx.syncer.sync(config)
		await writeFile(join(fx.contentDir, 'b.txt'), 'plain', 'utf-8')
		const outcome = await fx.syncer.syncFile(config, ev('add', join(fx.contentDir, 'b.txt')))
		expect(outcome.handled).toBe(false)
	})

	it('未跑过 load 就收到匹配文件的 change → 自愈收编（membership 扫描）', async () => {
		const fx = await makeFixture()
		await fx.write('late.tmd', { title: 'L' }, 'l')
		// 不先 sync，直接单文件事件
		const outcome = await fx.syncer.syncFile(await fx.config(), ev('change', join(fx.contentDir, 'late.tmd')))
		expect(outcome).toMatchObject({ handled: true, changed: [{ collection: 'docs', id: 'late' }] })
		expect(fx.store.get('docs', 'late')?.body).toBe('l')
	})

	it('watchDirs：绝对路径，包含 base', async () => {
		const loader = glob({ pattern: '**/*.tmd', base: 'packages/content' })
		expect(loader.watchDirs).toEqual([join(process.cwd(), 'packages/content')])
	})
})

describe('syncFile：基准断言（增量的意义所在）', () => {
	it('30 个文件改 1 个 → 只多读这 1 个文件（其余零 read）', async () => {
		let reads = 0
		const counting: EntryType = {
			...testEntryType,
			async getEntryInfo(opts) {
				reads++
				return testEntryType.getEntryInfo(opts)
			},
		}
		const fx = await makeFixture({ entryTypes: [counting] })
		const config = await fx.config()
		for (let i = 0; i < 30; i++) await fx.write(`f${String(i).padStart(2, '0')}.tmd`, { title: `T${i}` }, 'x')
		await fx.syncer.sync(config)
		expect(reads).toBe(30)

		await fx.write('f15.tmd', { title: 'T15-edited' }, 'y')
		await fx.syncer.syncFile(config, ev('change', join(fx.contentDir, 'f15.tmd')))
		expect(reads).toBe(31)
		expect(fx.store.get('docs', 'f15')?.body).toBe('y')
	})

	it('多集合：事件只被所属集合的 loader 认领', async () => {
		const fx = await makeFixture()
		await fx.syncer.sync(await fx.config())
		const config = {
			collections: {
				docs: defineCollection({ loader: glob({ pattern: '**/*.tmd', base: fx.contentDir }) }),
				other: defineCollection({ loader: glob({ pattern: '**/*.tmd', base: join(fx.dir, 'other') }) }),
			},
		}
		await fx.write('a.tmd', { title: 'A' }, 'a')
		const outcome = await fx.syncer.syncFile(config, ev('add', join(fx.contentDir, 'a.tmd')))
		expect(outcome.changed).toEqual([{ collection: 'docs', id: 'a' }])
	})
})

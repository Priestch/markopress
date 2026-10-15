import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { glob } from '../src/loaders/glob.ts'
import { defineCollection } from '../src/index.ts'
import type { ContentConfig } from '../src/types.ts'
import { makeFixture, silentLogger } from './helpers.ts'

async function syncOnce(fx: Awaited<ReturnType<typeof makeFixture>>, config: ContentConfig) {
	await fx.syncer.sync(config)
}

describe('glob loader：id / slug / contentType', () => {
	it('默认 id = 路径派生 slug（去扩展名、小写、空白折叠）', async () => {
		const fx = await makeFixture()
		await fx.write('My Post.tmd', { title: 'A' }, 'a')
		await fx.write('guides/Getting Started.tmd', { title: 'B' }, 'b')
		await syncOnce(fx, await fx.config())
		expect(fx.store.keys('docs').sort()).toEqual(['guides/getting-started', 'my-post'])
	})

	it('frontmatter slug 覆盖默认 id；entry.slug 默认回退 id', async () => {
		const fx = await makeFixture()
		await fx.write('a.tmd', { title: 'A', slug: 'custom' }, 'x')
		await fx.write('b.tmd', { title: 'B' }, 'y')
		await syncOnce(fx, await fx.config())
		const a = fx.store.get('docs', 'custom')!
		expect(a.slug).toBe('custom')
		expect(a.filePath).toBe('a.tmd')
		const b = fx.store.get('docs', 'b')!
		expect(b.slug).toBe('b')
	})

	it('body 存源文本并打上 entryType 的 contentType', async () => {
		const fx = await makeFixture()
		await fx.write('a.tmd', { title: 'A' }, 'the body')
		await syncOnce(fx, await fx.config())
		const entry = fx.store.get('docs', 'a')!
		expect(entry.body).toBe('the body')
		expect(entry.contentType).toBe('text/test-markdown')
	})

	it('中文文件名保留 Unicode（URL 由下游 encodeURI）', async () => {
		const fx = await makeFixture()
		await fx.write('入门指南.tmd', { title: 'A' }, 'x')
		await syncOnce(fx, await fx.config())
		expect(fx.store.keys('docs')).toEqual(['入门指南'])
	})
})

describe('glob loader：文件面行为', () => {
	it('不认识的扩展名：跳过并告警', async () => {
		const fx = await makeFixture()
		await fx.write('a.tmd', { title: 'A' }, 'a')
		await writeFile(join(fx.contentDir, 'b.txt'), 'plain', 'utf-8')
		await syncOnce(fx, {
			collections: {
				docs: defineCollection({
					loader: glob({ pattern: '**/*', base: fx.contentDir }),
				}),
			},
		})
		expect(fx.store.keys('docs')).toEqual(['a'])
		expect(fx.logger.warnings.some((w) => w.includes('No entry type found for b.txt'))).toBe(true)
	})

	it('负向模式排除文件', async () => {
		const fx = await makeFixture()
		await mkdir(join(fx.contentDir, '_drafts'), { recursive: true })
		await fx.write('a.tmd', { title: 'A' }, 'a')
		await fx.write('_drafts/secret.tmd', { title: 'S' }, 's')
		await syncOnce(fx, {
			collections: {
				docs: defineCollection({
					loader: glob({ pattern: ['**/*.tmd', '!_drafts/**'], base: fx.contentDir }),
				}),
			},
		})
		expect(fx.store.keys('docs')).toEqual(['a'])
	})

	it('base 不存在：告警但不抛', async () => {
		const fx = await makeFixture()
		await syncOnce(fx, {
			collections: {
				docs: defineCollection({
					loader: glob({ pattern: '**/*.tmd', base: join(fx.dir, 'missing') }),
				}),
			},
		})
		expect(fx.store.keys('docs')).toEqual([])
		expect(fx.logger.warnings.some((w) => w.includes('does not exist'))).toBe(true)
	})

	it('pattern 以 ../ 或 / 开头：构造即抛', () => {
		expect(() => glob({ pattern: '../x/*.md' })).toThrow(/\.\.\//)
		expect(() => glob({ pattern: '/x/*.md' })).toThrow(/^Glob patterns/)
		expect(() => glob({ pattern: ['ok/*.md', '../bad/*.md'] })).toThrow(/\.\.\//)
	})

	it('自定义 generateId（WP 式稳定 id）', async () => {
		const fx = await makeFixture()
		await fx.write('a.tmd', { title: 'A', postId: 42 }, 'a')
		await syncOnce(fx, {
			collections: {
				docs: defineCollection({
					loader: glob({
						pattern: '**/*.tmd',
						base: fx.contentDir,
						generateId: ({ data }) => `wp-${String(data.postId)}`,
					}),
				}),
			},
		})
		expect(fx.store.keys('docs')).toEqual(['wp-42'])
		expect(fx.store.get('docs', 'wp-42')?.slug).toBe('wp-42')
	})

	it('root 选项决定 filePath 相对化基准（默认 base）', async () => {
		const fx = await makeFixture()
		await fx.write('a.tmd', { title: 'A' }, 'a')
		await syncOnce(fx, {
			collections: {
				docs: defineCollection({
					loader: glob({ pattern: '**/*.tmd', base: fx.contentDir, root: fx.dir }),
				}),
			},
		})
		expect(fx.store.get('docs', 'a')?.filePath).toBe('content/a.tmd')
		// 默认（无 root）：相对 base
		const fx2 = await makeFixture()
		await fx2.write('a.tmd', { title: 'A' }, 'a')
		await syncOnce(fx2, await fx2.config())
		expect(fx2.store.get('docs', 'a')?.filePath).toBe('a.tmd')
	})

	it('两个文件撞同一 frontmatter slug：后写覆盖 + 告警', async () => {
		const fx = await makeFixture()
		await fx.write('one.tmd', { title: 'A', slug: 'clash' }, 'one')
		await fx.write('two.tmd', { title: 'B', slug: 'clash' }, 'two')
		await syncOnce(fx, await fx.config())
		expect(fx.store.keys('docs')).toEqual(['clash'])
		expect(
			fx.logger.warnings.some((w) => w.includes('Duplicate slug "clash"')),
		).toBe(true)
	})
})

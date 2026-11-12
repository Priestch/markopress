/**
 * strapi loader 单元测试（mock fetch，零网络）。形状基准：docs/strapi-loader-design.md
 * §1/§3 + gatsby-source-strapi 5.x 交叉验证（v4 attributes/data 包装、v5 扁平、documentId||id）。
 */
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { markdownEntryType } from '../../src/markdown/entry-type.ts'
import { strapi, type StrapiOptions } from '../../src/content/loaders/strapi.ts'
import {
	defineCollection,
	metaFile,
	MutableStore,
	PersistentMetaStore,
} from '../../src/content/index.ts'
import { ContentSyncer } from '../../src/content/sync.ts'
import type { ContentConfig } from '../../src/content/types.ts'
import { assertNoLiteralSecrets } from '../../src/plugins.ts'
import { countingSchema, makeTmpDir, silentLogger } from './helpers.ts'

const schema = z.object({
	title: z.string(),
	publishAt: z.string(),
	medias: z
		.array(z.object({ alt: z.string(), url: z.string(), mime: z.string().optional() }))
		.default([]),
	frontmatter: z.record(z.string(), z.unknown()).optional(),
})

async function makeFixture(options?: {
	schema?: z.ZodType
	loaderOptions?: Partial<StrapiOptions>
}) {
	const dir = await makeTmpDir()
	const storeDir = join(dir, '.markopress', 'store')
	const store = await MutableStore.fromDir(storeDir)
	const meta = await PersistentMetaStore.fromFile(metaFile(storeDir))
	const syncer = new ContentSyncer({
		store,
		meta,
		logger: silentLogger(),
		entryTypes: [markdownEntryType],
		version: 'test-1',
	})
	const loader = strapi({
		url: 'https://strapi.test',
		token: 't0k3n',
		contentType: 'pdflux-changelog',
		retryDelayMs: 1,
		...options?.loaderOptions,
	})
	const config = (): ContentConfig => ({
		digest: 'fixed-digest',
		collections: {
			changelog: defineCollection({ loader, schema: options?.schema ?? schema }),
		},
	})
	return { dir, store, syncer, config }
}

/** 按 pagination[page] 序号回放预置响应体；记录每次请求 URL */
function mockFetch(pages: Array<unknown>) {
	const fn = vi.fn(async (input: string | URL) => {
		const url = String(input)
		const page = Number(/pagination\[page\]=(\d+)/.exec(url)?.[1] ?? 1)
		const body = pages[page - 1] ?? { data: [], meta: { pagination: { page, pageCount: pages.length } } }
		return new Response(JSON.stringify(body), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		})
	})
	vi.stubGlobal('fetch', fn)
	return fn
}

/** v4 REST 扁平形状（默认路径基准，blockers #3 生产实例实测）：字段在 attributes 下、
 *  content 为扁平 Rich Text 字符串、媒体数组包 data（v4 媒体包装与内容形状无关） */
function v4Row(id: number): Record<string, unknown> {
	return {
		id,
		attributes: {
			title: `Release ${id}`,
			publishAt: '2026-10-01T00:00:00.000Z',
			content: `---\nversion: 1.0.${id}\ndate: "2026-10-0${id}"\n---\n\n# Hello ${id}`,
			medias: {
				data: [
					{
						id: 5000 + id,
						attributes: {
							alternativeText: `图 ${id}`,
							url: `/uploads/a${id}.png`,
							mime: 'image/png',
						},
					},
				],
			},
		},
	}
}

/** v4 组件包装形状（显式路径用例）：content/medias 在单组件的 data/attributes 里——
 *  contentPath 'content.content' / mediaPath 'content.medias' */
function wrappedV4Row(id: number): Record<string, unknown> {
	return {
		id,
		attributes: {
			title: `Release ${id}`,
			publishAt: '2026-10-01T00:00:00.000Z',
			content: {
				data: {
					id: 1000 + id,
					attributes: {
						content: `---\nversion: 1.0.${id}\ndate: "2026-10-0${id}"\n---\n\n# Hello ${id}`,
						medias: {
							data: [
								{
									id: 5000 + id,
									attributes: {
										alternativeText: `图 ${id}`,
										url: `/uploads/a${id}.png`,
										mime: 'image/png',
									},
								},
							],
						},
					},
				},
			},
		},
	}
}

afterEach(() => {
	vi.unstubAllGlobals()
	vi.unstubAllEnvs()
})

describe('strapi loader：v4 形状全链路', () => {
	it('分页拉全 + 包装摊平 + frontmatter 剥离进 data.frontmatter + 媒体相对 URL 绝对化', async () => {
		const f = await makeFixture()
		const fetchMock = mockFetch([
			{ data: [v4Row(1), v4Row(2)], meta: { pagination: { page: 1, pageCount: 2 } } },
			{ data: [v4Row(3)], meta: { pagination: { page: 2, pageCount: 2 } } },
		])
		await f.syncer.sync(f.config())

		expect(fetchMock).toHaveBeenCalledTimes(2)
		const urls = fetchMock.mock.calls.map((c) => String(c[0]))
		expect(urls[0]).toContain('https://strapi.test/api/pdflux-changelogs?')
		expect(urls[0]).toContain('pagination[page]=1')
		expect(urls[0]).toContain('pagination[pageSize]=100')
		expect(urls[0]).toContain('publicationState=live')
		expect(urls[0]).toContain('populate=')
		expect(urls[1]).toContain('pagination[page]=2')

		const ids = f.store
			.values('changelog')
			.map((e) => e.id)
			.sort()
		expect(ids).toEqual(['1', '2', '3'])

		const first = f.store.get('changelog', '1')!
		expect(first.data.title).toBe('Release 1')
		expect(first.data.publishAt).toBe('2026-10-01T00:00:00.000Z')
		expect(first.data.frontmatter).toMatchObject({ version: '1.0.1', date: '2026-10-01' })
		// body 与文件集合形态一致：frontmatter 已剥离、正文保留
		expect(first.body).toContain('# Hello 1')
		expect(first.body).not.toContain('version')
		expect(first.contentType).toBe('text/markdown')
		expect(first.filePath).toBeUndefined()
		// slug 从 frontmatter.version 派生（sanitized）
		expect(first.slug).toBe('1-0-1')
		// 媒体：v4 attributes 摊平 + 相对 URL 绝对化
		expect(first.data.medias[0]).toMatchObject({
			alt: '图 1',
			url: 'https://strapi.test/uploads/a1.png',
			mime: 'image/png',
		})
	})
})

describe('strapi loader：v5 形状', () => {
	it('documentId 作 id；扁平形状原样透传；绝对媒体 URL 不动', async () => {
		const f = await makeFixture()
		mockFetch([
			{
				data: [
					{
						id: 7,
						documentId: 'abc123',
						title: 'V5 Release',
						publishAt: '2026-11-01T00:00:00.000Z',
						content: '---\nversion: 2.0.0\n---\n\n# V5 body',
						medias: [
							{ id: 9, alternativeText: 'pic', url: 'https://cdn.test/x.png', mime: 'image/png' },
						],
					},
				],
				meta: { pagination: { page: 1, pageCount: 1 } },
			},
		])
		await f.syncer.sync(f.config())

		const entry = f.store.get('changelog', 'abc123')
		expect(entry).toBeDefined()
		expect(entry!.data.title).toBe('V5 Release')
		expect(entry!.body).toContain('# V5 body')
		expect(entry!.slug).toBe('2-0-0')
		expect(entry!.data.medias[0].url).toBe('https://cdn.test/x.png')
	})
})

describe('strapi loader：组件包装形态（显式路径）', () => {
	it("contentPath 'content.content' / mediaPath 'content.medias'：dig 途中摊平包装，与扁平默认等效", async () => {
		const f = await makeFixture({
			loaderOptions: { contentPath: 'content.content', mediaPath: 'content.medias' },
		})
		mockFetch([{ data: [wrappedV4Row(4)], meta: { pagination: { page: 1, pageCount: 1 } } }])
		await f.syncer.sync(f.config())

		const entry = f.store.get('changelog', '4')!
		expect(entry.body).toContain('# Hello 4')
		expect(entry.data.frontmatter).toMatchObject({ version: '1.0.4', date: '2026-10-04' })
		expect(entry.data.medias[0]).toMatchObject({
			alt: '图 4',
			url: 'https://strapi.test/uploads/a4.png',
		})
	})
})

describe('strapi loader：失效与删除语义', () => {
	it('digest 去重：远端未变 ⇒ parseData 不重跑（契约 #1 基准断言）', async () => {
		const counter = { count: 0 }
		const f = await makeFixture({ schema: countingSchema(counter) })
		const pages = [
			{ data: [v4Row(1), v4Row(2)], meta: { pagination: { page: 1, pageCount: 1 } } },
		]
		mockFetch(pages)
		await f.syncer.sync(f.config())
		expect(counter.count).toBe(2)

		mockFetch(pages)
		await f.syncer.sync(f.config())
		expect(counter.count).toBe(2)
	})

	it('untouched 差集删除：远端删除的条目在下一轮全量后消失', async () => {
		const f = await makeFixture()
		mockFetch([{ data: [v4Row(1), v4Row(2)], meta: { pagination: { page: 1, pageCount: 1 } } }])
		await f.syncer.sync(f.config())
		expect(f.store.values('changelog')).toHaveLength(2)

		mockFetch([{ data: [v4Row(2), v4Row(3)], meta: { pagination: { page: 1, pageCount: 1 } } }])
		await f.syncer.sync(f.config())
		const ids = f.store
			.values('changelog')
			.map((e) => e.id)
			.sort()
		expect(ids).toEqual(['2', '3'])
	})
})

describe('strapi loader：fields 额外字段投影', () => {
	it('顶层字段摊平 v4 包装后进 data；schema 未声明的默认集键被 strip', async () => {
		const f = await makeFixture({
			schema: z.object({
				title: z.string(),
				order: z.number().optional(),
				type: z.string().optional(),
				parents: z.unknown().optional(),
			}),
			loaderOptions: { fields: ['type', 'order', 'parents'] },
		})
		mockFetch([
			{
				data: [
					{
						id: 11,
						attributes: {
							title: 'Upload documents',
							publishAt: '2026-11-01T00:00:00.000Z',
							content: '# Upload',
							type: 'Heading_2',
							order: 3,
							parents: { data: { id: 7, attributes: { title: 'Get Started', type: 'Heading_1' } } },
						},
					},
				],
				meta: { pagination: { page: 1, pageCount: 1 } },
			},
		])
		await f.syncer.sync(f.config())

		const entry = f.store.get('changelog', '11')!
		expect(entry.data.type).toBe('Heading_2')
		expect(entry.data.order).toBe(3)
		// 关系摊平：{data:{id,attributes}} → {id, …}（与 gatsby-source-strapi 节点形状同构）
		expect(entry.data.parents).toMatchObject({ id: 7, title: 'Get Started', type: 'Heading_1' })
		// schema 未声明 publishAt/medias ⇒ strip（fields 不等于放行默认集）
		expect(entry.data).not.toHaveProperty('publishAt')
		expect(entry.data).not.toHaveProperty('medias')
	})

	it('未传 fields：默认集之外的字段不进 data（pdflux 形状不变）', async () => {
		const f = await makeFixture()
		mockFetch([
			{
				data: [v4Row(1)],
				meta: { pagination: { page: 1, pageCount: 1 } },
			},
		])
		await f.syncer.sync(f.config())
		const entry = f.store.get('changelog', '1')!
		expect(Object.keys(entry.data).sort()).toEqual(['frontmatter', 'medias', 'publishAt', 'title'])
	})
})

describe('strapi loader：失败与离线语义', () => {
	it('STRAPI_OFFLINE=1：不 fetch、不动 store（差集不清空）', async () => {
		const f = await makeFixture()
		mockFetch([{ data: [v4Row(1), v4Row(2)], meta: { pagination: { page: 1, pageCount: 1 } } }])
		await f.syncer.sync(f.config())

		vi.stubEnv('STRAPI_OFFLINE', '1')
		const offlineFetch = vi.fn()
		vi.stubGlobal('fetch', offlineFetch)
		await f.syncer.sync(f.config())
		expect(offlineFetch).not.toHaveBeenCalled()
		expect(f.store.values('changelog')).toHaveLength(2)
	})

	it('token 缺失 fail fast（不静默空集合）', async () => {
		const f = await makeFixture({ loaderOptions: { token: undefined } })
		await expect(f.syncer.sync(f.config())).rejects.toThrow(/缺少 token/)
	})

	it('403 不重试，报 token 处置提示', async () => {
		const f = await makeFixture()
		const fn = vi.fn(async () => new Response('{"error":"Forbidden"}', { status: 403 }))
		vi.stubGlobal('fetch', fn)
		await expect(f.syncer.sync(f.config())).rejects.toThrow(/403.*token/)
		expect(fn).toHaveBeenCalledTimes(1)
	})

	it('5xx 重试两次退避，恢复则成功', async () => {
		const f = await makeFixture()
		let calls = 0
		const fn = vi.fn(async () => {
			calls++
			if (calls < 3) return new Response('boom', { status: 500 })
			return new Response(
				JSON.stringify({
					data: [v4Row(1)],
					meta: { pagination: { page: 1, pageCount: 1 } },
				}),
				{ status: 200 },
			)
		})
		vi.stubGlobal('fetch', fn)
		await f.syncer.sync(f.config())
		expect(fn).toHaveBeenCalledTimes(3)
		expect(f.store.values('changelog')).toHaveLength(1)
	})

	it('5xx 三连 ⇒ fail fast（已重试 2 次）', async () => {
		const f = await makeFixture()
		vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 503 })))
		await expect(f.syncer.sync(f.config())).rejects.toThrow(/已重试 2 次/)
	})
})

describe('assertNoLiteralSecrets（装配期字面量密钥扫描，design §7）', () => {
	it('token: 字面量被拒；process.env 透传放行', async () => {
		const dir = await makeTmpDir()
		const bad = join(dir, 'config.ts')
		await writeFile(
			bad,
			`export default { collections: { c: { loader: strapi({ url: 'https://x', token: 'secret-value', contentType: 'y' }) } } }`,
		)
		expect(() => assertNoLiteralSecrets(bad)).toThrow(/字面量密钥.*token/)

		const good = join(dir, 'config2.ts')
		await writeFile(
			good,
			`export default { collections: { c: { loader: strapi({ url: 'https://x', token: process.env.STRAPI_TOKEN, contentType: 'y' }) } } }`,
		)
		expect(() => assertNoLiteralSecrets(good)).not.toThrow()
	})
})

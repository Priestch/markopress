import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ContentEntryDataError, parseEntryData } from '../src/parse-data.ts'

describe('parseEntryData', () => {
	it('无 schema ⇒ 数据透传', async () => {
		const data = { any: 'thing', n: 1 }
		await expect(parseEntryData({ id: 'a', collection: 'docs', data })).resolves.toBe(data)
	})

	it('合法数据 ⇒ 返回 schema 输出（含 transform 与默认值）', async () => {
		const schema = z.object({
			title: z.string(),
			tags: z.array(z.string()).default([]),
			pubDate: z.coerce.date(),
		})
		const out = await parseEntryData({
			id: 'a',
			collection: 'docs',
			data: { title: 'A', pubDate: '2026-10-14' },
			schema,
		})
		expect(out).toEqual({ title: 'A', tags: [], pubDate: new Date('2026-10-14') })
	})

	it('非法数据 ⇒ ContentEntryDataError，信息带 collection/id/filePath 与字段路径', async () => {
		const schema = z.object({
			title: z.string(),
			count: z.number(),
		})
		let error: unknown
		try {
			await parseEntryData({
				id: 'my-entry',
				collection: 'docs',
				filePath: 'content/my-entry.tmd',
				data: { title: 42, count: 'x' },
				schema,
			})
		} catch (e) {
			error = e
		}
		expect(error).toBeInstanceOf(ContentEntryDataError)
		const message = String(error)
		expect(message).toContain('"my-entry"')
		expect(message).toContain('"docs"')
		expect(message).toContain('content/my-entry.tmd')
		expect(message).toContain('data.title')
		expect(message).toContain('data.count')
	})

	it('异步 transform 也走 safeParseAsync', async () => {
		const schema = z.object({ id: z.string() }).transform(async (v) => ({ ...v, doubled: true }))
		await expect(
			parseEntryData({ id: 'a', collection: 'docs', data: { id: 'x' }, schema }),
		).resolves.toEqual({ id: 'x', doubled: true })
	})
})

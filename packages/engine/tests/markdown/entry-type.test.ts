import { describe, expect, it } from 'vitest'
import { markdownEntryType } from '../../src/markdown/entry-type.ts'

const fileUrl = new URL('file:///site/content/post.md')

describe('markdownEntryType', () => {
	it('声明 .md / text/markdown', () => {
		expect(markdownEntryType.extensions).toEqual(['.md'])
		expect(markdownEntryType.contentType).toBe('text/markdown')
	})

	it('getEntryInfo：frontmatter → data，body 原文，slug 透传', async () => {
		const info = await markdownEntryType.getEntryInfo({
			contents: '---\ntitle: T\nslug: custom\n---\n\n正文 **md**',
			fileUrl,
		})
		expect(info.data).toEqual({ title: 'T', slug: 'custom' })
		expect(info.body).toBe('\n正文 **md**')
		expect(info.slug).toBe('custom')
	})

	it('无 slug 字段 ⇒ slug undefined（glob 会回退路径派生 id）', async () => {
		const info = await markdownEntryType.getEntryInfo({
			contents: '# no frontmatter',
			fileUrl,
		})
		expect(info.slug).toBeUndefined()
		expect(info.data).toEqual({})
	})

	it('坏 frontmatter 的错误能穿透 getEntryInfo（带路径）', async () => {
		await expect(
			markdownEntryType.getEntryInfo({ contents: '---\nbad: [yaml\n---\nx', fileUrl }),
		).rejects.toThrow(/\/site\/content\/post\.md/)
	})
})

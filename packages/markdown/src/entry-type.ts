/**
 * '.md' 的 EntryType 实现：把 markdown 「一种内容格式」接进 content layer 的
 * 唯一耦合点。frontmatter → data，body 原文进 store；渲染不在这（render.ts，
 * 由 app 的虚拟模块按 digest 惰性调用）。
 */
import type { EntryType } from '@markopress/content'
import { parseFrontmatter } from './frontmatter.ts'

export const MARKDOWN_CONTENT_TYPE = 'text/markdown'

export const markdownEntryType: EntryType = {
	extensions: ['.md'],
	contentType: MARKDOWN_CONTENT_TYPE,
	async getEntryInfo({ contents, fileUrl }) {
		const { data, body } = parseFrontmatter(contents, fileUrl)
		return { data, body, slug: typeof data.slug === 'string' ? data.slug : undefined }
	},
}

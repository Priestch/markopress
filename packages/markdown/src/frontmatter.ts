/**
 * frontmatter 拆分：gray-matter（js-yaml）。「坏 frontmatter 报错可读」从这开始——
 * YAML 异常包装成带文件路径的错误，向上由 glob/sync 冒泡到 dev 终端。
 */
import matter from 'gray-matter'

export class FrontmatterError extends Error {
	readonly fileUrl: URL

	constructor(fileUrl: URL, cause: unknown) {
		const path = fileUrl.pathname.replace(/^\/([A-Za-z]:)/, '$1')
		const reason = cause instanceof Error ? cause.message : String(cause)
		super(`Invalid frontmatter in ${path}:\n  ${reason}`)
		this.name = 'FrontmatterError'
		this.fileUrl = fileUrl
		if (cause instanceof Error) this.cause = cause
	}
}

export interface ParsedMarkdown {
	/** frontmatter 数据（无 frontmatter 则空对象） */
	data: Record<string, unknown>
	/** 去掉 frontmatter 块后的正文源文本 */
	body: string
}

export function parseFrontmatter(contents: string, fileUrl: URL): ParsedMarkdown {
	try {
		const parsed = matter(contents)
		return { data: parsed.data ?? {}, body: parsed.content }
	} catch (error) {
		throw new FrontmatterError(fileUrl, error)
	}
}

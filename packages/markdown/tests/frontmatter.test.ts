import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FrontmatterError, parseFrontmatter } from '../src/frontmatter.ts'

const fileUrl = pathToFileURL('/site/content/post.md')

describe('parseFrontmatter', () => {
	it('标准块：data 与 body 分离', () => {
		const parsed = parseFrontmatter('---\ntitle: Hello\nnum: 42\ntags:\n  - a\n  - b\n---\n\n# Body\n', fileUrl)
		expect(parsed.data).toEqual({ title: 'Hello', num: 42, tags: ['a', 'b'] })
		expect(parsed.body).toBe('\n# Body\n')
	})

	it('无 frontmatter：data 为空对象，body 原样', () => {
		const parsed = parseFrontmatter('# 只是正文', fileUrl)
		expect(parsed.data).toEqual({})
		expect(parsed.body).toBe('# 只是正文')
	})

	it('CRLF 行尾', () => {
		const parsed = parseFrontmatter('---\r\ntitle: Win\r\n---\r\nbody', fileUrl)
		expect(parsed.data).toEqual({ title: 'Win' })
		expect(parsed.body).toBe('body')
	})

	it('正文里出现 --- 分隔线不受影响', () => {
		const parsed = parseFrontmatter('---\ntitle: T\n---\na\n\n---\n\nb', fileUrl)
		expect(parsed.data).toEqual({ title: 'T' })
		expect(parsed.body).toBe('a\n\n---\n\nb')
	})

	it('坏 YAML：FrontmatterError 且信息带文件路径', () => {
		let error: unknown
		try {
			parseFrontmatter('---\ntitle: [unclosed\n---\nbody', fileUrl)
		} catch (e) {
			error = e
		}
		expect(error).toBeInstanceOf(FrontmatterError)
		const message = String(error)
		expect(message).toContain('/site/content/post.md')
		expect(message).toContain('Invalid frontmatter')
	})
})

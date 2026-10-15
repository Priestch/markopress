import { describe, expect, it } from 'vitest'
import { createMarkdownRenderer } from '../src/render.ts'

describe('createMarkdownRenderer', () => {
	it('基本渲染：html 段 + 标题 id + headings 收集', async () => {
		const renderer = createMarkdownRenderer()
		const { segments, headings } = await renderer.render({
			digest: 'd1',
			body: '# Intro\n\n一些 **加粗**\n\n## 子节 标题\n',
		})
		expect(segments).toHaveLength(1)
		expect(segments[0]!.type).toBe('html')
		expect(segments[0]!.html).toContain('<h1 id="intro">Intro</h1>')
		expect(segments[0]!.html).toContain('<strong>加粗</strong>')
		// 中文标题 → slug 保留 Unicode
		expect(segments[0]!.html).toContain('<h2 id="子节-标题">')
		expect(headings).toEqual([
			{ depth: 1, slug: 'intro', text: 'Intro' },
			{ depth: 2, slug: '子节-标题', text: '子节 标题' },
		])
	})

	it('gfm：表格 / 删除线 / 任务列表', async () => {
		const renderer = createMarkdownRenderer()
		const { segments } = await renderer.render({
			digest: 'd2',
			body: '| a | b |\n| --- | --- |\n| 1 | 2 |\n\n~~gone~~\n\n- [x] done\n',
		})
		expect(segments[0]!.html).toContain('<table>')
		expect(segments[0]!.html).toContain('<del>gone</del>')
		expect(segments[0]!.html).toContain('type="checkbox" checked')
	})

	it('代码块：转义且无高亮（shiki 是后续增量）', async () => {
		const renderer = createMarkdownRenderer()
		const { segments } = await renderer.render({
			digest: 'd3',
			body: '```js\nconst a = "<b>"\n```\n',
		})
		expect(segments[0]!.html).toContain('<code class="language-js">')
		expect(segments[0]!.html).not.toContain('<b>') // 转义了，没有被当 HTML
	})

	it('原始 HTML 透传（allowDangerousHtml）', async () => {
		const renderer = createMarkdownRenderer()
		const { segments } = await renderer.render({
			digest: 'd4',
			body: '<div class="raw">hi</div>\n',
		})
		expect(segments[0]!.html).toContain('<div class="raw">hi</div>')
	})

	it('重复标题：github-slugger 递增后缀', async () => {
		const renderer = createMarkdownRenderer()
		const { headings } = await renderer.render({
			digest: 'd5',
			body: '## Same\n\n## Same\n',
		})
		expect(headings.map((h) => h.slug)).toEqual(['same', 'same-1'])
	})

	it('digest 缓存：同 digest 不重渲染；变 digest 才重算', async () => {
		const renderer = createMarkdownRenderer()
		const first = await renderer.render({ digest: 'same', body: '# Cache\n' })
		const second = await renderer.render({ digest: 'same', body: '# Cache CHANGED\n' })
		// 缓存命中：body 不同也没用（约定：digest 是唯一键，调用方保证一致性）
		expect(second).toBe(first)
		expect(renderer.cacheHits).toBe(1)
		const third = await renderer.render({ digest: 'other', body: '# Other\n' })
		expect(third.segments[0]!.html).toContain('<h1 id="other">Other</h1>')
		expect(renderer.cacheHits).toBe(1) // 未命中 → 真渲染，命中率不涨
	})
})

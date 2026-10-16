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

	it('代码块：shiki 默认开（双主题变量 + 转义）', async () => {
		const renderer = createMarkdownRenderer()
		const { segments } = await renderer.render({
			digest: 'd3',
			body: '```js\nconst a = "<b>"\n```\n',
		})
		const html = segments[0]!.html
		expect(html).toContain('class="shiki') // pre.shiki
		expect(html).toContain('--shiki-dark') // 双主题：dark 走 CSS 变量
		expect(html).not.toContain('<b>') // 转义了，没有被当 HTML
	}, 30_000)

	it('shiki:false → 朴素 language-xxx，无高亮', async () => {
		const renderer = createMarkdownRenderer({ shiki: false })
		const { segments } = await renderer.render({
			digest: 'd3-off',
			body: '```js\nconst a = 1\n```\n',
		})
		expect(segments[0]!.html).toContain('<code class="language-js">')
		expect(segments[0]!.html).not.toContain('shiki')
	})

	it('未知语言：回退纯文本，不抛错（懒加载 + fallbackLanguage）', async () => {
		const renderer = createMarkdownRenderer()
		const { segments } = await renderer.render({
			digest: 'd3-fallback',
			body: '```notalang\nx = 1\n```\n',
		})
		// 不炸、代码文本保留（text 特殊语言渲染，无高亮 token 也可接受）
		expect(segments[0]!.html).toContain('x = 1')
	}, 30_000)

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

describe('R1 配置直通 + 容器', () => {
	// mdast/hast 最小节点面（测试内联插件用，不值得为断言引类型包）
	interface TNode {
		type: string
		value?: string
		children?: Array<TNode>
	}

	it('remarkPlugins：在 gfm 之后、rehype 之前生效', async () => {
		const append = () => (tree: TNode) => {
			tree.children!.push({ type: 'paragraph', children: [{ type: 'text', value: 'REMARKED' }] })
		}
		const renderer = createMarkdownRenderer({ remarkPlugins: [append] })
		const { segments } = await renderer.render({ digest: 'r1', body: '# T\n' })
		expect(segments[0]!.html).toContain('<p>REMARKED</p>')
	})

	it('rehypePlugins：在内置 shiki 之后生效（看得见高亮产物）', async () => {
		const tag = () => (tree: TNode) => {
			for (const child of tree.children ?? []) {
				if (child.type === 'element' && (child as { tagName?: string }).tagName === 'pre') {
					(child as { properties?: Record<string, unknown> }).properties ??= {}
					;(child as { properties?: Record<string, unknown> }).properties!.dataRehyped = '1'
				}
			}
		}
		const renderer = createMarkdownRenderer({ rehypePlugins: [tag] })
		const { segments } = await renderer.render({ digest: 'r2', body: '```js\nx\n```\n' })
		expect(segments[0]!.html).toContain('data-rehyped="1"')
		expect(segments[0]!.html).toContain('class="shiki') // 内置 shiki 已跑过
	}, 30_000)

	it('::: 容器 → mp-container div；未知名也不丢内容', async () => {
		const renderer = createMarkdownRenderer({ shiki: false })
		const { segments } = await renderer.render({
			digest: 'r3',
			body: ':::tip\nhello **bold**\n:::\n\n:::custom\nunknown name\n:::\n',
		})
		const html = segments[0]!.html
		expect(html).toContain('<div class="mp-container mp-tip">')
		expect(html).toContain('<strong>bold</strong>')
		expect(html).toContain('<div class="mp-container mp-custom">')
		expect(html).toContain('unknown name')
	})

	it('自配 shiki 主题（themes 透传）', async () => {
		const renderer = createMarkdownRenderer({
			shiki: { themes: { light: 'vitesse-light', dark: 'vitesse-dark' } },
		})
		const { segments } = await renderer.render({ digest: 'r4', body: '```js\nx\n```\n' })
		expect(segments[0]!.html).toContain('vitesse-light')
	}, 30_000)
})

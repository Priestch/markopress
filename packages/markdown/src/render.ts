/**
 * unified 渲染器：md 源文本 → { segments, headings }。
 * - segments 数组是「md 内 Marko 标签穿插」的门（deltas #1：渲染惰性、按 digest
 *   内存缓存，渲染器不进 store）；本期只有 html 段。
 * - headings 供目录/锚点：rehype-slug 先打 id，收集插件随后读进 vfile.data。
 * - 不加 rehype-raw：原始 HTML 节点透传到输出（allowDangerousHtml），但插件看不见
 *   它们——内嵌 <h2> 拿不到 slug id，属已知边界（上游 Astro 默认管线同样不收集它们）。
 */
import type { Root, RootContent } from 'hast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'

/** 本期唯一段型；component 段是未来的门 */
export interface MarkdownSegment {
	type: 'html'
	html: string
}

export interface MarkdownHeading {
	depth: number
	slug: string
	text: string
}

export interface RenderedMarkdown {
	segments: Array<MarkdownSegment>
	headings: Array<MarkdownHeading>
}

export interface RenderInput {
	/** entry 的内容 digest，缓存键；entry 未变则不重渲染 */
	digest: string
	/** md 正文源文本（store 里的 body） */
	body: string
}

/** hast 节点纯文本（不值得为它引 hast-util-to-string） */
function nodeText(node: RootContent): string {
	if (node.type === 'text') return node.value
	if ('children' in node && Array.isArray(node.children)) {
		return (node.children as Array<RootContent>).map(nodeText).join('')
	}
	return ''
}

/** rehype 插件：收集带 id 的 h1-h6 到 vfile.data.mpHeadings（须排在 rehype-slug 之后） */
function rehypeCollectHeadings() {
	return (tree: Root, file: { data: Record<string, unknown> }) => {
		const headings: Array<MarkdownHeading> = []
		for (const node of tree.children) {
			if (node.type === 'element' && /^h[1-6]$/.test(node.tagName)) {
				const id = node.properties?.id
				if (typeof id === 'string') {
					headings.push({
						depth: Number(node.tagName.slice(1)),
						slug: id,
						text: nodeText(node),
					})
				}
			}
		}
		file.data.mpHeadings = headings
	}
}

export interface MarkdownRenderer {
	render(input: RenderInput): Promise<RenderedMarkdown>
	/** 命中缓存的次数（测试/观测用） */
	readonly cacheHits: number
}

export function createMarkdownRenderer(): MarkdownRenderer {
	// processor 单例复用（unified 推荐用法）：插件只初始化一次，process 每次独立
	const processor = unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeSlug)
		.use(rehypeCollectHeadings)
		.use(rehypeStringify, { allowDangerousHtml: true })

	const cache = new Map<string, RenderedMarkdown>()
	let cacheHits = 0

	return {
		get cacheHits() {
			return cacheHits
		},
		async render({ digest, body }) {
			const hit = cache.get(digest)
			if (hit) {
				cacheHits++
				return hit
			}
			const file = await processor.process(body)
			const result: RenderedMarkdown = {
				segments: [{ type: 'html', html: String(file) }],
				headings: (file.data.mpHeadings as Array<MarkdownHeading>) ?? [],
			}
			cache.set(digest, result)
			return result
		},
	}
}

/**
 * unified 渲染器：md 源文本 → { segments, headings }。
 * - segments 数组是「md 内 Marko 标签穿插」的门（deltas #1：渲染惰性、按 digest
 *   内存缓存，渲染器不进 store）；本期只有 html 段。
 * - headings 供目录/锚点：rehype-slug 先打 id，收集插件随后读进 vfile.data。
 * - 不加 rehype-raw：原始 HTML 节点透传到输出（allowDangerousHtml），但插件看不见
 *   它们——内嵌 <h2> 拿不到 slug id，属已知边界（上游 Astro 默认管线同样不收集它们）。
 */
import type { BundledTheme } from 'shiki'
import rehypeShiki from '@shikijs/rehype'
import type { Root, RootContent } from 'hast'
import type { PluggableList } from 'unified'
import remarkDirective from 'remark-directive'
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

export interface MarkdownShikiOptions {
	/** 双主题：light 内联为默认色，dark 走 --shiki-dark* CSS 变量（切换 CSS 由站点提供） */
	themes: { light: BundledTheme; dark: BundledTheme }
}

const DEFAULT_SHIKI_THEMES = { light: 'github-light', dark: 'github-dark' } as const

export interface MarkdownRendererOptions {
	/** 用户 remark 插件（gfm/containers 之后、remark-rehype 之前） */
	remarkPlugins?: PluggableList
	/** 用户 rehype 插件（内置 slug/shiki 之后、headings 收集之前） */
	rehypePlugins?: PluggableList
	/** 语法高亮，默认开；false 关（自配 @shikijs/rehype 时用） */
	shiki?: MarkdownShikiOptions | false
}

/** mdast 最小面（容器转换用；不值得为 walker 引 unist-util-visit） */
interface MdastNode {
	type: string
	name?: string
	children?: Array<MdastNode>
	data?: { hName?: string; hProperties?: Record<string, unknown> }
}

/**
 * `:::tip … :::` 容器指令（remark-directive 解析）→ `<div class="mp-container mp-<name>">`。
 * 任意容器名都转换（内容永不因未知指令名丢失）；tip/info/warn/danger 有主题样式。
 */
function remarkContainers() {
	const walk = (node: MdastNode) => {
		for (const child of node.children ?? []) {
			if (child.type === 'containerDirective' && child.name) {
				child.data ??= {}
				child.data.hName = 'div'
				child.data.hProperties = {
					...child.data.hProperties,
					class: `mp-container mp-${child.name}`,
				}
			}
			walk(child)
		}
	}
	return (tree: MdastNode) => walk(tree)
}

/** hast 最小面（root 拍平用） */
interface HastNode {
	type: string
	children?: Array<HastNode>
}

/**
 * 拍平嵌套 root：@shikijs/rehype 替换 code 节点时塞入整棵 codeToHast 的 root
 * 文档（root 嵌 root 非规范 hast，仅序列化器容忍）——必须在其后、用户 rehype
 * 之前拍平，否则用户的顶层遍历看不见 pre（实测踩坑）。
 */
function rehypeFlattenRoots() {
	const flatten = (node: HastNode) => {
		const children = node.children
		if (!children) return
		for (let i = 0; i < children.length; ) {
			const child = children[i]!
			if (child.type === 'root') {
				flatten(child)
				const inner = child.children ?? []
				children.splice(i, 1, ...inner)
				i += inner.length
			} else {
				flatten(child)
				i++
			}
		}
	}
	return (tree: HastNode) => flatten(tree)
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

export function createMarkdownRenderer(
	options: MarkdownRendererOptions = {},
): MarkdownRenderer {
	const shiki: MarkdownShikiOptions | false = options.shiki === undefined
		? { themes: { ...DEFAULT_SHIKI_THEMES } }
		: options.shiki
	// processor 单例复用（unified 推荐用法）：插件只初始化一次，process 每次独立。
	// 链序（固定）：parse → gfm → containers → 用户 remark → rehype → slug → shiki
	//   → 用户 rehype → headings 收集 → stringify。内置先行，用户插件看全处理后的树。
	// shiki 懒加载：@shikijs/rehype 不传 langs 会一次性加载全部 ~280 个内置语言
	//   （实测 ~3s/进程）；langs: [] + lazy 则语言首次出现时才进 singleton
	//   （~2-20ms/语言、一次性累积），未知语言回退纯文本而非构建失败。
	const processor = unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkDirective)
		.use(remarkContainers)
		.use(options.remarkPlugins ?? [])
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeSlug)
		.use(
			shiki
				? ([
						[
							rehypeShiki,
							{
								themes: shiki.themes,
								langs: [],
								lazy: true,
								fallbackLanguage: 'text',
							},
						],
						rehypeFlattenRoots,
					] as PluggableList)
				: [],
		)
		.use(options.rehypePlugins ?? [])
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

/**
 * Strapi loader（v4/v5 REST）——无文件系统的内容源。设计与契约走查：
 * docs/strapi-loader-design.md（定稿 2026-11-09，pdflux 实测形状）。
 *
 *   - id：v5 documentId 优先，回退 v4 数字 id（String() 归一）——双形状兼容，无需探测
 *     版本（gatsby-source-strapi 5.x 同款策略：`documentId || id`）
 *   - v4 REST 包装归一：v4 把字段包在 attributes 下、组件/媒体再包 data
 *     （attributes.content.data.attributes.content）；v5 扁平（content.content）。
 *     dig() 沿路径逐层摊平包装，v5 形状原样透传——contentPath/mediaPath 按摊平后
 *     的逻辑路径书写，v4/v5 同一条路径。启发式：组件字段恰好叫 "data"/"attributes"
 *     会误判（pdflux 组件字段是 content/medias/videos，不撞）
 *   - body：contentPath（默认 'content'——扁平 Rich Text 字符串，pdflux-changelog
 *     实测形状；组件包装形态显式传 'content.content'）取 md 源文本，经
 *     '.md' entryType 的 getEntryInfo 剥离 frontmatter——store 里的 body 与文件集合
 *     形态一致（渲染器不剥离 frontmatter，剥离只发生在 load 期）；frontmatter 数据
 *     嵌套进 data.frontmatter（与 REST 列分源，永不撞名）
 *   - slug：frontmatter slug 回退 version（sanitized）；都无 ⇒ String(id)
 *   - digest：整个 REST entry（改 title 也失效）；命中在 parseData 之前跳过（契约 #1，
 *     与 glob 的比对位置一致）
 *   - 全量轮：分页拉全 + untouched 差集删除（Strapi 删除只有全量对比能发现；
 *     差集是 loader 的策略，sync 编排层不做——契约失效三件套之二）
 *   - token 只走 env：缺失 fail fast；字面量由装配期源码扫描拦截（plugins.ts，
 *     assertNoLiteralSecrets）；token 只进 Authorization 头，日志/错误不回显
 *   - STRAPI_OFFLINE=1：不 fetch、不动 store（差集会清空）、warn 后返回
 */
import type { Loader, LoaderContext } from '../types.ts'

export interface StrapiMedia {
	alt: string
	/** 绝对 URL（相对路径已按 loader url 绝对化） */
	url: string
	mime?: string
}

export interface StrapiOptions {
	/** 实例基址（如 https://strapi.example.com；尾斜杠 tolerated） */
	url: string
	/** Bearer token——只从 process.env 读；字面量会被装配期扫描拒绝（design §7） */
	token?: string
	/** 内容类型 uid（如 'pdflux-changelog'）；REST 端点按复数规则派生（末尾 +s） */
	contentType: string
	/** 显式端点（复数不规则的类型用它；如 '/api/my-news'） */
	endpoint?: string
	/** populate 参数；默认 '*'（单组件内嵌形状需要） */
	populate?: string
	/** 分页大小；默认 100 */
	pageSize?: number
	/** md 源文本的取值路径（摊平后形状）；默认 'content'（扁平 Rich Text 字符串，
	 *  pdflux-changelog 生产实例实测）；单组件包装形态显式传 'content.content' */
	contentPath?: string
	/** 媒体数组的取值路径（摊平后形状）；默认 'medias'（扁平形状与 content 同级）；
	 *  单组件包装形态显式传 'content.medias' */
	mediaPath?: string
	/** 额外字段投影：REST row 顶层字段名清单（如 chatdoc-guide 的
	 *  type/order/parents/seo），摊平 v4 包装（attributes/data）后原样进 data——
	 *  形状由站点 zod schema 把关（z.object 默认 strip 未声明键）。默认集
	 *  （title/publishAt/medias）之外的字段走这里；关系字段摊平后是
	 *  {id, …attributes}，与 gatsby-source-strapi 节点形状同构，够站点按 id 链接 */
	fields?: string[]
	/** 重试退避基数（毫秒）；测试注入用，默认 300 */
	retryDelayMs?: number
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** v4 的 attributes 包装：{id, attributes:{…}} → {id, …}；v5 无此包装原样透传 */
function unwrapAttributes(node: unknown): unknown {
	if (isPlainObject(node) && isPlainObject(node.attributes)) {
		return { id: node.id, ...(node.attributes as Record<string, unknown>) }
	}
	return node
}

/** v4 的 data 包装（组件 {data:{…}} / 媒体数组 {data:[…]}）；v5 无此包装原样透传 */
function unwrapData(node: unknown): unknown {
	if (isPlainObject(node) && isPlainObject(node.data)) return node.data
	if (isPlainObject(node) && Array.isArray(node.data)) return node.data
	return node
}

/** 沿点路径取值，途中摊平 v4 包装（attributes/data）——contentPath/mediaPath 按
 *  摊平后的逻辑路径书写，v4/v5 实例同一条路径 */
function dig(source: unknown, path: string): unknown {
	let current = unwrapAttributes(source)
	for (const key of path.split('.')) {
		if (!isPlainObject(current)) return undefined
		current = unwrapAttributes(unwrapData(current[key]))
	}
	return current
}

/** URL 友好化：小写、连续非字母数字折叠为 '-'、去首尾 '-'；结果空 → undefined */
function slugify(value: string): string | undefined {
	const slug = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
	return slug || undefined
}

function absoluteUrl(url: string, base: string): string {
	if (/^https?:\/\//i.test(url)) return url
	return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}

/** 带重试的 GET：网络错误/超时/5xx 重试 2 次退避；4xx 立即报错（带处置提示） */
async function fetchJson(
	url: string,
	token: string,
	retryDelayMs: number,
	logger: LoaderContext['logger'],
): Promise<unknown> {
	const attempts = 3 // 首次 + 2 次重试（design §4）
	let lastError: unknown
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			const response = await fetch(url, {
				headers: { Authorization: `Bearer ${token}` },
				signal: AbortSignal.timeout(30_000),
			})
			if (response.ok) return await response.json()
			const body = await response.text().catch(() => '')
			if (response.status >= 500) throw new Error(`HTTP ${response.status}`)
			// 4xx 不重试——带处置提示报错（[strapi] 前缀 = 下方 catch 的不可重试标记）
			if (response.status === 401 || response.status === 403) {
				throw new Error(
					`[strapi] HTTP ${response.status}（token 无效或无权访问 ${url.split('?')[0]}）——检查 token 环境变量与 token 权限`,
				)
			}
			if (response.status === 404) {
				throw new Error(
					`[strapi] HTTP 404（${url.split('?')[0]}）——contentType 复数派生可能不符，用 endpoint 选项显式指定`,
				)
			}
			throw new Error(`[strapi] HTTP ${response.status}: ${body.slice(0, 200)}`)
		} catch (error) {
			// 带 [strapi] 前缀的（4xx 处置提示）不可重试，直接抛
			if (error instanceof Error && error.message.startsWith('[strapi]')) throw error
			lastError = error
			if (attempt < attempts) {
				const delay = retryDelayMs * attempt
				logger.warn(`请求失败（${String(error)}），${delay}ms 后重试（${attempt}/${attempts - 1}）`)
				await new Promise((resolve) => setTimeout(resolve, delay))
			}
		}
	}
	throw new Error(
		`[strapi] 请求失败（已重试 ${attempts - 1} 次）：${lastError instanceof Error ? lastError.message : String(lastError)} —— ${url.split('?')[0]}`,
	)
}

/** v4 复数派生（末尾 +s）——不规则复数用 endpoint 选项覆盖（gatsby-source-strapi
 *  干脆不派生、让用户传复数名；我们派生默认 + 显式覆盖两个口都留） */
function deriveEndpoint(contentType: string): string {
	return `/api/${contentType}s`
}

export function strapi(options: StrapiOptions): Loader {
	if (!options.url || typeof options.url !== 'string') {
		throw new Error('[strapi] options.url 必须是非空字符串（Strapi 实例基址）')
	}
	if (!options.contentType || typeof options.contentType !== 'string') {
		throw new Error('[strapi] options.contentType 必须是非空字符串（内容类型 uid）')
	}
	const base = options.url.replace(/\/+$/, '')
	const endpoint = options.endpoint
		? options.endpoint.startsWith('/')
			? options.endpoint
			: `/${options.endpoint}`
		: deriveEndpoint(options.contentType)
	const populate = options.populate ?? '*'
	const pageSize = options.pageSize ?? 100
	// 默认 = 扁平形状（blockers #3：真实 pdflux-changelog REST 的 content 是扁平字符串，
	// 102 条生产实例验证；组件包装形态两条路径显式传 'content.content'/'content.medias'）
	const contentPath = options.contentPath ?? 'content'
	const mediaPath = options.mediaPath ?? 'medias'

	return {
		name: 'strapi',

		load: async (ctx) => {
			// 离线模式（design §4）：不 fetch、不动 store（untouched 差集会把 store 清空）
			if (process.env.STRAPI_OFFLINE === '1') {
				ctx.logger.warn('STRAPI_OFFLINE=1——跳过拉取，使用 store 现存数据（可能过期）')
				return
			}
			if (!options.token) {
				throw new Error(
					`[strapi] 缺少 token——只从环境变量读（如 token: process.env.STRAPI_TOKEN），不要写字面量（design §7）`,
				)
			}

			/** 本轮见过的 id；循环结束后差集删除（Strapi 删除只有全量对比能发现） */
			const seen = new Set<string>()

			for (let page = 1; ; page++) {
				const url =
					`${base}${endpoint}?populate=${encodeURIComponent(populate)}` +
					`&pagination[page]=${page}&pagination[pageSize]=${pageSize}` +
					`&publicationState=live`
				const payload = (await fetchJson(
					url,
					options.token,
					options.retryDelayMs ?? 300,
					ctx.logger,
				)) as {
					data?: Array<Record<string, unknown>>
					meta?: { pagination?: { pageCount?: number } }
				}
				for (const raw of payload.data ?? []) {
					// 顶层 v4 attributes 包装摊平（v5 原样）；id：v5 documentId 优先，回退 v4 数字 id
					const row = unwrapAttributes(raw) as Record<string, unknown>
					const rawId = row.documentId ?? row.id
					if (rawId === undefined || rawId === null) {
						ctx.logger.warn(`entry 缺 id/documentId，跳过：${JSON.stringify(raw).slice(0, 120)}`)
						continue
					}
					const id = String(rawId)
					seen.add(id)

					// digest 命中在 parseData 之前跳过（契约 #1；整个 REST entry 参与指纹）
					const digest = ctx.generateDigest(raw)
					if (ctx.store.get(id)?.digest === digest) continue

					// body：md 源文本经 '.md' entryType 剥离 frontmatter（渲染器不剥离）
					let body: string | undefined
					let frontmatter: Record<string, unknown> | undefined
					let slug: string | undefined
					const rawBody = dig(row, contentPath)
					if (typeof rawBody === 'string' && rawBody.trim() !== '') {
						const entryType = ctx.entryTypes.get('.md')
						if (!entryType) {
							throw new Error(
								"[strapi] 需要 '.md' entryType 解析 body 的 frontmatter（引擎默认注入；被移除属装配错误）",
							)
						}
						const info = await entryType.getEntryInfo({
							contents: rawBody,
							fileUrl: new URL(`file:///strapi/${ctx.collection}/${id}.md`),
						})
						body = info.body
						slug = slugify(
							typeof info.data.slug === 'string'
								? info.data.slug
								: typeof info.data.version === 'string'
									? info.data.version
									: '',
						)
						if (Object.keys(info.data).length > 0) frontmatter = info.data
					}

					// 媒体列（v4 媒体项的 attributes 包装逐项摊平）；相对 URL 绝对化
					const rawMedias = dig(row, mediaPath)
					const medias: Array<StrapiMedia> = Array.isArray(rawMedias)
						? rawMedias
								.map((m) => unwrapAttributes(m))
								.filter(isPlainObject)
								.map((m) => ({
									alt: typeof m.alternativeText === 'string' ? m.alternativeText : '',
									url: typeof m.url === 'string' ? absoluteUrl(m.url, base) : '',
									mime: typeof m.mime === 'string' ? m.mime : undefined,
								}))
						: []

					// 额外字段投影（fields 选项）：row 顶层字段摊平 v4 包装后原样透传——
					// 关系/组件/排序标记等站点自有字段；zod schema 决定最终形状
					const extra: Record<string, unknown> = {}
					for (const key of options.fields ?? []) {
						if (key in row) extra[key] = unwrapAttributes(unwrapData(row[key]))
					}

					const data = await ctx.parseData({
						id,
						data: {
							title: row.title,
							publishAt: row.publishAt,
							medias,
							...extra,
							...(frontmatter ? { frontmatter } : {}),
						},
					})
					ctx.store.set({
						id,
						slug: slug ?? id,
						data,
						...(body !== undefined ? { body, contentType: 'text/markdown' } : {}),
						digest,
					})
				}
				const pageCount = payload.meta?.pagination?.pageCount ?? 1
				if (page >= pageCount) break
			}

			// untouched 差集删除（loader 的策略；sync 编排层不做——契约失效三件套之二）
			for (const id of ctx.store.keys()) {
				if (!seen.has(id)) ctx.store.delete(id)
			}
		},
	}
}

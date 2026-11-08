/**
 * markopress-content 契约类型。形状定格于 CONTRACT.md（基准 Astro 7 main, 2026-10）。
 * 既定偏离见 docs/research/astro-deltas.md——改这里之前先读它。
 */
import type * as z from 'zod'

/** loader / sync 共用的最小日志面。app 可注入自己的实现（带颜色、前缀）。 */
export interface Logger {
	info(message: string): void
	warn(message: string): void
	error(message: string): void
	debug(message: string): void
	/** 以 loader 名等前缀派生子 logger */
	fork(prefix: string): Logger
}

/**
 * 格式插件点：一种内容格式的解析规则。md 知识在 packages/markdown（'.md' entryType
 * 在那边实现），本包只定义接口并经由 LoaderContext.entryTypes 注入给 glob loader。
 */
export interface EntryType {
	/** 接管的扩展名（含点，如 '.md'） */
	extensions: Array<string>
	/** 该格式 body 的 MIME 标记（如 'text/markdown'），下游 renderer 注册表的键 */
	contentType: string
	/** 从源文本解析出 frontmatter 等结构化数据与正文 */
	getEntryInfo(opts: {
		contents: string
		fileUrl: URL
	}): Promise<{ data: Record<string, unknown>; body?: string; slug?: string }>
}

export interface DataEntry<TData extends Record<string, unknown> = Record<string, unknown>> {
	/** 集合内唯一且稳定的键。文件场景 = 路径派生 slug；WP 场景 = 远端数字 ID */
	id: string
	/** URL 用名，可随时间变化（frontmatter slug、远端改名）。默认 = id */
	slug: string
	/** 已过集合 schema 的结构化数据 */
	data: TData
	/** 源文本（不是渲染产物）。不变式：有 body ⇒ 有 contentType */
	body?: string
	contentType?: string
	/** 内容指纹。store.set 对同 id 同 digest 跳过写入 */
	digest?: string
	/** 相对站点根的 posix 路径；无文件系统的内容源不设 */
	filePath?: string
}

/** loader 可见的、限定在单个集合内的 store 视图（写不进别的集合）。 */
export interface DataStore {
	get<TData extends Record<string, unknown> = Record<string, unknown>>(
		id: string,
	): DataEntry<TData> | undefined
	entries(): Array<[id: string, DataEntry]>
	values(): Array<DataEntry>
	keys(): Array<string>
	has(id: string): boolean
	/**
	 * 写入一条 entry。digest 去重：同 id 且 digest 相同 ⇒ 不写并返回 false。
	 * filePath 必须是相对路径（站点根相对），绝对路径抛错。
	 */
	set<TData extends Record<string, unknown>>(entry: DataEntry<TData>): boolean
	delete(id: string): void
	/** 只清空本集合 */
	clear(): void
}

/** 按集合持久化的小 KV，设计给 sync token / 增量游标用（WP loader 的 last-modified）。 */
export interface MetaStore {
	get(key: string): string | undefined
	set(key: string, value: string): void
	has(key: string): boolean
	delete(key: string): void
}

export interface ParseDataOptions<TData extends Record<string, unknown>> {
	/** entry id，进错误信息 */
	id: string
	/** 未校验的原始数据（frontmatter 解析结果 / API 字段映射结果） */
	data: TData
	/** 可选源文件路径，进错误信息 */
	filePath?: string
}

export interface LoaderContext {
	/** 集合名 */
	collection: string
	/** 本集合的 scoped store 视图 */
	store: DataStore
	/** 本集合的持久 KV */
	meta: MetaStore
	logger: Logger
	/** zod 入口：data 必须过 schema 才能进 store；失败抛错带 entry 坐标 */
	parseData<TData extends Record<string, unknown>>(
		opts: ParseDataOptions<TData>,
	): Promise<TData>
	/** xxhash64 内容指纹（非加密）。string 直接哈希，可 JSON 序列化的值序列化后哈希 */
	generateDigest(data: unknown): string
	/** 扩展名（含点）→ EntryType。无文件概念的 loader 忽略 */
	entryTypes: Map<string, EntryType>
}

/** dev 文件事件：app 把自己 watcher 的原始事件翻译成这个（本包不认 chokidar/vite）。 */
export interface FileChangeEvent {
	type: 'add' | 'change' | 'unlink'
	/** 绝对路径，app watcher 原样给出 */
	path: string
}

/** loader 对单个文件事件的处理结果。id 只在本集合内；collection 维度由编排层补齐。 */
export interface FileChangeResult {
	/** 事件属于本 loader；false = 与我无关（编排层可回退全量 sync） */
	handled: boolean
	/** 实际写入或内容变化的 entry id（digest 命中跳过则不含） */
	changed: Array<string>
	/** 被移除的 entry id（frontmatter slug 改名时老 id 在此、新 id 在 changed） */
	removed: Array<string>
}

/** 内容源：一个 (ctx) => Promise<void>。ctx 注入一切，loader 只写自己的 scoped store。 */
export type Loader = {
	/** 唯一名（npm 包名或内置名，如 'glob'） */
	name: string
	load(context: LoaderContext): Promise<void>
	/**
	 * 增量（可选）：处理单个文件事件，替代全量 load 重跑。前提：load 至少跑过一次
	 * （增量映射建立在全量之上）；未实现 = app 回退全量 sync。
	 */
	handleFileChange?(context: LoaderContext, event: FileChangeEvent): Promise<FileChangeResult>
	/** dev watcher 需要监听的目录（绝对路径），app 据此注册监听。无文件面的 loader 不设。 */
	watchDirs?: Array<string>
}

export interface CollectionConfig<S extends z.ZodType = z.ZodType> {
	/** zod v4 schema；缺省则 data 透传不校验 */
	schema?: S
	loader: Loader
	/** 路由关切（gen 层消费，sync/store 不读）：
	 *   { prefix: "guide" } ⇒ entry 落 /guide/<id>——物理目录与 URL 解耦（如
	 *     content/operations/* → /guide/*）；集合 index → /<prefix> 着陆页（尾段
	 *     index 折叠）；entry "404" 禁入带前缀集合（根特例文件名）。
	 *   false ⇒ 不产 per-entry 路由（列表页/纯数据集合——strapi 等远端源；消费走
	 *     virtual:mp/collection/<name> 集合级数据模块）。连带：不进 sidebar 默认面/
	 *     urls.json/prev-next（皆由路由投影派生）；ctx.urlOf 返回 null，内置三件
	 *     （rss/sitemap/search）跳过 null。 */
	route?: { prefix: string } | false
}

/**
 * 内容配置：app 层加载用户 config 模块后交给 sync。digest 是配置指纹（通常是
 * config 文件内容哈希，由 defineContentConfig 或 app 计算）——变了 sync 层会
 * clearAll 全量重跑（失效三件套之三）。
 */
export interface ContentConfig {
	collections: Record<string, CollectionConfig>
	digest?: string
}

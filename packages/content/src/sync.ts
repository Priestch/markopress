/**
 * 同步编排：配置指纹比对（变了 ⇒ clearAll）→ 逐集合跑 loader → flush 落盘。
 * 串行 = 单飞 promise 链（deltas #2），sync 内各集合也顺序执行（deltas #8）。
 * 差集删除不在这里——那是 loader 的策略（CONTRACT「失效三件套」之二）。
 */
import { getGenerateDigest } from './digest.ts'
import {
	CONFIG_DIGEST_KEY,
	GLOBAL_SCOPE,
	PersistentMetaStore,
	VERSION_KEY,
} from './meta-store.ts'
import type { MutableStore } from './mutable-store.ts'
import { parseEntryData } from './parse-data.ts'
import type {
	CollectionConfig,
	ContentConfig,
	EntryType,
	FileChangeEvent,
	Logger,
	LoaderContext,
} from './types.ts'

export function createConsoleLogger(prefix: string): Logger {
	const log = (level: 'log' | 'info' | 'warn' | 'error', message: string) => {
		console[level](`[${prefix}] ${message}`)
	}
	return {
		info: (m) => log('info', m),
		warn: (m) => log('warn', m),
		error: (m) => log('error', m),
		debug: (m) => log('log', m),
		fork: (sub) => createConsoleLogger(`${prefix}:${sub}`),
	}
}

export interface ContentSyncerOptions {
	store: MutableStore
	meta: PersistentMetaStore
	logger?: Logger
	entryTypes?: Array<EntryType>
	/** 本包版本，进配置指纹（版本变了全量重建）。由 app 注入自身版本。 */
	version?: string
}

export interface SyncCallOptions {
	/** 只重跑指定集合（WP webhook 增量场景）；配置指纹比对照常进行 */
	collections?: Array<string>
}

/** syncFile 的结果：受影响 entry 带 collection 维度（app 拿去做模块图失效）。 */
export interface SyncFileOutcome {
	/** 是否有任何 loader 认领该事件；false = 与内容层无关 */
	handled: boolean
	changed: Array<{ collection: string; id: string }>
	removed: Array<{ collection: string; id: string }>
}

export class ContentSyncer {
	#store: MutableStore
	#meta: PersistentMetaStore
	#logger: Logger
	#entryTypes: Map<string, EntryType>
	#version: string
	#chain: Promise<unknown> = Promise.resolve()
	#active = 0

	constructor(options: ContentSyncerOptions) {
		this.#store = options.store
		this.#meta = options.meta
		this.#logger = options.logger ?? createConsoleLogger('content')
		this.#entryTypes = new Map(
			(options.entryTypes ?? []).flatMap((t) => t.extensions.map((ext) => [ext, t] as const)),
		)
		this.#version = options.version ?? '0.0.0'
	}

	/** 是否有 sync 在跑/在排队（app watcher 可据此合并事件） */
	get busy(): boolean {
		return this.#active > 0
	}

	/**
	 * 排队一次同步，返回其完成承诺。同一时刻至多一个 #doSync 在跑；
	 * 前一个失败不毒化链——错误只进本次返回的 promise（调用方自行 await/catch）。
	 */
	sync(config: ContentConfig, options: SyncCallOptions = {}): Promise<void> {
		this.#active++
		const job = this.#chain.then(() => this.#doSync(config, options))
		// #chain 永远以 fulfilled 收尾（错误在这里消化），否则没人挂 handler 的
		// rejected promise 会触发 unhandledRejection
		this.#chain = job.then(
			() => this.#active--,
			() => this.#active--,
		)
		return job
	}

	/**
	 * 单文件增量（dev watcher 事件）：只跑声明处理该文件的 loader（handleFileChange），
	 * 与 sync 同链排队。不做配置指纹比对——config 变更由 app 走 resetSynced → 全量，
	 * 不在这条路径上。
	 */
	syncFile(config: ContentConfig, event: FileChangeEvent): Promise<SyncFileOutcome> {
		this.#active++
		const job = this.#chain.then(() => this.#doSyncFile(config, event))
		this.#chain = job.then(
			() => this.#active--,
			() => this.#active--,
		)
		return job
	}

	async #doSyncFile(config: ContentConfig, event: FileChangeEvent): Promise<SyncFileOutcome> {
		const generateDigest = await getGenerateDigest()
		const outcome: SyncFileOutcome = { handled: false, changed: [], removed: [] }
		for (const [name, collection] of Object.entries(config.collections)) {
			const loader = collection.loader
			if (typeof loader.handleFileChange !== 'function') continue
			const result = await loader.handleFileChange(this.#buildContext(name, collection, generateDigest), event)
			if (!result.handled) continue
			outcome.handled = true
			outcome.changed.push(...result.changed.map((id) => ({ collection: name, id })))
			outcome.removed.push(...result.removed.map((id) => ({ collection: name, id })))
		}
		// 不等落盘：内存已更新（消费方读内存），持久化交给 500ms 去抖；进程若在
		// 落盘前退出，下次启动全量 sync 自愈。等 flush 会把整集合 JSON 重写（写放大）
		// 拖进编辑延迟的关键路径。
		return outcome
	}

	async #doSync(config: ContentConfig, options: SyncCallOptions): Promise<void> {
		const generateDigest = await getGenerateDigest()
		const configDigest =
			config.digest ??
			// 兜底指纹：集合名 + loader 名的投影。注意 zod schema 是运行时值，
			// 这层投影探测不到 schema 变化——app 必须传 config 文件级 digest（deltas #9）。
			generateDigest(
				Object.entries(config.collections).map(([name, c]) => [name, c.loader.name]),
			)

		this.#checkFingerprints(configDigest, this.#logger)

		for (const [name, collection] of Object.entries(config.collections)) {
			if (options.collections && !options.collections.includes(name)) continue
			const loader = collection.loader
			if (typeof loader.load !== 'function') {
				throw new Error(`Collection loader for "${name}" does not have a load method`)
			}
			await loader.load(this.#buildContext(name, collection, generateDigest))
		}

		await Promise.all([this.#store.waitUntilSaveComplete(), this.#meta.waitUntilSaveComplete()])
	}

	#buildContext(
		name: string,
		collection: CollectionConfig,
		generateDigest: LoaderContext['generateDigest'],
	): LoaderContext {
		return {
			collection: name,
			store: this.#store.scopedStore(name),
			meta: this.#meta.for(name),
			logger: this.#logger.fork(collection.loader.name),
			parseData: (async ({ id, data, filePath }) =>
				parseEntryData({
					id,
					collection: name,
					filePath,
					data,
					schema: collection.schema,
				})) as LoaderContext['parseData'],
			generateDigest,
			entryTypes: this.#entryTypes,
		}
	}

	/**
	 * 失效三件套之三：配置指纹（config digest / 包版本）变了 ⇒ 清空全部数据 + meta。
	 * 不这么做，改 schema 后旧数据会带着错的类型存活。
	 */
	#checkFingerprints(configDigest: string, logger: Logger): void {
		let shouldClear = false
		const previousConfigDigest = this.#meta.get(GLOBAL_SCOPE, CONFIG_DIGEST_KEY)
		const previousVersion = this.#meta.get(GLOBAL_SCOPE, VERSION_KEY)

		if (previousConfigDigest && previousConfigDigest !== configDigest) {
			logger.info('Content config changed, clearing content store')
			shouldClear = true
		}
		if (previousVersion && previousVersion !== this.#version) {
			logger.info('markopress version changed, clearing content store')
			shouldClear = true
		}
		if (shouldClear) {
			this.#store.clearAll()
			this.#meta.clearAll()
		}
		this.#meta.set(GLOBAL_SCOPE, CONFIG_DIGEST_KEY, configDigest)
		this.#meta.set(GLOBAL_SCOPE, VERSION_KEY, this.#version)
	}
}

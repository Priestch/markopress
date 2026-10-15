/**
 * 公共 API。运行时读走全局 store 引用（app 启动时 setContentStore 注入；
 * 第二步接虚拟模块后形态不变——getCollection/getEntry 的签名就是留给它的门）。
 */
import { getGenerateDigest } from './digest.ts'
import type { ContentConfig, DataEntry, Loader } from './types.ts'
import type * as z from 'zod'

export type {
	CollectionConfig,
	ContentConfig,
	DataEntry,
	DataStore,
	EntryType,
	FileChangeEvent,
	FileChangeResult,
	Loader,
	LoaderContext,
	Logger,
	MetaStore,
	ParseDataOptions,
} from './types.ts'
export { ImmutableStore } from './store.ts'
export { MutableStore } from './mutable-store.ts'
export { PersistentMetaStore, metaFile } from './meta-store.ts'
export { ContentSyncer, createConsoleLogger } from './sync.ts'
export type { ContentSyncerOptions, SyncCallOptions, SyncFileOutcome } from './sync.ts'
export { ContentEntryDataError } from './parse-data.ts'
export { generateTypes } from './typegen.ts'

/**
 * 集合名 → data 形状的合并点：`.markopress/content.d.ts`（typegen 生成）对本接口做
 * module augmentation，之后 getCollection<'blog'> 的返回值即带类型。
 * 生成文件需被 app 的 tsconfig include。
 */
export interface CollectionSchemas {
	[collection: string]: Record<string, unknown>
}

/**
 * 定义一个集合（在 content config 模块里用）。schema 可省（data 透传不校验）。
 * 与 Astro 不同处：没有 legacy 类型分支，只有 content_layer 一种集合。
 */
export function defineCollection<S extends z.ZodType>(config: {
	schema?: S
	loader: Loader
}): { schema?: S; loader: Loader } {
	if (!config.loader) {
		throw new Error('A collection must have a `loader`. Got: undefined')
	}
	if (typeof config.loader !== 'object' || typeof config.loader.load !== 'function') {
		throw new Error(
			`A collection loader must be an object with a \`load\` method (see Loader). Got: ${String(config.loader)}`,
		)
	}
	if (!config.loader.name || typeof config.loader.name !== 'string') {
		throw new Error('A collection loader must have a string `name`')
	}
	return config
}

/**
 * 组装内容配置并计算配置指纹（失效三件套之三的输入）。
 * 指纹 = [集合名, loader 名] 投影的 digest——探测不到 schema 变更；app 也可自行
 * 用 config 文件内容 digest 覆盖（config.digest 优先）。
 */
export async function defineContentConfig(input: {
	collections: Record<string, { loader: Loader; schema?: z.ZodType }>
}): Promise<ContentConfig> {
	const generateDigest = await getGenerateDigest()
	const digest = generateDigest(
		Object.entries(input.collections).map(([name, c]) => [name, c.loader.name]),
	)
	return { collections: input.collections, digest }
}

// ---- 运行时读 ----------------------------------------------------------------

let activeStore: { values(name: string): Array<DataEntry>; get(name: string, id: string): DataEntry | undefined } | undefined

/** app 启动时注入 store（dev：MutableStore；未来 SSR：虚拟模块装载的 ImmutableStore） */
export function setContentStore(
	store: {
		values(name: string): Array<DataEntry>
		get(name: string, id: string): DataEntry | undefined
	} | undefined,
): void {
	activeStore = store
}

export function getCollection<C extends keyof CollectionSchemas & string>(
	collection: C,
	filter?: (entry: DataEntry<CollectionSchemas[C]>) => boolean,
): Array<DataEntry<CollectionSchemas[C]>> {
	if (!activeStore) throw new Error('No content store set. Call setContentStore() first.')
	const values = activeStore.values(collection) as Array<DataEntry<CollectionSchemas[C]>>
	return filter ? values.filter(filter) : values
}

export function getEntry<C extends keyof CollectionSchemas & string>(
	collection: C,
	id: string,
): DataEntry<CollectionSchemas[C]> | undefined {
	if (!activeStore) throw new Error('No content store set. Call setContentStore() first.')
	return activeStore.get(collection, id) as DataEntry<CollectionSchemas[C]> | undefined
}

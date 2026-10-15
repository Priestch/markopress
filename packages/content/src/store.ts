/**
 * 只读 store + 序列化。写侧（去抖落盘、scoped 视图）在 mutable-store.ts。
 * 持久化形状（deltas #3）：每个集合一个文件 `<dir>/<collection>.json`，
 * 内容为 devalue 序列化的 Map<id, DataEntry>；全局 meta 单独存 `_meta.json`（meta-store.ts）。
 */
import { promises as fs } from 'node:fs'
import * as devalue from 'devalue'
import type { DataEntry } from './types.ts'

export const META_FILE = '_meta.json'

export class ImmutableStore {
	protected collections = new Map<string, Map<string, DataEntry>>()

	static fromMap(collections: Map<string, Map<string, DataEntry>>): ImmutableStore {
		const store = new ImmutableStore()
		store.collections = collections
		return store
	}

	get<TData extends Record<string, unknown> = Record<string, unknown>>(
		collectionName: string,
		id: string,
	): DataEntry<TData> | undefined {
		return this.collections.get(collectionName)?.get(id) as DataEntry<TData> | undefined
	}

	entries(collectionName: string): Array<[string, DataEntry]> {
		return [...(this.collections.get(collectionName) ?? new Map()).entries()] as Array<
			[string, DataEntry]
		>
	}

	values(collectionName: string): Array<DataEntry> {
		return [...(this.collections.get(collectionName) ?? new Map()).values()] as Array<DataEntry>
	}

	keys(collectionName: string): Array<string> {
		return [...(this.collections.get(collectionName) ?? new Map()).keys()]
	}

	has(collectionName: string, id: string): boolean {
		return this.collections.get(collectionName)?.has(id) ?? false
	}

	hasCollection(collectionName: string): boolean {
		return this.collections.has(collectionName)
	}

	collectionNames(): Array<string> {
		return [...this.collections.keys()]
	}
}

export function serializeCollection(entries: Map<string, DataEntry>): string {
	return devalue.stringify(entries)
}

export function parseCollection(text: string): Map<string, DataEntry> {
	return devalue.parse(text)
}

export function collectionFile(dir: string, collectionName: string): string {
	return `${dir}/${collectionName}.json`
}

/** 读回一个 store 目录。目录不存在或文件损坏时跳过（调用方决定要不要重建）。 */
export async function readStoreDir(dir: string): Promise<Map<string, Map<string, DataEntry>>> {
	const collections = new Map<string, Map<string, DataEntry>>()
	let files: Array<string>
	try {
		files = await fs.readdir(dir)
	} catch {
		return collections
	}
	for (const file of files) {
		if (!file.endsWith('.json') || file === META_FILE) continue
		try {
			const text = await fs.readFile(`${dir}/${file}`, 'utf-8')
			collections.set(file.slice(0, -'.json'.length), parseCollection(text))
		} catch {
			// 单个集合文件损坏：跳过，让 loader 全量重建该集合（digest 为空 ⇒ 不跳过）
		}
	}
	return collections
}

const writing = new Set<string>()
const pending = new Set<string>()

/**
 * 原子写（tmp + rename），内容不变则跳过；返回是否真的写了。
 * 并发写同一文件时合并为「写完后若有 pending 再写一次」（Astro mutable-data-store 同款）。
 * app 靠返回值 / onFileWritten 做 Vite 模块图的确定性失效。
 */
export async function writeFileIfChanged(path: string, data: string): Promise<boolean> {
	if (writing.has(path)) {
		pending.add(path)
		return false
	}
	writing.add(path)
	try {
		const old = await fs.readFile(path, 'utf-8').catch(() => undefined)
		if (old !== data) {
			const tmp = `${path}.tmp`
			await fs.writeFile(tmp, data)
			await fs.rename(tmp, path)
			return true
		}
		return false
	} finally {
		writing.delete(path)
		if (pending.has(path)) {
			pending.delete(path)
			await writeFileIfChanged(path, data)
		}
	}
}

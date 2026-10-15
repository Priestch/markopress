/**
 * 独立持久化的 meta KV（deltas #7）：全局键（配置指纹）+ 按集合 scoped 视图（sync token）。
 * 去抖落盘与 MutableStore 同款；clearAll 时与数据 store 一起清。
 */
import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'
import * as devalue from 'devalue'
import { META_FILE, writeFileIfChanged } from './store.ts'
import type { MetaStore } from './types.ts'

const SAVE_DEBOUNCE_MS = 500

/** 全局作用域的键名（sync 层存配置指纹用） */
export const GLOBAL_SCOPE = ':global'

/** sync 层写入的全局键 */
export const CONFIG_DIGEST_KEY = 'content-config-digest'
export const VERSION_KEY = 'markopress-version'

export class PersistentMetaStore {
	#scopes = new Map<string, Map<string, string>>()
	#file?: string
	#saveTimer: ReturnType<typeof setTimeout> | undefined
	#savePromise: Promise<void> | undefined
	#saveResolve: (() => void) | undefined

	static async fromFile(file: string): Promise<PersistentMetaStore> {
		const store = new PersistentMetaStore()
		try {
			const text = await fs.readFile(file, 'utf-8')
			const scopes = devalue.parse(text) as Map<string, Map<string, string>>
			if (scopes instanceof Map) {
				for (const [scope, kv] of scopes) {
					if (kv instanceof Map) store.#scopes.set(scope, kv)
				}
			}
		} catch {
			// 文件不存在 / 损坏：从空开始（配置指纹缺失 ⇒ 不触发 clearAll，直接当首次）
		}
		store.#file = file
		await fs.mkdir(dirname(file), { recursive: true })
		return store
	}

	get(scope: string, key: string): string | undefined {
		return this.#scopes.get(scope)?.get(key)
	}

	set(scope: string, key: string, value: string) {
		const kv = this.#scopes.get(scope) ?? new Map()
		kv.set(key, value)
		this.#scopes.set(scope, kv)
		this.#saveToDiskDebounced()
	}

	has(scope: string, key: string): boolean {
		return this.#scopes.get(scope)?.has(key) ?? false
	}

	delete(scope: string, key: string) {
		if (this.#scopes.get(scope)?.delete(key)) {
			this.#saveToDiskDebounced()
		}
	}

	/** 清空所有作用域（配置指纹失效时与数据 store.clearAll() 一起调用）。 */
	clearAll() {
		if (this.#scopes.size === 0) return
		this.#scopes.clear()
		this.#saveToDiskDebounced()
	}

	/** LoaderContext.meta 的来源：绑定到单个集合作用域的视图。 */
	for(collectionName: string): MetaStore {
		return {
			get: (key) => this.get(collectionName, key),
			set: (key, value) => this.set(collectionName, key, value),
			has: (key) => this.has(collectionName, key),
			delete: (key) => this.delete(collectionName, key),
		}
	}

	#saveToDiskDebounced() {
		if (!this.#file) return
		if (this.#saveTimer) clearTimeout(this.#saveTimer)
		this.#savePromise ??= new Promise((resolve) => {
			this.#saveResolve = resolve
		})
		this.#saveTimer = setTimeout(() => {
			this.#saveTimer = undefined
			void this.#flush()
		}, SAVE_DEBOUNCE_MS)
	}

	async #flush() {
		const file = this.#file
		if (!file) {
			this.#resolveSave()
			return
		}
		await writeFileIfChanged(file, devalue.stringify(this.#scopes))
		if (!this.#saveTimer) this.#resolveSave()
	}

	#resolveSave() {
		this.#saveResolve?.()
		this.#saveResolve = undefined
		this.#savePromise = undefined
	}

	async waitUntilSaveComplete(): Promise<void> {
		if (this.#saveTimer) {
			clearTimeout(this.#saveTimer)
			this.#saveTimer = undefined
		}
		await this.#flush()
		await this.#savePromise
	}
}

/** 默认的 store 目录内 meta 文件路径 */
export function metaFile(storeDir: string): string {
	return `${storeDir}/${META_FILE}`
}

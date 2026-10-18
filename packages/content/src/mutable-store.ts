/**
 * 写侧 store：dirty 标记 + 去抖落盘 + onFileWritten 监听。
 * 只重写 dirty 的集合文件（我们按集合分文件，Astro 是全局一个 dirty 位）。
 */
import { existsSync, promises as fs } from 'node:fs'
import {
	collectionFile,
	ImmutableStore,
	readStoreDir,
	serializeCollection,
	writeFileIfChanged,
} from './store.ts'
import type { DataEntry, DataStore } from './types.ts'

const SAVE_DEBOUNCE_MS = 500

export class MutableStore extends ImmutableStore {
	#dir?: string
	#dirty = new Set<string>()
	#saveTimer: ReturnType<typeof setTimeout> | undefined
	#savePromise: Promise<void> | undefined
	#saveResolve: (() => void) | undefined
	#fileWrittenListeners = new Set<(path: string) => void>()

	/**
	 * 从 store 目录装载（不存在则从空开始），后续去抖写回同一目录。
	 * 单个集合文件损坏时该集合从空开始，loader 因 digest 缺失而全量重建。
	 */
	static async fromDir(dir: string): Promise<MutableStore> {
		const store = new MutableStore()
		store.collections = await readStoreDir(dir)
		store.#dir = dir
		await fs.mkdir(dir, { recursive: true })
		return store
	}

	#set(collectionName: string, id: string, value: DataEntry) {
		const collection = this.collections.get(collectionName) ?? new Map()
		collection.set(id, value)
		this.collections.set(collectionName, collection)
		this.#saveToDiskDebounced(collectionName)
	}

	#delete(collectionName: string, id: string) {
		const collection = this.collections.get(collectionName)
		if (collection?.delete(id)) {
			this.#saveToDiskDebounced(collectionName)
		}
	}

	#clear(collectionName: string) {
		if (this.collections.delete(collectionName)) {
			this.#saveToDiskDebounced(collectionName)
		}
	}

	/** 清空全部数据（配置指纹失效时由 sync 调用）。所有曾存在的集合文件随之移除。 */
	clearAll() {
		const names = [...this.collections.keys()]
		this.collections.clear()
		for (const name of names) this.#saveToDiskDebounced(name)
	}

	/**
	 * 注册「文件已写盘」监听：内容变化真正落盘时以文件路径回调（跳过的写不回调）。
	 * app 用它做 Vite 模块图失效，替代依赖文件 watcher 观察自家写入。
	 */
	onFileWritten(listener: (path: string) => void): () => void {
		this.#fileWrittenListeners.add(listener)
		return () => this.#fileWrittenListeners.delete(listener)
	}

	#notifyFileWritten(path: string) {
		for (const listener of this.#fileWrittenListeners) listener(path)
	}

	scopedStore(collectionName: string): DataStore {
		return {
			get: (id) => this.get(collectionName, id),
			entries: () => this.entries(collectionName),
			values: () => this.values(collectionName),
			keys: () => this.keys(collectionName),
			has: (id) => this.has(collectionName, id),
			set: (entry) => {
				if (!entry.id) throw new Error('ID must be a non-empty string')
				// digest 去重（失效三件套之一的写侧）：未变化 ⇒ 不写、不触发落盘。
				// filePath 一起比对——文件搬家但内容未变时要更新路径，不能吞掉。
				if (entry.digest) {
					const existing = this.get(collectionName, entry.id)
					if (
						existing &&
						existing.digest === entry.digest &&
						(existing.filePath ?? undefined) === (entry.filePath ?? undefined)
					) {
						return false
					}
				}
				if (entry.filePath?.startsWith('/')) {
					throw new Error(`File path must be relative to the site root. Got: ${entry.filePath}`)
				}
				const stored: DataEntry = { id: entry.id, slug: entry.slug ?? entry.id, data: entry.data }
				// 只在有值时落字段，省序列化体积（Astro 同款）。body 例外：空串是合法值
				// （纯 frontmatter 页——如博客的列表页壳），falsy 判定会把它丢成 undefined，
				// 下游 renderer 对 undefined body 直接抛错
				if (entry.body !== undefined) stored.body = entry.body
				if (entry.contentType) stored.contentType = entry.contentType
				if (entry.filePath) stored.filePath = entry.filePath
				if (entry.digest) stored.digest = entry.digest
				this.#set(collectionName, entry.id, stored)
				return true
			},
			delete: (id) => this.#delete(collectionName, id),
			clear: () => this.#clear(collectionName),
		}
	}

	#saveToDiskDebounced(collectionName: string) {
		this.#dirty.add(collectionName)
		if (!this.#dir) return
		if (this.#saveTimer) clearTimeout(this.#saveTimer)
		this.#savePromise ??= new Promise((resolve) => {
			this.#saveResolve = resolve
		})
		this.#saveTimer = setTimeout(() => {
			this.#saveTimer = undefined
			void this.#flush()
		}, SAVE_DEBOUNCE_MS)
	}

	/** 只写 dirty 集合。序列化取当前内存快照，落盘原子且内容不变则跳过。 */
	async #flush() {
		const dir = this.#dir
		if (!dir) {
			this.#dirty.clear()
			this.#resolveSave()
			return
		}
		const dirty = [...this.#dirty]
		this.#dirty.clear()
		for (const name of dirty) {
			const collection = this.collections.get(name)
			const path = collectionFile(dir, name)
			let written = false
			if (collection && collection.size > 0) {
				written = await writeFileIfChanged(path, serializeCollection(collection))
			} else if (existsSync(path)) {
				// 集合被清空 / 删除：移除文件，让「存在即有数据」成立
				try {
					await fs.rm(path, { force: true })
					written = true
				} catch {}
			}
			if (written) this.#notifyFileWritten(path)
		}
		if (!this.#saveTimer && this.#dirty.size === 0) this.#resolveSave()
	}

	#resolveSave() {
		this.#saveResolve?.()
		this.#saveResolve = undefined
		this.#savePromise = undefined
	}

	/** 立即冲掉去抖，等所有待写落盘。sync 结束时调用（Astro waitUntilSaveComplete 同款）。 */
	async waitUntilSaveComplete(): Promise<void> {
		if (this.#saveTimer) {
			clearTimeout(this.#saveTimer)
			this.#saveTimer = undefined
		}
		await this.#flush()
		await this.#savePromise
	}
}

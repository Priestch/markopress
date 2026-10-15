/**
 * 通用文件扫描 loader。不含任何 md 知识：扩展名 → EntryType 的解析规则由
 * LoaderContext.entryTypes 注入（'.md' 的实现在 packages/markdown）。
 * 增量策略（CONTRACT「失效三件套」）：digest 相同 ⇒ 跳过 parse；本轮没见到的
 * id 全删（untouched 差集）——全量扫描语义，重跑 load() 即增量同步。
 *
 * 单文件增量（handleFileChange）：load 建立的 entry路径→id 映射（fileToId）支撑
 * change/unlink 的 O(1) 定位；没见过的文件（add）先 glob 扫一遍确认 pattern 匹配
 * ——扫描只列目录（便宜），贵的读文件只对事件文件本身做。
 */
import { existsSync, promises as fs } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { glob as tinyglobby } from 'tinyglobby'
import type { FileChangeEvent, FileChangeResult, Loader, LoaderContext } from '../types.ts'

export interface GenerateIdOptions {
	/** 相对 base 的 entry 路径（posix 风格，含扩展名） */
	entry: string
	/** base 目录的 file URL（保证以 / 结尾） */
	base: URL
	/** entryType 解析出的未校验数据（frontmatter） */
	data: Record<string, unknown>
	/** entryType 报告的 slug（如 frontmatter slug），没有则 undefined */
	slug?: string
}

export interface GlobOptions {
	/** glob 模式，相对 base。支持数组（含 '!' 负向模式） */
	pattern: string | Array<string>
	/**
	 * 扫描基准目录。相对路径按进程 cwd 解析（app 的 dev/build 都在项目根启动）。
	 * 默认 '.'。
	 */
	base?: string | URL
	/**
	 * filePath 相对化的基准（站点根），产出 store 里的相对 posix 路径。默认 = base。
	 * 我们没有 Astro 的 config.root（ctx 收窄，deltas #4），由 loader 选项提供。
	 */
	root?: string | URL
	/**
	 * 生成 entry id。默认：data/frontmatter 的 slug，否则由路径派生
	 * （去扩展名、逐段 slugify，保留 Unicode 字母数字——中文文件名可用）。
	 * 必须在集合内唯一；返回值会被 String() 规整。
	 */
	generateId?: (options: GenerateIdOptions) => string
}

/** 相对 base 的 entry 路径 → file URL。encodeURI + 转义 # ?，防 `name:` 被当 URL scheme（上游 #17762/#18199）。 */
function resolveEntryUrl(entry: string, base: URL): URL {
	return new URL('./' + encodeURI(entry).replace(/[#?]/g, encodeURIComponent), base)
}

/** 路径段 slugify：小写、空白与非常用字符折叠为 '-'，保留 Unicode 字母数字。 */
function slugifySegment(segment: string): string {
	return segment
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-')
		.replace(/[^\p{L}\p{N}\-_~.]+/gu, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^-|-$/g, '')
}

function slugifyPath(entry: string): string {
	return entry
		.replace(/\.[^./]*$/, '')
		.split('/')
		.map(slugifySegment)
		.filter((s) => s.length > 0)
		.join('/')
}

function checkPrefix(pattern: string | Array<string>, prefix: string): boolean {
	return Array.isArray(pattern) ? pattern.some((p) => p.startsWith(prefix)) : pattern.startsWith(prefix)
}

const NOT_HANDLED: FileChangeResult = { handled: false, changed: [], removed: [] }

interface ResolvedBase {
	baseDir: URL
	basePath: string
	rootPath: string
}

export function glob(globOptions: GlobOptions): Loader {
	if (checkPrefix(globOptions.pattern, '../')) {
		throw new Error('Glob patterns cannot start with `../`. Set the `base` option to a parent directory instead.')
	}
	if (checkPrefix(globOptions.pattern, '/')) {
		throw new Error('Glob patterns cannot start with `/`. Set the `base` option to a parent directory or use a relative path instead.')
	}

	const userGenerateId = globOptions.generateId
	const generateId = (opts: GenerateIdOptions): string =>
		String(userGenerateId ? userGenerateId(opts) : (opts.slug ?? slugifyPath(opts.entry)))

	/** 首次使用时解析并缓存（load 与 handleFileChange 共用） */
	let resolved: ResolvedBase | undefined
	/** entry 路径（相对 base 的 posix）→ id。load 建立全量，handleFileChange 增量维护 */
	const fileToId = new Map<string, string>()

	function resolveBase(): ResolvedBase {
		// base：URL 直接用；字符串按 cwd 解析（绝对路径 resolve 原样规范化）
		const baseDir: URL =
			globOptions.base instanceof URL
				? new URL(globOptions.base)
				: pathToFileURL(resolve(globOptions.base ?? '.'))
		// 保证以 / 结尾，URL 解析才稳定（Astro 同款处理）
		if (!baseDir.pathname.endsWith('/')) baseDir.pathname = `${baseDir.pathname}/`
		const rootPath =
			globOptions.root instanceof URL
				? fileURLToPath(globOptions.root)
				: resolve(globOptions.root ?? fileURLToPath(baseDir))
		const basePath = fileURLToPath(baseDir)
		return { baseDir, basePath, rootPath }
	}

	/** id 是否还被 fileToId 里除 exclude 外的 entry 占用（slug 撞车时两个文件共用一个 id）。 */
	function idClaimedByAnother(id: string, exclude: string): boolean {
		for (const [entry, other] of fileToId) {
			if (entry !== exclude && other === id) return true
		}
		return false
	}

	/** 读单个文件 → parse → store.set。返回 id 与是否实际写入；读失败/无 entryType 返回 undefined。 */
	async function syncEntry(
		ctx: LoaderContext,
		entry: string,
		{ baseDir, rootPath }: ResolvedBase,
	): Promise<{ id: string; changed: boolean } | undefined> {
		const { collection, store, logger, parseData, generateDigest, entryTypes } = ctx
		const ext = `.${entry.split('.').at(-1) ?? ''}`
		const entryType = entryTypes.get(ext)
		if (!entryType) {
			logger.warn(`No entry type found for ${entry}`)
			return undefined
		}
		const fileUrl = resolveEntryUrl(entry, baseDir)
		const contents = await fs.readFile(fileUrl, 'utf-8').catch((err) => {
			logger.error(`Error reading ${entry}: ${err.message}`)
			return undefined
		})
		if (contents === undefined) return undefined

		const { data, body, slug } = await entryType.getEntryInfo({ contents, fileUrl })
		const id = generateId({ entry, base: baseDir, data, slug })

		const existingEntry = store.get(id)
		const digest = generateDigest(contents)
		const filePath = fileURLToPath(fileUrl)
		const relativePath = relative(rootPath, filePath).replaceAll('\\', '/')

		// 失效三件套之一：digest 相同且没搬家 ⇒ 完全跳过（不重 parse 不重写）
		if (
			existingEntry &&
			existingEntry.digest === digest &&
			existingEntry.filePath === relativePath
		) {
			return { id, changed: false }
		}

		if (existingEntry && existingEntry.filePath && existingEntry.filePath !== relativePath) {
			// 老 filePath 还在磁盘上 = 两个文件产出同一 id（frontmatter slug 撞车）
			if (existsSync(resolve(rootPath, existingEntry.filePath))) {
				logger.warn(
					`Duplicate slug "${id}" in collection "${collection}": ${existingEntry.filePath} and ${relativePath} both map to it.`,
				)
			}
		}

		const parsedData = await parseData({ id, data, filePath })
		const changed = store.set({
			id,
			slug: slug ?? id,
			data: parsedData,
			body,
			contentType: entryType.contentType,
			digest,
			filePath: relativePath,
		})
		return { id, changed }
	}

	return {
		name: 'glob',
		watchDirs: [
			globOptions.base instanceof URL
				? fileURLToPath(globOptions.base)
				: resolve(globOptions.base ?? '.'),
		],

		load: async (ctx) => {
			const base = (resolved ??= resolveBase())
			if (!existsSync(base.basePath)) {
				// 警告但不返回：目录可能稍后出现
				ctx.logger.warn(`The base directory "${base.basePath}" does not exist.`)
			}

			/** 同 id 撞车检测要用的：已存 entry 的 filePath 是否还存在于磁盘 */
			const untouchedEntries = new Set(ctx.store.keys())

			const files = await tinyglobby(globOptions.pattern, {
				cwd: base.basePath,
				expandDirectories: false,
			})
			if (existsSync(base.basePath) && files.length === 0) {
				ctx.logger.warn(
					`No files found matching "${String(globOptions.pattern)}" in directory "${relative(base.rootPath, base.basePath) || '.'}"`,
				)
			}

			const seen = new Set(files)
			// 顺序处理（deltas #2：先确定性后并发）
			for (const entry of files) {
				const result = await syncEntry(ctx, entry, base)
				if (result) {
					untouchedEntries.delete(result.id)
					fileToId.set(entry, result.id)
				}
			}

			// 失效三件套之二：本轮没见到 ⇒ 删除（增量不清全量的反面：全量要清增量）
			for (const id of untouchedEntries) ctx.store.delete(id)
			for (const entry of fileToId.keys()) {
				if (!seen.has(entry)) fileToId.delete(entry)
			}
		},

		handleFileChange: async (ctx, event: FileChangeEvent): Promise<FileChangeResult> => {
			const base = (resolved ??= resolveBase())
			const rel = relative(base.basePath, event.path)
			if (rel === '' || rel.startsWith('..')) return NOT_HANDLED
			const entry = rel.replaceAll('\\', '/')

			if (event.type === 'unlink') {
				const id = fileToId.get(entry)
				if (id === undefined) return NOT_HANDLED
				fileToId.delete(entry)
				if (!idClaimedByAnother(id, entry)) ctx.store.delete(id)
				return { handled: true, changed: [], removed: [id] }
			}

			// add / change。没见过的文件先确认 pattern 匹配（只列目录，不读文件）
			if (!fileToId.has(entry)) {
				const files = await tinyglobby(globOptions.pattern, {
					cwd: base.basePath,
					expandDirectories: false,
				})
				if (!files.includes(entry)) return NOT_HANDLED
			}

			const previousId = fileToId.get(entry)
			const result = await syncEntry(ctx, entry, base)
			if (result === undefined) return NOT_HANDLED
			fileToId.set(entry, result.id)

			if (previousId !== undefined && previousId !== result.id) {
				// frontmatter slug 改名：删老 id（仍被其他文件占用则保留——撞车场景）
				if (!idClaimedByAnother(previousId, entry)) ctx.store.delete(previousId)
				return { handled: true, changed: [result.id], removed: [previousId] }
			}
			return { handled: true, changed: result.changed ? [result.id] : [], removed: [] }
		},
	}
}

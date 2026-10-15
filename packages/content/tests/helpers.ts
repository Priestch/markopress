/**
 * 测试夹具：内存 entryType（'.tmd' 极简 frontmatter 格式）、静音 logger、sync 装配。
 * '.tmd' 格式：'---' 开头的 frontmatter 块（key: JSON value 行，'...' 结束）+ 正文。
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { glob } from '../src/loaders/glob.ts'
import { defineCollection, metaFile, MutableStore, PersistentMetaStore } from '../src/index.ts'
import { ContentSyncer } from '../src/sync.ts'
import type { EntryType, Logger } from '../src/types.ts'

/** 内存 entryType：不含任何真 markdown 知识，只做 frontmatter 拆分。 */
export const testEntryType: EntryType = {
	extensions: ['.tmd'],
	contentType: 'text/test-markdown',
	async getEntryInfo({ contents }) {
		const lines = contents.split('\n')
		const data: Record<string, unknown> = {}
		let body = contents
		if (lines[0]?.trim() === '---') {
			const end = lines.indexOf('...', 1)
			if (end > 0) {
				for (const line of lines.slice(1, end)) {
					const idx = line.indexOf(':')
					if (idx > 0) {
						const key = line.slice(0, idx).trim()
						const raw = line.slice(idx + 1).trim()
						try {
							data[key] = JSON.parse(raw)
						} catch {
							data[key] = raw
						}
					}
				}
				body = lines.slice(end + 1).join('\n')
			}
		}
		const slug = typeof data.slug === 'string' ? data.slug : undefined
		return { data, body, slug }
	},
}

/** 静音但可断言的 logger：warn/error 进 warnings，info 进 messages。 */
export function silentLogger(): Logger & { warnings: Array<string>; messages: Array<string> } {
	const warnings: Array<string> = []
	const messages: Array<string> = []
	const make = (): Logger => ({
		info: (m) => messages.push(m),
		warn: (m) => warnings.push(m),
		error: (m) => warnings.push(m),
		debug: () => {},
		fork: () => make(),
	})
	return Object.assign(make(), { warnings, messages })
}

export function makeTmpDir(): Promise<string> {
	return mkdtemp(join(tmpdir(), 'mp-content-'))
}

export interface Fixture {
	dir: string
	contentDir: string
	store: MutableStore
	meta: PersistentMetaStore
	syncer: ContentSyncer
	logger: ReturnType<typeof silentLogger>
	write(name: string, frontmatter: Record<string, unknown>, body: string): Promise<void>
	remove(name: string): Promise<void>
	/** 常用配置：单集合 'docs'，glob 到 contentDir */
	config(extra?: { digest?: string; schema?: z.ZodType }): Promise<import('../src/types.ts').ContentConfig>
}

export async function makeFixture(options?: {
	entryTypes?: Array<EntryType>
	version?: string
}): Promise<Fixture> {
	const dir = await makeTmpDir()
	const contentDir = join(dir, 'content')
	const storeDir = join(dir, '.markopress', 'store')
	await mkdir(contentDir, { recursive: true })
	const store = await MutableStore.fromDir(storeDir)
	const meta = await PersistentMetaStore.fromFile(metaFile(storeDir))
	const logger = silentLogger()
	const syncer = new ContentSyncer({
		store,
		meta,
		logger,
		entryTypes: options?.entryTypes ?? [testEntryType],
		version: options?.version ?? 'test-1',
	})
	return {
		dir,
		contentDir,
		store,
		meta,
		syncer,
		logger,
		write: async (name, frontmatter, body) => {
			const file = join(contentDir, name)
			await mkdir(dirname(file), { recursive: true })
			await writeFile(
				file,
				`---\n${Object.entries(frontmatter)
					.map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
					.join('\n')}\n...\n${body}`,
				'utf-8',
			)
		},
		remove: (name) => rm(join(contentDir, name)),
		config: async (extra) => ({
			collections: {
				docs: defineCollection({
					loader: glob({ pattern: '**/*.tmd', base: contentDir }),
					schema: extra?.schema,
				}),
			},
			digest: extra?.digest,
		}),
	}
}

/** 计数 schema：transform 每跑一次 = parseData 真正执行一次（digest 命中则根本不进 schema）。 */
export function countingSchema(counter: { count: number }): z.ZodType {
	return z
		.object({ title: z.string(), slug: z.string().optional() })
		.transform((value) => {
			counter.count++
			return value
		})
}

/**
 * zod 入口：data 必须过集合 schema 才能进 store（CONTRACT「zod 入口」）。
 * 报错必须带 collection / id / filePath（有则）——「坏 frontmatter 报错可读」从这开始。
 */
import type * as z from 'zod'
import type { CollectionConfig } from './types.ts'

export class ContentEntryDataError extends Error {
	readonly collection: string
	readonly id: string
	readonly filePath: string | undefined

	constructor(
		collection: string,
		id: string,
		filePath: string | undefined,
		issues: Array<{ path: PropertyKey[]; message: string }>,
	) {
		const where = filePath ? ` (${filePath})` : ''
		const details = issues
			.map((issue) => `  ${label(issue.path)}: ${issue.message}`)
			.join('\n')
		super(
			`Invalid data for entry "${id}" in collection "${collection}"${where}:\n${details}`,
		)
		this.name = 'ContentEntryDataError'
		this.collection = collection
		this.id = id
		this.filePath = filePath
	}
}

function label(path: PropertyKey[]): string {
	if (path.length === 0) return '(root)'
	return `data.${path.map(String).join('.')}`
}

export async function parseEntryData(opts: {
	id: string
	collection: string
	filePath?: string
	data: Record<string, unknown>
	schema?: CollectionConfig['schema']
}): Promise<Record<string, unknown>> {
	const { schema } = opts
	if (!schema) return opts.data
	// safeParseAsync 允许 schema 里带异步 transform
	const parsed = await (schema as z.ZodType).safeParseAsync(opts.data)
	if (parsed.success) {
		return parsed.data as Record<string, unknown>
	}
	throw new ContentEntryDataError(opts.collection, opts.id, opts.filePath, parsed.error.issues)
}

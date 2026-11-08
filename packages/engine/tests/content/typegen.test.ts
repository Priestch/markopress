import { execFile } from 'node:child_process'
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { promisify } from 'node:util'
import { defineCollection } from '../../src/content/index.ts'
import { generateTypes } from '../../src/content/typegen.ts'
import type { ContentConfig } from '../../src/content/types.ts'
import { makeTmpDir } from './helpers.ts'

const execFileAsync = promisify(execFile)
const pkgRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

describe('typegen', () => {
	it('生成集合映射（有 schema 走 InferEntrySchema，无 schema 落 any 形状）', async () => {
		const dir = await makeTmpDir()
		const outPath = join(dir, 'content.d.ts')
		const config: ContentConfig = {
			collections: {
				blog: defineCollection({
					loader: { name: 'glob', load: async () => {} },
					schema: z.object({ title: z.string() }),
				}),
				notes: defineCollection({
					loader: { name: 'glob', load: async () => {} },
				}),
			},
		}
		const written = await generateTypes({
			config,
			importSpecifier: '../../content.config',
			outPath,
		})
		expect(written).toBe(true)
		const content = await readFile(outPath, 'utf-8')
		expect(content).toContain(`'blog': InferEntrySchema<'blog'>`)
		expect(content).toContain(`'notes': Record<string, unknown>`)
		expect(content).toContain(`typeof import("../../content.config")`)
		expect(content).toContain(`declare module 'markopress/content'`)

		// write-if-changed：内容未变 ⇒ 不再写
		await expect(
			generateTypes({ config, importSpecifier: '../../content.config', outPath }),
		).resolves.toBe(false)
		// 变了（新增集合）⇒ 再写
		config.collections.extra = defineCollection({
			loader: { name: 'glob', load: async () => {} },
		})
		await expect(
			generateTypes({ config, importSpecifier: '../../content.config', outPath }),
		).resolves.toBe(true)
		expect(await readFile(outPath, 'utf-8')).toContain(`'extra':`)
	})

	// 编译级验证：生成的 d.ts 经 module augmentation 真的把类型喂给了 getCollection。
	// 用 tsc 对「config + 生成物 + consumer」整个编译，正向要通过、用错字段要失败。
	it('生成的类型经 augmentation 生效于 getCollection（tsc 编译验证）', async () => {
		const dir = await makeTmpDir()
		// 隔离的 node_modules：zod / @types/node 与本包（symlink），bundler 解析走得到
		const nm = join(dir, 'node_modules')
		await mkdir(join(nm, '@types'), { recursive: true })
		await symlink(join(pkgRoot, 'node_modules', 'zod'), join(nm, 'zod'), 'dir')
		await symlink(pkgRoot, join(nm, 'markopress'), 'dir')
		await symlink(join(pkgRoot, 'node_modules', '@types', 'node'), join(nm, '@types', 'node'), 'dir')

		await writeFile(
			join(dir, 'content.config.ts'),
			[
				`import { defineCollection } from 'markopress/content'`,
				`import { z } from 'zod'`,
				`export const collections = {`,
				`  blog: defineCollection({`,
				`    schema: z.object({ title: z.string() }),`,
				`    loader: { name: 'glob', load: async () => {} },`,
				`  }),`,
				`}`,
			].join('\n'),
		)
		const config: ContentConfig = {
			collections: {
				blog: defineCollection({
					schema: z.object({ title: z.string() }),
					loader: { name: 'glob', load: async () => {} },
				}),
			},
		}
		await generateTypes({
			config,
			importSpecifier: './content.config',
			outPath: join(dir, 'content.d.ts'),
		})

		await writeFile(
			join(dir, 'consumer.ts'),
			[
				`import { getCollection, getEntry } from 'markopress/content'`,
				`const posts = getCollection('blog')`,
				`export const title: string = posts[0].data.title`,
				`export const slug: string = posts[0].slug`,
				`const one = getEntry('blog', 'x')`,
				`export const oneTitle: string | undefined = one?.data.title`,
			].join('\n'),
		)
		await writeFile(
			join(dir, 'tsconfig.json'),
			JSON.stringify(
				{
					compilerOptions: {
						strict: true,
						noEmit: true,
						module: 'esnext',
						moduleResolution: 'bundler',
						target: 'es2022',
						skipLibCheck: true,
						// 编译本包 TS 源码（symlink 进来）所需——app 的 tsconfig 同样需要
						allowImportingTsExtensions: true,
						erasableSyntaxOnly: true,
						verbatimModuleSyntax: true,
						types: ['node'],
					},
					files: ['content.config.ts', 'content.d.ts', 'consumer.ts'],
				},
				null,
				2,
			),
		)

		const tsc = join(pkgRoot, 'node_modules', '.bin', 'tsc')
		// 正向：类型流到位
		await execFileAsync(tsc, ['-p', dir], { cwd: dir })
		// 反向：字段写错必须编译失败
		await writeFile(
			join(dir, 'consumer.ts'),
			`import { getCollection } from 'markopress/content'
export const bad: string = getCollection('blog')[0].data.nonexistent`,
			'utf-8',
		)
		const failed = await execFileAsync(tsc, ['-p', dir]).then(
			() => false,
			() => true,
		)
		expect(failed).toBe(true)
	})
})

/**
 * 内容指纹：xxhash64（非加密、极快）。与 Astro 同选 xxhash-wasm——wasm 初始化是异步的，
 * 所以经由 async 的 getGenerateDigest() 获取一次后缓存（sync 是 async，无摩擦）。
 */
import xxhash from 'xxhash-wasm'

export type GenerateDigest = (data: unknown) => string

let cached: GenerateDigest | undefined
let init: Promise<void> | undefined

export async function getGenerateDigest(): Promise<GenerateDigest> {
	if (cached) return cached
	init ??= xxhash().then(({ h64ToString }) => {
		cached = (data) => h64ToString(typeof data === 'string' ? data : JSON.stringify(data))
	})
	await init
	return cached!
}

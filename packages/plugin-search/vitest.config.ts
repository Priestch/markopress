import { defineConfig } from 'vitest/config'

// 钉死 vitest 的配置发现：绝不向上找到 app 根的 vite.config.ts
export default defineConfig({
	root: import.meta.dirname,
	test: {
		include: ['tests/**/*.test.ts'],
	},
})

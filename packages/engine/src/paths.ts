// 共享路径常量 —— 单独成文件是为断开 plugins.ts ↔ content.ts 的导入环
// （plugins.ts 的模块级常量需要 ROOT，而 content.ts 装配时 import plugins.ts）。
//
// 引擎抽包后的 ROOT 语义：**站点根 = 运行时 cwd**（bin 从 app 目录执行；
// workspace 内经 pnpm --filter 运行时 cwd = packages/site）。import.meta.url
// 推导不再成立——引擎文件住在 node_modules 里，不再是站点布局的一部分。
// MARKOPRESS_ROOT 环境变量可覆盖（工具脚本从别处驱动引擎用）。
import { resolve } from "node:path";

export const ROOT = resolve(process.env.MARKOPRESS_ROOT ?? process.cwd());

// 共享路径常量 —— 单独成文件是为断开 plugins.ts ↔ content.ts 的导入环
// （plugins.ts 的模块级常量需要 ROOT，而 content.ts 装配时 import plugins.ts）。
//
// 引擎抽包后的 ROOT 语义：**站点根 = 运行时 cwd**（bin 从 app 目录执行；
// workspace 内经 pnpm --filter 运行时 cwd = packages/site）。import.meta.url
// 推导不再成立——引擎文件住在 node_modules 里，不再是站点布局的一部分。
// MARKOPRESS_ROOT 环境变量可覆盖（工具脚本从别处驱动引擎用）。
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(process.env.MARKOPRESS_ROOT ?? process.cwd());

/** engine 包根（内置主题 themes/ 的锚点）。src/ 与 dist/ 同深——workspace 源码
 * 直跑与 npm 包编译产物两条路径下都指向包根。 */
export const ENGINE_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 用户自定义页目录（app 根 pages/，docs/custom-pages-design.md §4.1）：
 *  组件页的非派生路由来源——不进 store，gen 期以薄包装并入 .markopress/routes/_pages/。 */
export const PAGES_DIR = join(ROOT, "pages");

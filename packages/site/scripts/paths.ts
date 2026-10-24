// 共享路径常量 —— 单独成文件是为断开 plugins.ts ↔ content.ts 的导入环
// （plugins.ts 的模块级常量需要 ROOT，而 content.ts 装配时 import plugins.ts）。
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

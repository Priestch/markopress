// Vite build 的 title 补写挂点：adapter 爬取发生在一切 Vite 构建钩子之后，
// 唯一可靠的时机 = build 命令串联（package.json: marko-run build && node 本脚本）。
import { join } from "node:path";
import { ROOT, patchTitles } from "markopress";

const titled = await patchTitles(join(ROOT, "dist", "public"));
console.log(`[markopress] patched <title> on ${titled} page(s)`);

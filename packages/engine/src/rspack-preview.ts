// Rspack 产物预览：static adapter 的 startPreview（sirv dist/server/public，
// html 扩展解析 + /404 兜底）。产物是纯静态，等价于任意 static server。
import staticAdapter from "@markopack/adapter-static";
import { ROOT } from "./content.ts";
import { join } from "node:path";

const port = Number(process.env.PORT) || 3001;
const adapter = staticAdapter();
// startPreview 收事件对象 {entry, options}（markopack 0.5.0 契约）：options 内
// cwd/args 必填 + dir = 产物目录 + port
await adapter.startPreview!({
  entry: undefined,
  options: { cwd: ROOT, args: [], port, dir: join(ROOT, "dist", "server") },
});

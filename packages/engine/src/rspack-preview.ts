// Rspack 产物预览：static adapter 的 startPreview（sirv dist/server/public，
// html 扩展解析 + /404 兜底）。产物是纯静态，等价于任意 static server。
import staticAdapter from "@markopack/adapter-static";
import { ROOT } from "./content.ts";
import { join } from "node:path";

const port = Number(process.env.PORT) || 3001;
const adapter = staticAdapter();
await adapter.startPreview!({
  options: { dir: join(ROOT, "dist", "server"), port },
});

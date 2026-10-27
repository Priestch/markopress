// markopack（Rspack）build 入口：prepare（内容层 + 路由 + 内容模块）→ SSG。
// 产物结构与 Vite 路径不同：dist/client（浏览器 bundle）+ dist/server/public/*.html
// （static adapter 爬取渲染，crawl 后删 server entry）——Vite 是 dist/public/*.html。
// 收尾把 dist/client/static 并入 dist/server/public/static：静态根自包含
// （补 markopack adapter 不合并 client 资产的缺口），整目录可直接部署/预览。
import { cp, rm } from "node:fs/promises";
import { join } from "node:path";
import { build } from "@markopack/rspack";
import staticAdapter from "@markopack/adapter-static";
import { ROOT } from "./content.ts";
import { mpRspack, prepare } from "./rspack-shared.ts";

// 先清 dist：Rspack 不会自清（vite 会），不清的话切配置后旧 HTML 残留混入产物
await rm(join(ROOT, "dist"), { recursive: true, force: true });

await prepare();
await build({
  root: ROOT,
  routesDir: ".markopress/routes",
  entry: "./.markopress/entry.ts",
  outputDir: "dist",
  mode: "production",
  adapter: staticAdapter(),
  rspack: mpRspack(),
});

const staticSrc = join(ROOT, "dist", "client", "static");
const staticDest = join(ROOT, "dist", "server", "public", "static");
await rm(staticDest, { recursive: true, force: true });
await cp(staticSrc, staticDest, { recursive: true });
console.log("[markopress] client assets merged into dist/server/public (self-contained static root)");

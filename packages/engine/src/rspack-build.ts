// markopack（Rspack）build 入口：prepare（内容层 + 路由 + 内容模块）→ SSG。
// 产物结构与 Vite 路径不同：dist/client（浏览器 bundle）+ dist/server/public/*.html
// （static adapter 爬取渲染，crawl 后删 server entry）——Vite 是 dist/public/*.html。
// 收尾把 dist/client/static 并入 dist/server/public/static：静态根自包含
// （补 markopack adapter 不合并 client 资产的缺口），整目录可直接部署/预览。
import { cp, rm } from "node:fs/promises";
import { join } from "node:path";
import { build } from "@markopack/rspack";
import staticAdapter from "@markopack/adapter-static";
import { ROOT, ensureSynced } from "./content.ts";
import { patchTitles } from "./patch-titles.ts";
import { mpRspack, prepare } from "./rspack-shared.ts";
import { snapshotCollections, ssgAdapterOptions } from "./ssg.ts";

// 先清 dist：Rspack 不会自清（vite 会），不清的话切配置后旧 HTML 残留混入产物
await rm(join(ROOT, "dist"), { recursive: true, force: true });

// 图片管线 v2 的失败分流：build 远程图失败硬退（CI 正确性优先），dev 软降级
process.env.MARKOPRESS_PHASE = "build";

await prepare();
// config.ssg.urls 接线：参数路由（$slug/$$rest 用户页）爬虫枚举不了，显式清单经
// adapter-static Options.urls 透传。ensureSynced 单例（prepare 已 sync 过，只读）：
// 函数形回调收 sync 后的集合条目快照——route:false 集合派生详情路径不二次拉远端。
const synced = await ensureSynced();
const adapterOptions = ssgAdapterOptions(
  synced.ssg?.urls,
  snapshotCollections(synced.store, synced.config.collections),
);
await build({
  root: ROOT,
  routesDir: ".markopress/routes",
  entry: "./.markopress/entry.ts",
  outputDir: "dist",
  mode: "production",
  adapter: staticAdapter(adapterOptions),
  rspack: mpRspack(),
});

const staticSrc = join(ROOT, "dist", "client", "static");
const staticDest = join(ROOT, "dist", "server", "public", "static");
await rm(staticDest, { recursive: true, force: true });
await cp(staticSrc, staticDest, { recursive: true });
console.log("[markopress] client assets merged into dist/server/public (self-contained static root)");

// per-page <title>/description 补写（marko-run 无 head 通道；scripts/patch-titles.ts）
const titled = await patchTitles(join(ROOT, "dist", "server", "public"));
console.log(`[markopress] patched <title> on ${titled} page(s)`);

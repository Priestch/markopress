// markopack（Rspack）后端的共用接线，rspack-dev / rspack-build 共享。
//
//  - mpRspack()：markopack dev()/build() 的 rspack 配置回调。核心只有一件事——
//    NormalModuleReplacementPlugin 把 `virtual:mp/content/<c>/<id>` 重写到
//    .markopress/vcontent/<c>/<id>.js 真实文件（与 markopack 自己重写 virtual:marko-run
//    同款手法）。文件在编译图内 ⇒ Rspack 原生 watcher 负责失效，不碰 routes 目录。
//  - prepare()：内容层 sync → 路由生成 → 内容模块落盘。必须先于 markopack 的
//    routesDir walk（markopress-plugin.ts 里这是 Vite config 钩子的职责）。
import path from "node:path";
import { rspack } from "@rspack/core";
import type { Configuration } from "@rspack/core";
import { VIRTUAL_PREFIX } from "./content.ts";
import { writeContentModules, VCONTENT_DIR } from "./content-modules.ts";
import { ensureSynced } from "./content.ts";
import { generateRoutes } from "./gen-routes.ts";
import { PLUGIN_DATA_DIR, PLUGIN_VIRTUAL_PREFIX } from "./plugins.ts";

export function mpRspack() {
  return (config: Configuration, side: "browser" | "server") => {
    config.plugins.push(
      new rspack.NormalModuleReplacementPlugin(
        // virtual:mp/content/<c>/<id> → vcontent/<c>/<id>.js；
        // virtual:mp/plugin/<name> → plugin-data/<name>.js（真实文件在编译图内 ⇒ 原生 watcher 失效）
        new RegExp(`^(?:${VIRTUAL_PREFIX}|${PLUGIN_VIRTUAL_PREFIX})`),
        (resource: { request: string }) => {
          // request 形如前缀+rest（无扩展名）→ 直接拼完整绝对路径，绕开 resolve extensions 歧义
          if (resource.request.startsWith(VIRTUAL_PREFIX)) {
            const rest = resource.request.slice(VIRTUAL_PREFIX.length);
            resource.request = path.join(VCONTENT_DIR, `${rest}.js`);
          } else {
            const name = resource.request.slice(PLUGIN_VIRTUAL_PREFIX.length);
            resource.request = path.join(PLUGIN_DATA_DIR, `${name}.js`);
          }
        },
      ),
    );
    // sourcemap 策略：生产关掉 browser 侧的 hidden-source-map（markopack 默认）——
    // 5000 页会落盘 ~636MB 未被引用的 .map；客户端代码是框架+模板产物，溯源价值低，
    // 需要时注释掉这两行即可恢复。
    if (config.mode === "production" && side === "browser") {
      config.devtool = false;
    }
  };
}

export async function prepare(): Promise<void> {
  const started = performance.now();
  const synced = await ensureSynced();
  // 等插件产物落盘：handler 模块 import 的 plugin-data 必须在编译图构建前存在
  // （rspack-build 与 rspack-dev 共用；全量 contentSynced 是串行链，量级 = 读 store + 序列化）
  await synced.pluginsReady;
  const { routes, written } = await generateRoutes();
  const modules = await writeContentModules();
  const elapsed = Math.round(performance.now() - started);
  console.log(
    `[markopress] prepare: ${routes.length} route(s), ` +
      `${written.length} route file(s) written, ${modules.written.length} content module(s) written ` +
      `(${modules.removed.length} removed) in ${elapsed}ms`,
  );
}

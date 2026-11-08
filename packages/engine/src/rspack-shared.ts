// markopack（Rspack）后端的共用接线，rspack-dev / rspack-build 共享。
//
//  - mpRspack()：markopack dev()/build() 的 rspack 配置回调。核心只有一件事——
//    NormalModuleReplacementPlugin 把 `virtual:mp/content/<c>/<id>` 重写到
//    .markopress/vcontent/<c>/<id>.js 真实文件（与 markopack 自己重写 virtual:marko-run
//    同款手法）。文件在编译图内 ⇒ Rspack 原生 watcher 负责失效，不碰 routes 目录。
//  - prepare()：内容层 sync → 路由生成 → 内容模块落盘。必须先于 markopack 的
//    routesDir walk（markopress-plugin.ts 里这是 Vite config 钩子的职责）。
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { rspack } from "@rspack/core";
import type { Configuration } from "@rspack/core";
import { VIRTUAL_PREFIX } from "./content.ts";
import { writeContentModules, VCONTENT_DIR } from "./content-modules.ts";
import { SEGMENT_PREFIX, VSEG_DIR } from "./segments.ts";
import { ensureSynced } from "./content.ts";
import { generateRoutes } from "./gen-routes.ts";
import { PLUGIN_DATA_DIR, PLUGIN_VIRTUAL_PREFIX } from "./plugins.ts";

/**
 * marko 全家单实例钉扎（resolve.alias）。link: 消费（引擎未发 npm 时的直连形态）
 * 下 app 自己的 pnpm store 与 markopress store 各解析一份 @marko/runtime-tags——
 * 两份模块实例进同一个 bundle ⇒ 模板注册在 A 份、渲染走 B 份，SSR 报
 * "Cannot read properties of undefined (reading 'boundary')"（2026-10-30 blog
 * 实测踩中）。把 marko / @marko/run / @marko/runtime-tags / @marko/compiler
 * 全部钉到引擎上下文解析出的同一份，任何消费形态下 bundle 内单实例。
 */
function markoFamilyAliases(): Record<string, string> {
  const require = createRequire(import.meta.url);
  const aliases: Record<string, string> = {};
  // 目录型 alias 会绕过包 exports（裸子路径无扩展名不可解析）——精确到编译产物
  // 实际引用的入口文件。runtime-tags 是模板产物的直接依赖（其余家族经 markopack
  // 自身解析，本就单实例），只钉它即可。
  for (const spec of [
    "@marko/runtime-tags",
    "@marko/runtime-tags/html",
    "@marko/runtime-tags/dom",
    "@marko/runtime-tags/debug/html",
    "@marko/runtime-tags/debug/dom",
  ]) {
    try {
      aliases[spec] = require.resolve(spec);
    } catch {
      // 该形态未安装（如纯 SSR）则跳过
    }
  }
  return aliases;
}

export function mpRspack() {
  const familyAliases = markoFamilyAliases();
  return (config: Configuration, side: "browser" | "server") => {
    // marko 全家单实例（见 markoFamilyAliases 注释）——alias 前缀语义连子路径
    // （@marko/runtime-tags/debug/html）一起钉住
    config.resolve ??= {};
    config.resolve.alias = { ...(config.resolve.alias as Record<string, string>), ...familyAliases };
    config.plugins.push(
      new rspack.NormalModuleReplacementPlugin(
        // virtual:mp/content/<c>/<id> → vcontent/<c>/<id>.js；
        // virtual:mp/segment/<c>/<id>/<n> → vseg/<c>/<id>/<n>.marko（真实 .marko 进编译图）；
        // virtual:mp/plugin/<name> → plugin-data/<name>.js（真实文件 ⇒ 原生 watcher 失效）
        new RegExp(`^(?:${VIRTUAL_PREFIX}|${PLUGIN_VIRTUAL_PREFIX}|${SEGMENT_PREFIX})`),
        (resource: { request: string }) => {
          // request 形如前缀+rest（无扩展名）→ 直接拼完整绝对路径，绕开 resolve extensions 歧义
          if (resource.request.startsWith(VIRTUAL_PREFIX)) {
            const rest = resource.request.slice(VIRTUAL_PREFIX.length);
            resource.request = path.join(VCONTENT_DIR, `${rest}.js`);
          } else if (resource.request.startsWith(SEGMENT_PREFIX)) {
            const rest = resource.request.slice(SEGMENT_PREFIX.length);
            resource.request = path.join(VSEG_DIR, `${rest}.marko`);
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

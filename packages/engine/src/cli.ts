#!/usr/bin/env node
// markopress CLI —— 引擎入口。命令面刻意最小（dev/build/preview/gen）；
// 配置/环境经既有约定流动（.markopress/config.ts、PORT、MP_CONTENT_CONFIG）。
// Vite 对照路径不进用户面（仓库内 dev:vite 专用，走 markopress/vite 导出）。
const [, , command, ...rest] = process.argv;

const usage = `markopress — md 即页面的内容框架

用法：markopress <command>

  dev       开发服务器（markopack/Rspack，热更 + full-reload；PORT 指定端口）
  build     SSG 构建（dist/server/public/ 自包含静态根）
  preview   预览构建产物
  gen       手动跑路由生成器（dev/build 会自动跑，一般不需要）

环境：MP_CONTENT_CONFIG=.markopress/<x>.config.ts 换内容配置形态`;

const commands: Record<string, () => Promise<unknown>> = {
  dev: () => import("./rspack-dev.ts"),
  build: () => import("./rspack-build.ts"),
  preview: () => import("./rspack-preview.ts"),
  gen: () => import("./gen-routes.ts").then((m) => m.main()),
};

// 索引访问在 Record<string, F> 下不携带 undefined——显式标注缺路由分支
const run: (() => Promise<unknown>) | undefined = commands[command];
if (!run || rest.length) {
  console.error(usage);
  // 函数值不做真值判断（TS2774）：显式比较
  process.exit(run === undefined ? 0 : 1);
}
await run();

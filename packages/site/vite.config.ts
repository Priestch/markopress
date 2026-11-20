// markopress —— 包裹 @marko/run 的 Vite 插件（组合方式即官方文档预期）。
//
// markopressPlugin()（scripts/markopress-plugin.ts）负责：
//   - config:  内容层 sync + 路由生成（先于 marko-run 的 routes 目录 walk）
//   - 虚拟模块 virtual:mp/content/<collection>/<id> → { data, segments, headings }
//   - configureServer: 监听 content/*.md → re-sync → 增量失效（死锁纪律见 spike-notes）
//
// markoRun() 的 routesDir 指向生成目录。static adapter 不传 urls：它本来就会
// 把路由表里所有无参数路由全部入队爬取，显式清单会让每页爬两次（并发 ×2，
// 大站点直接 OOM——2026-10-14 实测）。带参数的路由未来才需要 urls 补充。
import markoRun from "@marko/run/vite";
import staticAdapter from "@marko/run-adapter-static";
import { markopressPlugin } from "markopress/vite";

export default {
  plugins: [
    markopressPlugin(),
    ...markoRun({
      routesDir: ".markopress/routes",
      adapter: staticAdapter(),
    }),
  ],
};

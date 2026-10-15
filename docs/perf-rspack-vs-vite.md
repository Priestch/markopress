# markopack（Rspack）集成与 5000 页性能对比

> 日期：2026-10-15。机器：32 核 / 61GB RAM。夹具：`content/`（3 篇）+ `content-perf/`（5000 篇，`node scripts/perf-test.mjs 5000`），共 **5003 路由**。
> （测量后 perf 集合已从默认链路解耦：默认 `content.config.ts` 只有文档站，perf 走 `content.perf.config.ts` + `pnpm dev:perf`/`build:perf`。）
> 对比对象：Vite 侧 `@marko/run 0.11.13` + Vite 8（含 crawler 并发 patch）vs Rspack 侧 markopack 工作区直连 + `@rspack/core 2.2.9`。
> （测量时命令名为 `pnpm build`/`pnpm dev` vs `pnpm build:rspack`/`pnpm dev:rspack`；现已换位——Rspack 为主链路 `pnpm build`/`pnpm dev`，Vite 为 `pnpm build:vite`/`pnpm dev:vite`，同树双命令、非 git 分支。）
> 结论先行：**dev 交互在 5000 页规模上 Rspack 数量级占优**（slug 增删 20~50×）；build 快 ~14% 但峰值内存 +38%；SSG HTML 与客户端 JS 体积两边打平。

## 1. 集成方式（双后端并存，Vite 路径零改动）

```
scripts/rspack-shared.ts   mpRspack() 配置回调 + prepare()（sync → gen-routes → 内容模块落盘）
scripts/rspack-dev.ts      dev 入口 + 独立内容 watcher（vite 插件 configureServer 的移植）
scripts/rspack-build.ts    build 入口（SSG）
scripts/content-modules.ts 虚拟模块源码唯一来源（renderContentModule），Vite load 与 Rspack 落盘共用
scripts/perf-dev-probe.mjs dev 探针（启动/编辑/增/删时延 + 进程树峰值 RSS）
```

- 依赖：`link:../markopack/packages/{rspack,adapter-static}`（未发版的热路由发现 `bcb23a9` 与 crawler 并发修复 `40e0d33` 必须本地直连）；devDeps 补 `@rspack/core` 与 **`@marko/runtime-tags`（pnpm 严格布局下 `.marko-run` 水合入口从根解析需要直接依赖，npm 扁平布局无此问题）**。
- 虚拟模块映射：`virtual:mp/content/<c>/<id>` 经 `NormalModuleReplacementPlugin` 重写到 `.markopress/vcontent/<c>/<id>.js` 真实文件（write-if-changed）。失效链路：
  - md 编辑 → syncFile → 重写 vcontent 文件 → Rspack 原生 watcher（文件在编译图内）→ 重编译 → done 钩子 reload server bundle；
  - slug 增/删 → generateRoutes 产出 `+page.marko` 文件事件 → markopack 内置 watchRoutes re-walk（零新代码）；
  - config 变更 → resetSynced → 全量重建 + 全量重写。
  - routes 目录对两个后端完全一致（wrapper 的 import 指定符不变）。
- 已验证（smoke，1000 夹具 + 5000 夹具）：SSG 5003 HTML、Playwright 水合（Counter 点击自增）、编辑/新增/删除热生效（~2s）、**同批次「新增 page + touch layout」无死锁**（marko-run 竞态场景的 Rspack 对照）、两包 vitest 全绿（53+15）。

## 2. Build 对比（冷 store + 干净 dist，`/usr/bin/time -v`）

| 指标 | Vite | Rspack | Δ |
|---|---|---|---|
| 墙钟 | 2:18.9 | **1:59.2** | **-14%** |
| 峰值 RSS | **4.52GB** | 6.26GB | +38% |
| SSG HTML | 5003 / 902MB | 5003 / 880MB | ≈（单页 ~180KB，nav 主导） |
| 客户端 JS | 40MB | 32.9MB（5003 chunk × ~6.5KB） | ≈ |
| 附加产物 | — | 636MB `.js.map`（hidden-source-map 落盘但未引用，部署需排除或关 devtool） | |
| 暖 store 复跑 | 2:16.3 | 1:54.2 | store 只省 ~5s，编译主导 |

结构差异：Vite 产物 `dist/public/`；Rspack 产物 `dist/client/`（浏览器 bundle）+ `dist/server/public/`（HTML；adapter crawl 后删 server entry）。`dist/client/index.html` 是 HtmlRspackPlugin 的模板残留，无路由用途。

## 3. Dev 对比（`scripts/perf-dev-probe.mjs`，5003 路由）

| 指标 | Vite | Rspack（3 次） | 评 |
|---|---|---|---|
| 启动 → GET / 200 | 120.2s | **69.5 / 69.8 / 69.5s** | Rspack 1.7×；两边都是全量编译，vite 另有 marko-run re-walk 风暴 |
| 冷深页 GET | 8ms | 38ms / 306ms / 1.9s | Rspack 首击受 server reload 影响，二次起快 |
| md 编辑 → 可见 | **201ms** | 1.35 / 1.37 / 1.91s | Vite 胜（模块图单点失效 vs Rspack 重编译一轮），均可接受 |
| md 新增 → 路由 200 | 109.1s | **4.87 / 2.58 / 4.62s** | **Rspack 20~40×** |
| md 删除 → 404 | 109.0s | **2.41 / 1.90 / 8.04s** | **Rspack 13~50×** |
| 峰值 RSS | **3.8GB** | 6.3~6.4GB | Vite 省 40% |

- Vite 的增/删 ~109s：marko-run dev watcher 对**任何**路由文件事件做全量 re-walk（5003 路由），CLAUDE.md 已记载的边界在 5000 页下单次增删即触发。Rspack 侧同样是 re-walk，但在进程内做增量（buildAndWriteRoutes diff + writeModule + 增量重编译），秒级。
- 时延方差：Rspack 增/删 1.9~8s（受当轮增量编译与 server reload 影响）；对编辑路径 3 次都很稳定（~1.4s）。
- 内容层成本（两后端共用）：冷 store 装配 + 5003 路由生成 + 5003 内容模块落盘 = prepare **3.2s**。

## 4. 已知差异 / 缺口

1. ~~dev 无 ws full-reload~~ **已补**（2026-10-15 同日）：markopack dev.ts 内置 SSE 通道 `/__markopack_reload` + 首块 HTML 注入 reload 客户端，任一编译器干净重建（含 server bundle 换血后）去抖广播 reload——Playwright E2E 验证 md 编辑后页面自动刷新。
2. ~~生产 source map 落盘 636MB~~ **已关**：`mpRspack()` 对 browser 侧 prod 设 `devtool: false`（需要时在 scripts/rspack-shared.ts 注释两行恢复）。
3. ~~preview 未接 Rspack~~ **已接**：`pnpm preview`（adapter startPreview，sirv dist/server/public）；build 末尾把 `dist/client/static` 并入 `dist/server/public/static`，静态根自包含（补 markopack adapter 不合并 client 资产的缺口），整目录可直接部署。
4. 客户端每页一个 chunk（~6.5KB）+ hydrate runtime；与 Vite 的 assets 形态不同但总量同级。
5. pnpm 12 不再读 package.json 的 `pnpm` 字段：esbuild 构建审批迁至 `pnpm-workspace.yaml` 的 `allowBuilds`。

## 5. 结论

- `rspack-watcher.md` §5 的迁移论断获得实测支撑：**「再生成 × re-walk」在 Rspack 侧不仅成立，而且把 vite 侧的 O(全站) re-walk 风暴变成 O(增量) 秒级**——5000 页站点的 dev 可用性质变（增删从 ~110s → 2~8s）。
- build 快 14%、内存 +38%（6.3GB vs 4.5GB，61GB 机器无压力；小内存机器需注意）。
- 死锁竞态、布局融合、SSG、resumability 在 Rspack 路径全部复验通过。迁移的剩余成本只剩：full-reload 补齐、preview 接线、source map 策略。

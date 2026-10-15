# Rspack dev watcher 机制(换 markopack 的评估依据)

> 日期:2026-10-15。版本:`@rspack/core 2.2.9`(markopack node_modules 实测)、markopack 当前工作区(未发版)。
> 结论来源:markopack example(rspack-basic)上的三组对照实验 + `~/Enter/rspack` 源码(`crates/rspack_watcher`)+ `@rspack/core` dist 实现。
> 背景:评估 markopress 从 @marko/run(Vite)迁到 markopack(Rspack)的可行性——spike 的核心机制「再生成 × re-walk」在 Rspack 侧如何成立。

## 1. 监听注册模型(watchpack 的 Rust 移植)

`crates/rspack_watcher/src/lib.rs` 是 webpack watchpack 语义的忠实移植。每轮编译结束后,JS 侧 `Watching` 从**编译快照**收集三类路径喂给 Rust `FsWatcher.watch(files, directories, missing)`(`@rspack/core/dist/index.js` Watching 类,`watchFileSystem.watch(...)` 调用):

| 类别 | 来源 | 作用 |
|---|---|---|
| `files` | fileDependencies(入口 + 所有被 resolve/import 的真实模块) | 监听其所在目录 |
| `directories` | contextDependencies | 目录内**新增文件**由 Scanner 扫描捕获 |
| `missing` | missingDependencies(曾解析失败的路径) | 文件出现时触发重建 |

关键:**只监听编译图,不监听整个项目**。路由 `.marko` 文件是生成入口(`.marko-run/__marko-run__*.js`)里的静态 import → 属于 fileDependencies(逐文件监听,不是 context 目录)——所以 routesDir 里**新增**一个没人 import 的文件,watcher 完全看不见。这就是 markopack dev 目前不支持路由增删热发现的根因。

- 默认 `watchOptions.ignored = /[\\/](?:\.git|node_modules)[\\/]/`(Watching 构造函数里钉死)——**不忽略点前缀目录**,`.marko-run`/`.markopress` 不受影响;`ignored.rs` 是纯配置驱动的 watchpack glob 移植,无隐藏规则。
- 事件流:notify(inotify/FSEvents)→ `Trigger` → `Executor` 按 `aggregateTimeout` 聚合(markopack dev.ts 传 100ms;Rspack 默认 5ms)→ JS `Watching.#invalidate` → 重编译 → `done` hooks(markopack 在这里 reloadServerBundle)。

## 2. 实证(rspack-basic example,dev server 运行中)

| 实验 | 操作 | 结果 | 证据 |
|---|---|---|---|
| A | 编辑已在图内的路由文件(`src/routes/about/+page.marko`) | ✅ 14ms 重编译,bundle 更新,页面生效 | 标记进 `dist/server/index.cjs` 且页面渲染 |
| B | 新增路由文件(touch 也算) | ❌ 零编译、404 | watcher 日志无变化 |
| C | **外部进程**重跑 `buildAndWriteRoutes`(重写 `.marko-run/` 全部文件,router.js 含新路由) | ⚠️ 编译轮触发了(85ms),但产物**零更新**,仍 404 | 磁盘 router.js 含新路由 3 处、`dist/server/index.cjs` 0 处;产物 mtime 停留在上次源码编辑时刻 |

实验 C 是最重要的异常:watcher 确实看到 `.marko-run/` 文件变化(它们在 fileDependencies 里),编译轮触发;但重编译读到的还是旧内容 → 不重新 emit。

## 3. 根因:VirtualModulesPlugin 的 Rust 侧虚拟存储遮蔽磁盘

`@rspack/core` 的 `VirtualModulesPlugin`(Rust 实现,webpack-virtual-modules 的对应物):

- markopack 的 `writeVirtualModule()`(rspack/src/routes.ts)把每个 `.marko-run/` 文件**同时**写进 VirtualModulesPlugin 的 map 和磁盘。但编译进程读的是 **Rust 侧 virtual file store**(`writeVirtualFileSync` / `compiler.__internal__get_virtual_file_store()`),磁盘文件只是解析用的影子。**外部进程(或任何只写磁盘的路径)重写这些文件 = 对编译进程不可见**。这解释了实验 C 的全部现象。
- 官方文档确认:虚拟模块「treated as if they were real files」;`writeModule(filePath, contents)` 是动态更新通道——写虚拟存储 + `watchFileSystem.triggerEvent('change', fullPath)` 合成 watcher 事件 → 聚合 → 重编译。
- **时序警告**(文档明示):writeModule 要求 Rust 编译器已初始化;`beforeCompile`/`compile` 钩子里调用会抛 "Virtual file store has not been initialized"。watcher 事件回调里调用是安全的(watch 启动必然晚于编译器初始化)。

## 4. 双编译器实例陷阱(实现编排层前必读)

markopack 的 `createConfigs`(rspack/src/config.ts)把**同一个** `VirtualModulesPlugin` 实例 spread 进 web 和 node 两个 config。JS 实现 `apply(compiler)` 里 `this.#compiler = compiler` ——**后 apply 的编译器覆盖前一个**。后果:

- 初始静态文件没问题(VFILES_BY_COMPILER 按 compiler 分别登记,双编译器都拿到);
- 但 `writeModule` 只会写**最后一个** apply 的编译器的 store 并只触发它的合成事件——另一侧(web 或 node)的虚拟模块永远停在旧值。

所以编排层必须让 web/node 各持一个 `VirtualModulesPlugin` 实例,分别 writeModule。

## 5. 对迁移评估的修正(覆盖此前口头结论)

- ❌ 旧结论:「spike 的核心机制(再生成 × re-walk)在 markopack 里不存在」。
- ✅ 修正:**原语是一等公民**——`watch routesDir → 重跑 buildAndWriteRoutes → 对变化的虚拟模块逐个 writeModule()` 就是 Rspack 版「再生成 × re-walk」。writeModule 精确失效单个模块;小项目一轮重编译 ~14ms。
- markopack 缺的只是**编排层**(~50 行,加在 dev 侧):routesDir 监听 + 进程内 re-walk + virtualModules map diff + writeModule。
- markopress 侧映射也干净:`virtual:mp/content/…` + Vite 模块图失效 ≈ `VirtualModulesPlugin` + `writeModule`,失效粒度语义可保留;区别是每轮失效触发一次 Rspack 增量重编译(大站点行为待实测)。
- **死锁竞态天然消失**:那是 @marko/run 的 Vite watcher 特有;Rspack 的聚合模型里「新增路由 + 改布局」就是两个普通事件,聚合成一轮重编译(实验可验证)。
- 迁移剩余成本:① markopack 编排层(见 §6,可先做,不迁移也有价值);② markopressPlugin 端口(Vite → Rspack 插件);③ spike 验收六项重验(marko 层面的布局融合/SSG/resumability 与打包器无关,风险小)。
- 对 OOM 待办无影响:`pnpm patch` 上游 adapter 仍是最快止血;crawler 修复进 markopack 与迁移决策解耦。

## 6. 编排层设计(markopack 侧,已作为实现任务派发)

```
dev() 启动后:
  fs.watch(resolvedRoutesDir, {recursive: true})   # Node ≥20.19,Linux 支持 recursive
    → 去抖 ~100ms(与 aggregateTimeout 对齐)
    → 进程内重跑 buildAndWriteRoutes(root, routesDir, trailingSlashes, null)
    → diff 前后 virtualModules map
    → 对每个 changed/added:web/node 两个 VirtualModulesPlugin 实例分别 writeModule(absPath, content)
    → Rspack 聚合重编译 → node done hook → reloadServerBundle → 新路由可达
```

- 虚拟文件**删除**:writeModule 无删除对应物;路由删除靠 router.js 重生成后 entry 不再被引用,陈旧 entry 文件无害。
- 磁盘写入保留(解析需要),但应 write-if-changed,避免无谓 mtime 抖动。
- 守卫:`routes !== false`、routesDir 存在、re-walk 抛错只 log 不杀 server。

## 7. 验收方法(编排层)

自动化脚本(markopack `scripts/test-dev-watch.mjs`):起 example dev → 就绪后依次——

1. 新增 `src/routes/__watch-test/+page.marko` → 轮询 `GET /__watch-test` 至 200(超时 ~15s);
2. 编辑该文件加标记 → 响应含标记;
3. 删除该文件 → 404;
4. 回归:编辑已有路由 → 标记生效(实验 A 路径不被破坏);
5. **同批次**新增 page + 修改 `+layout.marko`(marko-run 死锁场景的 Rspack 对照)→ 新路由 200、无请求挂起。

退出码 0/1,挂到 npm script(`test:dev-watch`)。

// markopress Vite 插件：content 层与 marko-run 的接线。
//
//  - config:  sync + 生成路由。本插件排在 markoRun() 之前，Vite 顺序 await 各插件
//             config 钩子 ⇒ 路由先于 marko-run 的 routes 目录 walk 生成。
//  - 虚拟模块 virtual:mp/content/<collection>/<id> → { data, segments, headings }：
//    查 store、按 digest 惰性渲染（渲染器内存缓存）。
//  - configureServer: 监听所有集合 loader 声明的 watchDirs → 事件进队列（单飞串行，
//    逐批 drain）→ 优先单文件增量（syncer.syncFile：只读事件文件，O(1)；无人认领
//    则忽略）。config 文件变更走全量重建。失效一律走 Vite 模块图，不碰 routes 目录
//    文件事件（死锁纪律，docs/spike-notes.md）。
import { resolve } from "node:path";
import type { ContentConfig } from "@markopress/content";
import type { Plugin, ViteDevServer } from "vite";
import { renderContentModule } from "./content-modules.ts";
import {
  CONFIG_FILE,
  ensureSynced,
  resetSynced,
  STORE_DIR,
  VIRTUAL_PREFIX,
} from "./content.ts";
import { generateRoutes } from "./gen-routes.ts";

const RESOLVED_PREFIX = "\0" + VIRTUAL_PREFIX;

/** 队列任务：file = 单文件事件；full = config 变更的全量重建（覆盖同批文件事件） */
type Job =
  | { kind: "file"; type: "add" | "change" | "unlink"; file: string }
  | { kind: "full" };

export function markopressPlugin(): Plugin {
  // 「collection/id」→ digest 记忆：全量路径做 diff；增量路径 O(1) 维护
  let knownDigests = new Map<string, string>();
  let watchDirs = new Set<string>();
  let queue: Array<Job> = [];
  let draining = false;

  async function snapshot(): Promise<Map<string, string>> {
    const { store, config } = await ensureSynced();
    const map = new Map<string, string>();
    for (const name of Object.keys(config.collections)) {
      for (const entry of store.values(name)) map.set(`${name}/${entry.id}`, entry.digest ?? "");
    }
    return map;
  }

  function invalidate(server: ViteDevServer, key: string): void {
    const mod = server.moduleGraph.getModuleById(RESOLVED_PREFIX + key);
    if (mod) server.moduleGraph.invalidateModule(mod);
  }

  /** config 里新出现的 watchDirs 补进 watcher（config 编辑可能新增集合/base） */
  function adoptWatchDirs(server: ViteDevServer, config: ContentConfig): void {
    for (const collection of Object.values(config.collections)) {
      for (const dir of collection.loader.watchDirs ?? []) {
        const abs = resolve(dir);
        if (!watchDirs.has(abs)) {
          watchDirs.add(abs);
          server.watcher.add(abs);
        }
      }
    }
  }

  return {
    name: "markopress",
    enforce: "pre",

    async config() {
      const { config } = await ensureSynced();
      for (const collection of Object.values(config.collections)) {
        for (const dir of collection.loader.watchDirs ?? []) watchDirs.add(resolve(dir));
      }
      await generateRoutes();
      knownDigests = await snapshot();
    },

    resolveId(id) {
      if (id.startsWith(VIRTUAL_PREFIX)) {
        return RESOLVED_PREFIX + id.slice(VIRTUAL_PREFIX.length);
      }
    },

    async load(id) {
      if (!id.startsWith(RESOLVED_PREFIX)) return;
      const rest = id.slice(RESOLVED_PREFIX.length);
      const slash = rest.indexOf("/");
      const collection = rest.slice(0, slash);
      const entryId = rest.slice(slash + 1);
      const { store, renderer } = await ensureSynced();
      const entry = store.get(collection, entryId);
      if (!entry) {
        throw new Error(`[markopress] no content entry "${collection}/${entryId}" (stale generated route? rerun sync)`);
      }
      // 模块源码唯一来源在 content-modules.ts（Rspack 路径落盘共用）
      return renderContentModule(entry, renderer);
    },

    configureServer(server) {
      for (const dir of watchDirs) server.watcher.add(dir);
      server.watcher.on("all", (event, file) => {
        if (typeof file !== "string") return;
        if (file === CONFIG_FILE) {
          // 配置文件变了：重装配（新 digest ⇒ store 全量重建），随后走全量路径
          resetSynced();
          enqueue(server, { kind: "full" });
          return;
        }
        if (file.startsWith(STORE_DIR) && file.endsWith(".json")) {
          // store flush 写盘触发的递归事件：忽略（真正的变更由 md 编辑触发）
          return;
        }
        const type =
          event === "add" ? "add" : event === "change" ? "change" : event === "unlink" ? "unlink" : undefined;
        if (!type || !isWatched(file)) return;
        enqueue(server, { kind: "file", type, file });
      });
    },
  };

  function isWatched(file: string): boolean {
    for (const dir of watchDirs) {
      if (file === dir || file.startsWith(`${dir}/`) || file.startsWith(`${dir}\\`)) return true;
    }
    return false;
  }

  function enqueue(server: ViteDevServer, job: Job): void {
    queue.push(job);
    if (!draining) void drain(server);
  }

  async function drain(server: ViteDevServer): Promise<void> {
    draining = true;
    try {
      while (queue.length) {
        const jobs = queue;
        queue = [];
        try {
          if (jobs.some((j) => j.kind === "full")) {
            await fullResync(server);
          } else {
            let touched = false;
            for (const job of jobs) {
              if (job.kind === "file") touched = (await syncOne(server, job.type, job.file)) || touched;
            }
            if (touched) {
              // 批末一次：slug 增删才有 routes 文件事件（模板不变则 write-if-changed 全跳过）
              await generateRoutes();
              server.ws.send({ type: "full-reload" });
            }
          }
        } catch (error) {
          // 坏 frontmatter 等：报到终端，server 不死；修好文件自动恢复
          const message = error instanceof Error ? error.message : String(error);
          server.config.logger.error(`[markopress] content sync failed:\n${message}`, { timestamp: true });
        }
      }
    } finally {
      draining = false;
    }
  }

  /** 单文件增量。返回是否有 entry 实际变化（决定批末要不要重生成路由/刷新）。 */
  async function syncOne(
    server: ViteDevServer,
    type: "add" | "change" | "unlink",
    file: string,
  ): Promise<boolean> {
    const { store, syncer, config } = await ensureSynced();
    const outcome = await syncer.syncFile(config, { type, path: file });
    if (!outcome.handled) return false;
    for (const { collection, id } of outcome.changed) {
      invalidate(server, `${collection}/${id}`);
      knownDigests.set(`${collection}/${id}`, store.get(collection, id)?.digest ?? "");
    }
    for (const { collection, id } of outcome.removed) {
      invalidate(server, `${collection}/${id}`);
      knownDigests.delete(`${collection}/${id}`);
    }
    return outcome.changed.length + outcome.removed.length > 0;
  }

  /** 全量重建（config 文件变更后）。ensureSynced 已在装配时全量 sync，这里只做收尾。 */
  async function fullResync(server: ViteDevServer): Promise<void> {
    const { config } = await ensureSynced();
    adoptWatchDirs(server, config);
    const current = await snapshot();
    const changed: Array<string> = [];
    for (const [key, digest] of current) {
      if (knownDigests.get(key) !== digest) changed.push(key);
    }
    for (const key of knownDigests.keys()) {
      if (!current.has(key)) changed.push(key);
    }
    knownDigests = current;
    for (const key of changed) invalidate(server, key);
    await generateRoutes();
    server.ws.send({ type: "full-reload" });
  }
}

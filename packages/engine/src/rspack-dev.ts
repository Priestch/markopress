// markopack（Rspack）dev 入口 —— vite 插件 configureServer 逻辑的独立 watcher 移植。
//
// 与 Vite 路径（scripts/markopress-plugin.ts）的差异：
//   - 失效不再走 Vite 模块图：md 编辑 → syncFile → 重写 .markopress/vcontent/ 文件 →
//     Rspack 原生 watcher（文件在编译图内）触发重编译，markopack 的 done 钩子自动
//     reload server bundle。slug 增/删 → generateRoutes() 产出 +page.marko 文件事件 →
//     markopack 内置 watchRoutes（监听 routesDir）re-walk——零新代码。
//   - 没有 Vite ws full-reload：浏览器需手动刷新（已知缺口，记入 perf 文档）。
//   - content.config.ts 在项目根、不在集合 watchDirs 内：ROOT 单独加一个非递归 watcher。
import { existsSync, mkdirSync, readdirSync, statSync, watch, type FSWatcher } from "node:fs";
import { join, resolve } from "node:path";
import { dev } from "@markopack/rspack";
import staticAdapter from "@markopack/adapter-static";
import type { ContentConfig } from "./content/index.ts";
import { CONFIG_FILE, ROOT, ensureSynced, resetSynced } from "./content.ts";
import { generateRoutes } from "./gen-routes.ts";
import { writeContentModules } from "./content-modules.ts";
import { assetOwners } from "./images.ts";
import { PAGES_DIR } from "./paths.ts";
import { enqueueContentSynced } from "./plugins.ts";
import { mpRspack, prepare } from "./rspack-shared.ts";

/** 队列任务：file = 单文件事件；full = config 变更的全量重建（覆盖同批文件事件） */
type Job =
  | { kind: "file"; type: "add" | "change" | "unlink"; file: string }
  | { kind: "full" };

const watchDirs = new Set<string>();
const watchers = new Set<FSWatcher>();
let queue: Array<Job> = [];
let draining = false;

await prepare();

// prepare 已装配；这里取 watchDirs（config 里 loader 声明的 base 目录）+ dev 关切（proxy）
const { config: initialConfig, dev: devOptions } = await ensureSynced();
for (const collection of Object.values(initialConfig.collections)) {
  for (const dir of collection.loader.watchDirs ?? []) watchDirs.add(resolve(dir));
}
// 用户自定义页目录（custom-pages §4.1）：mkdir 保证 watcher 有目录可盯（会话中途
// 新建 pages/ 无需重启）；事件在 drain 分流——pages/ 不是集合内容，不走 syncFile。
mkdirSync(PAGES_DIR, { recursive: true });
watchDirs.add(PAGES_DIR);

await dev({
  root: ROOT,
  routesDir: ".markopress/routes",
  entry: "./.markopress/entry.ts",
  adapter: staticAdapter(),
  rspack: mpRspack(),
  // 站点级 dev.proxy（config.dev 透传；Vite server.proxy 同形状——dev 期反代远端
  // API 绕开 CORS，build 不受影响）。markopack dev proxy 是未发版本地特性
  proxy: devOptions?.proxy,
});

startWatchers();
console.log(`[markopress] content watcher active: ${[...watchDirs].join(", ")}`);

function startWatchers(): void {
  for (const dir of watchDirs) watchTree(dir);
  // .markopress 目录（非递归，只看直接子项）：config.ts 变更触发全量重建。
  // 生成物写盘（sidebar.json/content.d.ts/entry.ts）也在这里产生事件——
  // 按文件名精确匹配过滤，成本忽略不计。不能盯单个文件：编辑器原子保存会
  // 替换 inode（fs.watch 文件级 wd 失明陷阱，见本文件头注）。
  watchers.add(
    watch(join(ROOT, ".markopress"), { recursive: false }, (_event, filename) => {
      if (typeof filename !== "string") return;
      if (resolve(ROOT, ".markopress", filename) === CONFIG_FILE) {
        resetSynced();
        enqueue({ kind: "full" });
      }
    }),
  );
}

/**
 * 按目录非递归 watch（目录级 wd 对子文件事件免疫 inode 替换）。
 *
 * 不能用 fs.watch(dir, {recursive:true})：Node 在 Linux 的实现是**逐文件** inotify
 * （外加每目录一个 wd）——sed -i / vim / 编辑器原子保存会替换文件 inode，旧 wd 立即
 * 失明且新 inode 无人监听，该文件从此静默丢失事件（2026-10-15 实测：sed -i 过的
 * about.md 不再触发，未动过 inode 的文件一切正常）。目录级 wd 只看 dirent 变化，
 * 与文件 inode 无关，改名/替换/新建全覆盖。子目录手工递归收编（新建目录事件到达时
 * 补 watch + 把目录下既有文件作为 add 事件入队，避免收编前的写入漏掉）。
 */
function watchTree(rootDir: string): void {
  const watched = new Set<string>();
  const adoptDir = (dir: string) => {
    if (watched.has(dir)) return;
    watched.add(dir);
    watchers.add(
      watch(dir, { recursive: false }, (event, filename) => {
        if (typeof filename !== "string") return;
        const file = resolve(dir, filename);
        let isDir = false;
        try {
          isDir = statSync(file).isDirectory();
        } catch {
          // 已删除或正在替换——按文件事件走（unlink 分支）
        }
        if (isDir) {
          adoptDir(file);
          enqueueDirFiles(file);
          return;
        }
        onContentEvent(dir, event, filename);
      }),
    );
  };
  const enqueueDirFiles = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) enqueueDirFiles(resolve(dir, entry.name));
      else enqueue({ kind: "file", type: "add", file: resolve(dir, entry.name) });
    }
  };
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop()!;
    adoptDir(dir);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) stack.push(resolve(dir, entry.name));
    }
  }
}

/** fs.watch 事件 → FileChangeEvent 映射：change 原样；rename 按存在性拆 add/unlink。 */
function onContentEvent(dir: string, event: string, filename: string): void {
  const file = resolve(dir, filename);
  const type = event === "change" ? "change" : existsSync(file) ? "add" : "unlink";
  enqueue({ kind: "file", type, file });
}

/** 用户自定义页文件判定（custom-pages §4.1）：pages/ 下的事件走包装 merge，不走内容 sync */
function isUserPageFile(file: string): boolean {
  return file === PAGES_DIR || file.startsWith(`${PAGES_DIR}/`) || file.startsWith(`${PAGES_DIR}\\`);
}

/** config 里新出现的 watchDirs 补进 watcher（config 编辑可能新增集合/base） */
function adoptWatchDirs(config: ContentConfig): void {
  for (const collection of Object.values(config.collections)) {
    for (const dir of collection.loader.watchDirs ?? []) {
      const abs = resolve(dir);
      if (!watchDirs.has(abs)) {
        watchDirs.add(abs);
        watchTree(abs);
      }
    }
  }
}

function enqueue(job: Job): void {
  queue.push(job);
  if (!draining) void drain();
}

async function drain(): Promise<void> {
  draining = true;
  try {
    while (queue.length) {
      const jobs = queue;
      queue = [];
      try {
        if (jobs.some((j) => j.kind === "full")) {
          await fullResync();
        } else {
          const changed: Array<{ collection: string; id: string }> = [];
          const removed: Array<{ collection: string; id: string }> = [];
          // 用户页事件分流（custom-pages §4.1）：pages/ 不是集合内容——不走 syncFile /
          // assetOwners；批末统一 generateRoutes 处理包装增删。改页面**内容**也是 no-op
          // 写入（包装只含 import 路径）——重编译归 Rspack 原生 watcher（包装 import
          // 用户真身，文件在编译图内）。
          let pagesTouched = false;
          for (const job of jobs) {
            if (job.kind !== "file") continue;
            if (isUserPageFile(job.file)) {
              pagesTouched = true;
              continue;
            }
            const outcome = await syncOne(job);
            changed.push(...outcome.changed);
            removed.push(...outcome.removed);
          }
          // 资产事件（图片文件，syncFile 不认领）→ 归属 entry 重渲染：资产 digest 折进
          // 有效 digest（content-modules.ts），vcontent 重写即原生 watcher 失效。
          // moduleChanged 专供内容模块重写；插件增量仍用 changed——纯资产变更不影响
          // 文本索引/RSS/sitemap，不必跑。
          const moduleChanged = [...changed];
          for (const job of jobs) {
            if (job.kind !== "file") continue;
            for (const owner of await assetOwners(job.file)) {
              if (!moduleChanged.some((c) => c.collection === owner.collection && c.id === owner.id)) {
                moduleChanged.push(owner);
              }
            }
          }
          if (moduleChanged.length + removed.length > 0 || pagesTouched) {
            // 先落内容模块再生成路由：新路由编译时 import 的文件必须已存在
            const modules = await writeContentModules({ changed: moduleChanged, removed });
            // slug 增/删才有 routes 文件事件；用户页增/删/改名 = 包装文件事件（模板不变
            // 则 write-if-changed 全跳过）
            await generateRoutes();
            // 插件增量（contentSynced：O(变更)，后台链；plugin-data 落盘走原生 watcher
            // 失效）。纯用户页变更不涉内容索引——changed/removed 为空即跳过。
            if (changed.length + removed.length > 0) {
              const { plugins, pluginCtx } = await ensureSynced();
              if (plugins.some((p) => p.contentSynced)) {
                void enqueueContentSynced(plugins, pluginCtx, { changed, removed });
              }
            }
            console.log(
              `[markopress] ${modules.written.length} content module(s) updated, ` +
                `${modules.removed.length} removed — refresh browser to see changes`,
            );
          }
        }
      } catch (error) {
        // 坏 frontmatter 等：报到终端，server 不死；修好文件自动恢复
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[markopress] content sync failed:\n${message}`);
      }
    }
  } finally {
    draining = false;
  }
}

/** 单文件增量（syncer 内部单飞排队）。结果交给 drain 落盘。 */
async function syncOne(job: Extract<Job, { kind: "file" }>) {
  const { config, syncer } = await ensureSynced();
  return syncer.syncFile(config, { type: job.type, path: job.file });
}

/** 全量重建（config 文件变更后）。resetSynced 已触发重装配（新 digest ⇒ store 全量重建）。 */
async function fullResync(): Promise<void> {
  const { config, pluginsReady } = await ensureSynced();
  adoptWatchDirs(config);
  await pluginsReady; // 新插件配置的数据产物先落盘，再让路由/模块重编译
  await writeContentModules();
  await generateRoutes();
  console.log("[markopress] full content resync done — refresh browser to see changes");
}

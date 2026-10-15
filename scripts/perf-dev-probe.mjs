#!/usr/bin/env node
// dev 性能探针：起 dev server 进程 → 计时全套交互探针 → 报告峰值 RSS → 收尾杀进程。
// 两后端共用（vite / rspack），探针只关心 HTTP 行为与文件系统夹具，不依赖后端实现。
//
// 用法：node scripts/perf-dev-probe.mjs --port 3100 --label vite -- <server cmd...>
//   --port     轮询端口（cmd 自行带对齐的端口参数/env）
//   --label    报告标签
//   --edit-slug / --add-id / --deep    夹具参数（默认 content-perf/doc-00000 等）
// 环境变量 PORT 也传给子进程（markopack dev 读它）。
import { appendFile, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const args = process.argv.slice(2);
const dash = args.indexOf("--");
const cmd = args.splice(dash); cmd.shift();
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const port = Number(opt("port", "3000"));
const label = opt("label", "dev");
const editSlug = opt("edit-slug", "doc-00000");
const editFile = opt("edit-file", `content-perf/${editSlug}.md`);
const deepRoute = opt("deep", "/doc-04999");
const addId = `probe-${Date.now()}`;
const addFile = `content-perf/${addId}.md`;
const TIMEOUT = Number(opt("timeout", "600000"));

const log = (m) => console.log(`[probe:${label}] ${m}`);
const now = () => Number(process.hrtime.bigint() / 1_000n) / 1000; // ms 浮点

async function get(path, expect) {
  const res = await fetch(`http://localhost:${port}${path}`, { redirect: "manual" }).catch(() => null);
  if (!res) return null;
  const body = res.status === expect ? await res.text() : null;
  return { status: res.status, body };
}

/** 轮询至谓词为真；返回耗时 ms。 */
async function until(desc, predicate, checkEvery = 100) {
  const t0 = now();
  const deadline = t0 + TIMEOUT;
  for (;;) {
    const r = await predicate();
    if (r) return now() - t0;
    if (now() > deadline) throw new Error(`timeout waiting: ${desc}`);
    await new Promise((r) => setTimeout(r, checkEvery));
  }
}

function hwm(pid) {
  // 遍历进程树取各节点 VmHWM 的最大值：命令可能经 pnpm/shell 包装，真身是子进程
  let max = 0;
  const seen = new Set();
  const visit = (p) => {
    if (seen.has(p)) return;
    seen.add(p);
    try {
      const status = readFileSync(`/proc/${p}/status`, "utf-8");
      max = Math.max(max, Number(/VmHWM:\s*(\d+) kB/.exec(status)?.[1] ?? 0));
      for (const child of readFileSync(`/proc/${p}/task/${p}/children`, "utf-8").trim().split(/\s+/)) {
        if (child) visit(Number(child));
      }
    } catch { /* 进程已退出 */ }
  };
  visit(pid);
  return max / 1e6;
}

const results = {};
const child = spawn(cmd[0], cmd.slice(1), {
  cwd: ROOT,
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
const kill = () => { try { child.kill("SIGTERM"); } catch {} };
process.on("exit", kill);
process.on("SIGINT", () => { kill(); process.exit(130); });

let booted = 0;
child.stdout.on("data", (d) => { booted += d.length; });
child.stderr.on("data", (d) => process.stderr.write(`[srv] ${d}`));
let done = false;
child.on("exit", (code) => { if (!done) { log(`server exited (${code})`); process.exit(code === null ? 1 : 0); } });

try {
  // 1. 启动 → 首字节（GET / 200）
  results["startup→GET / 200 (ms)"] = await until("GET / 200", async () => (await get("/", 200))?.status === 200);

  // 2. 深页冷编译
  const t0 = now();
  const deep = await get(deepRoute, 200);
  if (!deep) throw new Error(`deep route ${deepRoute} not 200`);
  results[`cold GET ${deepRoute} (ms)`] = now() - t0;

  // 3. md 编辑 → 页面反映
  const marker = `PROBE-EDIT-${Date.now()}`;
  await appendFile(resolve(ROOT, editFile), `\n\n${marker}\n`);
  results["md edit → visible (ms)"] = await until("edit visible", async () =>
    (await get(`/${editSlug}`, 200))?.body?.includes(marker) ?? false);

  // 4. 新增 md → 新路由 200
  await writeFile(resolve(ROOT, addFile),
    `---\ntitle: ${addId}\nslug: ${addId}\n---\n\n# ${addId}\n\nprobe add.\n`);
  results["md add → route 200 (ms)"] = await until("add 200", async () =>
    (await get(`/${addId}`, 200))?.status === 200);

  // 5. 删除 md → 404
  await rm(resolve(ROOT, addFile));
  results["md delete → 404 (ms)"] = await until("delete 404", async () => {
    const r = await get(`/${addId}`, 200);
    return r !== null && r.status !== 200; // 非 200 即算（路由已下线；连接拒绝不算）
  });

  results["server peak RSS (GB)"] = hwm(child.pid);
  results["server stdout bytes"] = booted;

  done = true;
  console.log(`\n===== ${label} (port ${port}) =====`);
  for (const [k, v] of Object.entries(results)) console.log(`${k}: ${typeof v === "number" ? Math.round(v * 10) / 10 : v}`);
} catch (err) {
  console.error(`[probe:${label}] FAILED: ${err.message}`);
  kill();
  process.exit(1);
} finally {
  await new Promise((r) => setTimeout(r, 300));
  kill();
  done = true;
}

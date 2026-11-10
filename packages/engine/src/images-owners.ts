// 图片资产归属层：entry 归属目录 / 资产 digest 折叠 / watcher 归属——ensureSynced
// 依赖三件套。与 ./images.ts（组件可 import 的叶子层）分家：server bundle 里
// `<mp-image>` 组件只拉叶子管线（sharp 经 rspack externals 运行时 require），
// 本文件的 content.ts 边把「内容层 + CLI 集群」挡在 bundle 外（dogfood 实测：
// 不分家则 cli.ts/rspack-dev.ts 等 29 个引擎模块进编译图，TLA/CJS 解析全炸）。
import { createHash } from "node:crypto";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import type { DataEntry } from "./content/index.ts";
import { ensureSynced } from "./content.ts";
import { fileDigest, IMAGE_EXTENSIONS, isImageFile } from "./images.ts";

// ── entry 归属目录 ────────────────────────────────────────────────────────────
// entry.filePath 相对 loader root（= watchDirs[0]，glob loader 的 base）。归属面 =
// entry 所在目录的整个子树：同目录图片（content/<slug>/index.md + 图）、slug 同名
// 子目录（content/<slug>.md + content/<slug>/*.png，blog 形态）、以及 img/ 等任意
// 深层旁挂目录（blockers #7：不递归则兄弟子目录资产改字节不级联失效该 entry）。
// 子树语义有意偏过度失效（兄弟 entry 的 slug 子目录也进本 entry 的折叠面）——
// 失效方向安全（多重渲染 vs 漏渲染），目录子树属该目录全部 entries 的语义也自洽。

/** entry 自身目录（src 相对解析基）。loader 未声明 base / 无 filePath 时 undefined。 */
function entryDirFor(base: string, entry: DataEntry): string | undefined {
  if (!entry.filePath) return undefined;
  return resolve(base, dirname(entry.filePath));
}

/** 目录子树全部目录（含自身；点前缀目录跳过）。资产 digest 折叠面与 watcher
 *  归属共用——两处必须同面，否则 watcher 事件映射不到 digest 已折叠的 entry。 */
export function subtreeDirs(root: string): Array<string> {
  const out = [root];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let dirents;
    try {
      dirents = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue; // 竞态删除——该目录跳过
    }
    for (const dirent of dirents) {
      if (!dirent.isDirectory() || dirent.name.startsWith(".")) continue;
      const sub = join(dir, dirent.name);
      out.push(sub);
      stack.push(sub);
    }
  }
  return out;
}

/** entry 归属目录（src 相对解析基 = entry 自身目录，不含子树）。 */
export async function resolveEntryDir(collection: string, entry: DataEntry): Promise<string | undefined> {
  const { config } = await ensureSynced();
  const base = config.collections[collection]?.loader.watchDirs?.[0];
  if (!base) return undefined;
  return entryDirFor(resolve(base), entry);
}

// ── 资产发现：digest 折叠 ─────────────────────────────────────────────────────

/** 目录下图片资产的折叠 digest（按文件名排序保证稳定）；无图片 = undefined */
const dirDigestCache = new Map<string, { signature: string; digest: string | undefined }>();

function dirAssetDigest(dir: string): string | undefined {
  if (!existsSync(dir)) return undefined;
  const names = readdirSync(dir).filter((name) => IMAGE_EXTENSIONS.has(extname(name).toLowerCase())).sort();
  const signature = names
    .map((name) => {
      try {
        const stat = statSync(join(dir, name));
        return `${name}:${stat.mtimeMs}:${stat.size}`;
      } catch {
        return `${name}:gone`;
      }
    })
    .join("|");
  const cached = dirDigestCache.get(dir);
  if (cached && cached.signature === signature) return cached.digest;
  const parts: Array<string> = [];
  for (const name of names) {
    const digest = fileDigest(join(dir, name));
    if (digest) parts.push(`${name}:${digest}`);
  }
  const digest = parts.length ? createHash("sha1").update(parts.join("|")).digest("hex") : undefined;
  dirDigestCache.set(dir, { signature, digest });
  return digest;
}

/** entry 旁挂资产 digest（归属子树各目录取并集后折叠）。无资产 = undefined（有效 digest 不折叠）。 */
export async function entryAssetDigest(collection: string, entry: DataEntry): Promise<string | undefined> {
  const { config } = await ensureSynced();
  const base = config.collections[collection]?.loader.watchDirs?.[0];
  if (!base || !entry.filePath) return undefined;
  const dir = entryDirFor(resolve(base), entry);
  if (!dir) return undefined;
  const digests = subtreeDirs(dir)
    .map(dirAssetDigest)
    .filter((d): d is string => d !== undefined);
  if (digests.length === 0) return undefined;
  if (digests.length === 1) return digests[0];
  return createHash("sha1").update(digests.join("|")).digest("hex");
}

/** watcher：资产文件 → 归属 entries（entry 目录子树内）。O(entries × 子树)，资产事件低频，够用。 */
export async function assetOwners(file: string): Promise<Array<{ collection: string; id: string }>> {
  if (!isImageFile(file)) return [];
  const { store, config } = await ensureSynced();
  const assetDir = dirname(file);
  const owners: Array<{ collection: string; id: string }> = [];
  for (const [name, collection] of Object.entries(config.collections)) {
    const base = collection.loader.watchDirs?.[0];
    if (!base) continue;
    for (const entry of store.values(name)) {
      const dir = entryDirFor(resolve(base), entry);
      if (dir && subtreeDirs(dir).includes(assetDir)) {
        owners.push({ collection: name, id: entry.id });
      }
    }
  }
  return owners;
}

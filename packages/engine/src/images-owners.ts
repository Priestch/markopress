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
// entry.filePath 相对 loader root（= watchDirs[0]，glob loader 的 base）。两种布局：
//   content/<slug>/index.md + 同目录图片        → entryDir 本身
//   content/<slug>.md + content/<slug>/*.png   → entryDir/<去扩展名 basename>（blog 形态）

function entryStem(entry: DataEntry): string {
  return (entry.filePath ?? "").replace(/\.[^./]*$/, "").split("/").at(-1) ?? "";
}

function entryDirsFor(base: string, entry: DataEntry): Array<string> {
  if (!entry.filePath) return [];
  const dir = resolve(base, dirname(entry.filePath));
  const slugDir = resolve(dir, entryStem(entry));
  return slugDir === dir ? [dir] : [dir, slugDir];
}

/** entry 归属目录（src 相对解析与资产扫描共用）。loader 未声明 base / 无 filePath 时 undefined。 */
export async function resolveEntryDir(collection: string, entry: DataEntry): Promise<string | undefined> {
  const { config } = await ensureSynced();
  const base = config.collections[collection]?.loader.watchDirs?.[0];
  if (!base) return undefined;
  return entryDirsFor(resolve(base), entry)[0];
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

/** entry 旁挂资产 digest（两个归属目录取并集后折叠）。无资产 = undefined（有效 digest 不折叠）。 */
export async function entryAssetDigest(collection: string, entry: DataEntry): Promise<string | undefined> {
  const { config } = await ensureSynced();
  const base = config.collections[collection]?.loader.watchDirs?.[0];
  if (!base || !entry.filePath) return undefined;
  const digests = entryDirsFor(resolve(base), entry)
    .map(dirAssetDigest)
    .filter((d): d is string => d !== undefined);
  if (digests.length === 0) return undefined;
  if (digests.length === 1) return digests[0];
  return createHash("sha1").update(digests.join("|")).digest("hex");
}

/** watcher：资产文件 → 归属 entries（同目录或同名子目录）。O(entries)，资产事件低频，够用。 */
export async function assetOwners(file: string): Promise<Array<{ collection: string; id: string }>> {
  if (!isImageFile(file)) return [];
  const { store, config } = await ensureSynced();
  const assetDir = dirname(file);
  const owners: Array<{ collection: string; id: string }> = [];
  for (const [name, collection] of Object.entries(config.collections)) {
    const base = collection.loader.watchDirs?.[0];
    if (!base) continue;
    for (const entry of store.values(name)) {
      if (entryDirsFor(resolve(base), entry).some((dir) => dir === assetDir)) {
        owners.push({ collection: name, id: entry.id });
      }
    }
  }
  return owners;
}

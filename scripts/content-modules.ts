// 内容模块产出端 —— 「virtual:mp/content/…」的模块源码唯一来源，双后端共用：
//
//   Vite  路径：markopress-plugin.ts 的 load() 调 renderContentModule，走内存虚拟模块；
//   Rspack 路径：writeContentModules 落盘 .markopress/vcontent/<collection>/<id>.js 真实文件，
//               经 NormalModuleReplacementPlugin 重写解析（scripts/rspack-shared.ts），失效走
//               Rspack 原生 watcher（文件在编译图 fileDependencies 内，改写即重编译）。
//
// Rspack 侧不维持 Vite 式惰性渲染：冷启动是全图编译（所有页面都是 router 的入口模板），
// 渲染迟早都要发生；真实文件因此是最简正确解（无需自管 VirtualModulesPlugin 双实例）。
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getGenerateDigest, type DataEntry } from "@markopress/content";
import type { MarkdownRenderer } from "@markopress/markdown";
import { ensureSynced, ROOT } from "./content.ts";
import { entryAssetDigest, extractImageTags, resolveEntryDir, resolveImageSegments } from "./images.ts";

export const VCONTENT_DIR = join(ROOT, ".markopress", "vcontent");

/** entry → 内容模块绝对路径：id 含 `/` 时嵌套目录（a/b → vcontent/<c>/a/b.js） */
export function contentModuleFile(collection: string, id: string): string {
  return join(VCONTENT_DIR, collection, `${id}.js`);
}

// ── 页面级插件钩子的缓存（docs/plugin-design.md §2：按 entry digest × 插件链）──

/** 变换链缓存：digest(entry.digest + 链标识) → 变换后 body。变换是纯函数 ⇒ 可缓存 */
const transformCache = new Map<string, string>();
/** pageData 缓存：有效 digest → 各插件合并结果（链变了 digest 随之失配，天然失效） */
const pageDataCache = new Map<string, Record<string, unknown>>();

/** 渲染虚拟模块源码：data / segments / headings 三导出。JSON 序列化：Date 等富类型退化为字符串（够用）。 */
export async function renderContentModule(
  collection: string,
  entry: DataEntry,
  renderer: MarkdownRenderer,
): Promise<string> {
  if (entry.contentType !== "text/markdown" || entry.body === undefined) {
    throw new Error(
      `[markopress] no renderer for contentType ${String(entry.contentType)} ("${entry.id}")`,
    );
  }
  const { plugins, pluginCtx } = await ensureSynced();
  const generateDigest = await getGenerateDigest();

  // 有效 digest 的两级折叠（渲染器/transformBody/pageData 三处缓存共用的失效键）：
  //   资产 digest —— 旁挂图片内容变化（md 未动）也要重渲染，否则 srcset/blur 过期
  //   变换链 id  —— 原始与变换后的渲染缓存互不污染（纯函数 ⇒ 同键必同值）
  let body = entry.body;
  let effectiveDigest = entry.digest ?? entry.id;
  const assetDigest = await entryAssetDigest(collection, entry);
  if (assetDigest) effectiveDigest = generateDigest(`${effectiveDigest}::assets:${assetDigest}`);
  const transformers = plugins.filter((p) => p.transformBody);
  if (transformers.length) {
    const chainId = transformers.map((p) => p.name).join("|");
    effectiveDigest = generateDigest(`${effectiveDigest}::${chainId}`);
    const cached = transformCache.get(effectiveDigest);
    if (cached !== undefined) {
      body = cached;
    } else {
      for (const plugin of transformers) {
        body = await plugin.transformBody!(body, entry, pluginCtx);
      }
      transformCache.set(effectiveDigest, body);
    }
  }

  // <image> 块级预提取 → 渲染 → 解析回填（scripts/images.ts；占位符是 HTML 注释，
  // remark 原样透传，解析失败的标签回填原文=透传，与未接管线行为一致）
  const { tags, body: withPlaceholders } = extractImageTags(body);
  const { segments, headings } = await renderer.render({
    digest: effectiveDigest,
    body: withPlaceholders,
  });
  if (tags.length) {
    const entryDir = await resolveEntryDir(collection, entry);
    if (entryDir) await resolveImageSegments(segments, tags, entryDir);
  }

  // pageData 合并（浅合并进 data 导出；同名键后者覆盖——插件自己起好名字）
  let data = entry.data as Record<string, unknown>;
  const dataPlugins = plugins.filter((p) => p.pageData);
  if (dataPlugins.length) {
    let bucket = pageDataCache.get(effectiveDigest);
    if (!bucket) {
      bucket = {};
      for (const plugin of dataPlugins) {
        Object.assign(bucket, await plugin.pageData!(entry, pluginCtx));
      }
      pageDataCache.set(effectiveDigest, bucket);
    }
    data = { ...entry.data, ...bucket };
  }

  return [
    `export const data = ${JSON.stringify(data)}`,
    `export const segments = ${JSON.stringify(segments)}`,
    `export const headings = ${JSON.stringify(headings)}`,
    ``,
  ].join("\n");
}

export interface ContentModulesResult {
  written: Array<string>;
  removed: Array<string>;
}

function writeIfChanged(file: string, content: string, result: ContentModulesResult): void {
  if (existsSync(file) && readFileSync(file, "utf-8") === content) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  result.written.push(file);
}

/** 递归清掉 expected 之外的孤儿文件（md 删除/改名后的差集；空目录留下无害） */
function cleanStale(dir: string, expected: Set<string>, result: ContentModulesResult): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) cleanStale(full, expected, result);
    else if (!expected.has(full)) {
      rmSync(full);
      result.removed.push(full);
    }
  }
}

/**
 * 落盘内容模块。
 *   scope 省略   —— 全量 + 孤儿清理（启动 / config 变更后的全量重建）。
 *   scope 给定   —— 只重写 changed、删除 removed（md 编辑批次的增量路径，O(事件数)）。
 */
export async function writeContentModules(scope?: {
  changed?: Array<{ collection: string; id: string }>;
  removed?: Array<{ collection: string; id: string }>;
}): Promise<ContentModulesResult> {
  const { store, config, renderer } = await ensureSynced();
  const result: ContentModulesResult = { written: [], removed: [] };

  if (scope) {
    for (const { collection, id } of scope.changed ?? []) {
      const entry = store.get(collection, id);
      if (!entry) continue; // 已被同批 removed 或撞车清理
      writeIfChanged(contentModuleFile(collection, id), await renderContentModule(collection, entry, renderer), result);
    }
    for (const { collection, id } of scope.removed ?? []) {
      const file = contentModuleFile(collection, id);
      if (existsSync(file)) {
        rmSync(file);
        result.removed.push(file);
      }
    }
    return result;
  }

  const expected = new Set<string>();
  for (const name of Object.keys(config.collections)) {
    for (const entry of store.values(name)) {
      const file = contentModuleFile(name, entry.id);
      expected.add(file);
      writeIfChanged(file, await renderContentModule(name, entry as DataEntry, renderer), result);
    }
  }
  cleanStale(VCONTENT_DIR, expected, result);
  return result;
}

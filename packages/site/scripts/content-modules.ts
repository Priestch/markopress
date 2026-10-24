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
import {
  SEGMENT_PREFIX,
  VSEG_DIR,
  extractComponentTags,
  removeSegmentFiles,
  splitSegments,
  writeSegmentFiles,
} from "./segments.ts";

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

/** 渲染产物：source = 模块源码；segFiles = 本 entry 的组件段文件（已落盘，供差集清理） */
export interface RenderedModule {
  source: string;
  segFiles: Array<string>;
}

/** 渲染虚拟模块源码：data / segments / headings 三导出。无组件段时 segments 是纯 JSON（逐字节与历史形态一致）。 */
export async function renderContentModule(
  collection: string,
  entry: DataEntry,
  renderer: MarkdownRenderer,
): Promise<RenderedModule> {
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

  // 段提取两级：组件 tag（白名单，占位符是段边界）→ <image>（占位符在 html 段内原位回填）。
  // 两个提取器互不冲突：组件白名单不含 image，image 正则只认 <image 前缀。
  const { tags: componentTags, body: withoutComponents } = extractComponentTags(body);
  const { tags, body: withPlaceholders } = extractImageTags(withoutComponents);
  // 渲染 digest 加命名空间：pluginCtx.render（搜索等插件，原始 body）与本处（提取后
  // body）不能共用缓存键——否则先跑的插件渲染会以同 digest 污染缓存，模块渲染命中
  // 未提取的 html（token 消失、<tag/> 原样透传）。blog spike 期没暴露：posts 不在搜索集合。
  const rendered = await renderer.render({
    digest: `${effectiveDigest}::extracted`,
    body: withPlaceholders,
  });
  const joinedHtml = rendered.segments.map((s) => s.html).join("");
  const segments = splitSegments(
    joinedHtml,
    componentTags,
  );
  if (tags.length) {
    const entryDir = await resolveEntryDir(collection, entry);
    if (entryDir) await resolveImageSegments(segments, tags, entryDir);
  }
  const segFiles = writeSegmentFiles(collection, entry.id, componentTags);

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

  // 无组件段：纯 JSON 导出（与历史形态逐字节一致——存量内容零扰动）；
  // 有组件段：import 真实 .marko 文件 + 组件引用注入。
  // import 指定符 = SEGMENT_PREFIX + collection + "/" + id + "/" + n（路径即结构，两侧解析不拆参）
  const source =
    componentTags.length === 0
      ? [
          `export const data = ${JSON.stringify(data)}`,
          `export const segments = ${JSON.stringify(segments)}`,
          `export const headings = ${JSON.stringify(rendered.headings)}`,
          ``,
        ].join("\n")
      : [
          componentTags
            .map((_, i) => `import seg${i} from "${SEGMENT_PREFIX}${collection}/${entry.id}/${i}";`)
            .join("\n"),
          `export const data = ${JSON.stringify(data)}`,
          `export const segments = [\n${segments
            .map((s) =>
              s.type === "html"
                ? JSON.stringify({ type: "html", html: s.html })
                : `{ "type": "component", "component": seg${s.index} }`,
            )
            .join(",\n")}\n]`,
          `export const headings = ${JSON.stringify(rendered.headings)}`,
          ``,
        ].join("\n");
  return { source, segFiles };
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
      const { source } = await renderContentModule(collection, entry, renderer);
      writeIfChanged(contentModuleFile(collection, id), source, result);
    }
    for (const { collection, id } of scope.removed ?? []) {
      const file = contentModuleFile(collection, id);
      if (existsSync(file)) {
        rmSync(file);
        result.removed.push(file);
      }
      removeSegmentFiles(collection, id);
    }
    return result;
  }

  const expected = new Set<string>();
  for (const name of Object.keys(config.collections)) {
    for (const entry of store.values(name)) {
      const file = contentModuleFile(name, entry.id);
      const { source, segFiles } = await renderContentModule(name, entry as DataEntry, renderer);
      expected.add(file);
      for (const seg of segFiles) expected.add(seg);
      writeIfChanged(file, source, result);
    }
  }
  cleanStale(VCONTENT_DIR, expected, result);
  cleanStale(VSEG_DIR, expected, result);
  return result;
}

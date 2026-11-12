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
import { getGenerateDigest, type DataEntry } from "./content/index.ts";
import type { MarkdownRenderer } from "./markdown/index.ts";
import { ensureSynced, ROOT } from "./content.ts";
import { extractImageTags, resolveImageSegments } from "./images.ts";
import { entryAssetDigest, resolveEntryDir } from "./images-owners.ts";
import {
  SEGMENT_PREFIX,
  VSEG_DIR,
  extractComponentTags,
  removeSegmentFiles,
  splitSegments,
  writeSegmentFiles,
} from "./segments.ts";

export const VCONTENT_DIR = join(ROOT, ".markopress", "vcontent");
/** 集合级数据模块（virtual:mp/collection/<name>）的落盘目录——独立于 vcontent/：
 *  entry id "index" 会占用 vcontent/<c>/index.js，撞名 */
export const VCOLLECTION_DIR = join(ROOT, ".markopress", "vcollection");
export const COLLECTION_PREFIX = "virtual:mp/collection/";
/**
 * per-entry 元数据模块（virtual:mp/meta/<c>/<id>）落盘目录：client-safe 面，只含
 * data/headings。集合模块聚合本目录（而非 vcontent/）——html 正文是 SSR 渲染载荷，
 * 经集合模块进任何会被水合的组件（如 nav）就会整集合烤进浏览器共享 chunk
 * （resumability 下客户端永远不读它，纯死重；pdflux 反馈 2026-11）。服务端要正文
 * 直接 import per-entry 模块（virtual:mp/content/…），静态消费被 Marko 剪枝同样不进 client。
 */
export const VMETA_DIR = join(ROOT, ".markopress", "vmeta");
export const META_PREFIX = "virtual:mp/meta/";

/** entry → 内容模块绝对路径：id 含 `/` 时嵌套目录（a/b → vcontent/<c>/a/b.js） */
export function contentModuleFile(collection: string, id: string): string {
  return join(VCONTENT_DIR, collection, `${id}.js`);
}

/** entry → 元数据模块绝对路径（与 contentModuleFile 同构） */
export function contentMetaFile(collection: string, id: string): string {
  return join(VMETA_DIR, collection, `${id}.js`);
}

/** 集合 → 集合级数据模块绝对路径（vcollection/<name>.js） */
export function collectionModuleFile(collection: string): string {
  return join(VCOLLECTION_DIR, `${collection}.js`);
}

/**
 * 渲染集合级数据模块源码（双后端唯一来源）：静态 import 全部 per-entry **meta** 模块 +
 * 导出 entries 数组（{ id, slug, data, headings } 每条；排序/投影由消费方做）。
 * 只聚合 meta（client-safe）——集合模块的典型消费方是 nav 等会被水合的组件，聚合
 * vcontent 会把全集合 html 正文烤进浏览器共享 chunk（见 VMETA_DIR 注释）。渲染缓存
 * 各自按 entry digest 生效，集合模块零渲染成本。增删条目 ⇒ 本模块源码变 ⇒ vite 侧
 * 失效 / rspack 侧落盘重写走原生 watcher；纯内容编辑 ⇒ per-entry meta 模块变化沿
 * 模块图/编译图传播，本模块源不变（字节不变）。
 */
export function renderCollectionModule(collection: string, entries: Array<DataEntry>): string {
  if (entries.length === 0) {
    return [
      `// 集合级数据模块（生成物）：virtual:mp/collection/${collection}`,
      `export const entries = []`,
      ``,
    ].join("\n");
  }
  return [
    `// 集合级数据模块（生成物）：virtual:mp/collection/${collection}`,
    // client-safe：只聚合 meta 模块（data/headings）；正文经 per-entry 模块（SSR 渲染链）
    ...entries.map(
      (entry, i) =>
        `import { data as data${i}, headings as headings${i} } from "${META_PREFIX}${collection}/${entry.id}";`,
    ),
    `export const entries = [`,
    ...entries.map(
      (entry, i) =>
        `  { id: ${JSON.stringify(entry.id)}, slug: ${JSON.stringify(entry.slug)}, data: data${i}, headings: headings${i} },`,
    ),
    `]`,
    ``,
  ].join("\n");
}

// ── 页面级插件钩子的缓存（docs/plugin-design.md §2：按 entry digest × 插件链）──

/** 变换链缓存：digest(entry.digest + 链标识) → 变换后 body。变换是纯函数 ⇒ 可缓存 */
const transformCache = new Map<string, string>();
/** pageData 缓存：有效 digest → 各插件合并结果（链变了 digest 随之失配，天然失效） */
const pageDataCache = new Map<string, Record<string, unknown>>();

/** 渲染产物：source = 模块源码；metaSource = 元数据模块源码（client-safe，集合模块聚合面）；
 *  segFiles = 本 entry 的组件段文件（已落盘，供差集清理） */
export interface RenderedModule {
  source: string;
  metaSource: string;
  segFiles: Array<string>;
}

/** 渲染虚拟模块源码：data / segments / headings 三导出。无组件段时 segments 是纯 JSON（逐字节与历史形态一致）。 */
export async function renderContentModule(
  collection: string,
  entry: DataEntry,
  renderer: MarkdownRenderer,
): Promise<RenderedModule> {
  if (entry.body !== undefined && entry.contentType !== "text/markdown") {
    throw new Error(
      `[markopress] no renderer for contentType ${String(entry.contentType)} ("${entry.id}")`,
    );
  }
  if (entry.body === undefined) {
    // 纯数据 entry（契约：body 可选——REST 元数据集合如分类表）。无渲染对象：
    // segments/headings 为空，data 照常（pageData 插件链仍跑，需要 body 的插件自行判空）。
    const { plugins, pluginCtx } = await ensureSynced();
    let data = entry.data as Record<string, unknown>;
    const dataPlugins = plugins.filter((p) => p.pageData);
    if (dataPlugins.length) {
      const bucket: Record<string, unknown> = {};
      for (const plugin of dataPlugins) {
        Object.assign(bucket, await plugin.pageData!(entry, pluginCtx));
      }
      data = { ...entry.data, ...bucket };
    }
    const source = [
      `export const data = ${JSON.stringify(data)}`,
      `export const segments = []`,
      `export const headings = []`,
      ``,
    ].join("\n");
    return { source, metaSource: source, segFiles: [] };
  }
  const { plugins, pluginCtx, images } = await ensureSynced();
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

  // 段提取两级：组件 tag（白名单，占位符是段边界）→ <mp-image> tag / md ![]() 接管
  // （opt-in，images.markdown——boolean 走管线常量，对象形并入站点级默认属性；
  // 占位符在 html 段内原位回填，独占段落时连 <p> 一起换）。两个提取器互不冲突：
  // 组件白名单不含 image，image 正则只认 <mp-image 前缀与独立段落图片语法。
  const { tags: componentTags, body: withoutComponents } = extractComponentTags(body);
  const { tags, body: withPlaceholders } = extractImageTags(withoutComponents, { markdown: images.markdown });
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
    // entryDir 可为 undefined（strapi 集合无 filePath / loader 无 base）——远程图解析
    // 不依赖目录，本地图此时只认 / 根路径
    const entryDir = await resolveEntryDir(collection, entry);
    await resolveImageSegments(segments, tags, entryDir, images);
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
  // meta 模块（virtual:mp/meta/<c>/<id>）：data/headings 的 client-safe 投影——
  // 无 html、无组件段引用（rspack 侧落盘 vmeta/，vite 侧 load 时取本字段）
  const metaSource = [
    `export const data = ${JSON.stringify(data)}`,
    `export const headings = ${JSON.stringify(rendered.headings)}`,
    ``,
  ].join("\n");
  return { source, metaSource, segFiles };
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
      const { source, metaSource } = await renderContentModule(collection, entry, renderer);
      writeIfChanged(contentModuleFile(collection, id), source, result);
      writeIfChanged(contentMetaFile(collection, id), metaSource, result);
    }
    for (const { collection, id } of scope.removed ?? []) {
      const file = contentModuleFile(collection, id);
      if (existsSync(file)) {
        rmSync(file);
        result.removed.push(file);
      }
      const metaFile = contentMetaFile(collection, id);
      if (existsSync(metaFile)) {
        rmSync(metaFile);
        result.removed.push(metaFile);
      }
      removeSegmentFiles(collection, id);
    }
    // 集合级数据模块：本批触及的集合各重写一次（条目集/内容都可能变了——源码只含
    // id/slug 引用，纯内容编辑下字节不变，write-if-changed 吸收）
    const touched = new Set<string>();
    for (const { collection } of [...(scope.changed ?? []), ...(scope.removed ?? [])]) {
      touched.add(collection);
    }
    for (const collection of touched) {
      writeIfChanged(
        collectionModuleFile(collection),
        renderCollectionModule(collection, store.values(collection)),
        result,
      );
    }
    return result;
  }

  const expected = new Set<string>();
  for (const name of Object.keys(config.collections)) {
    for (const entry of store.values(name)) {
      const file = contentModuleFile(name, entry.id);
      const { source, metaSource, segFiles } = await renderContentModule(name, entry as DataEntry, renderer);
      expected.add(file);
      expected.add(contentMetaFile(name, entry.id));
      for (const seg of segFiles) expected.add(seg);
      writeIfChanged(file, source, result);
      writeIfChanged(contentMetaFile(name, entry.id), metaSource, result);
    }
    // 集合级数据模块：每个配置集合一个（空集合也是 entries = []——消费方拿到稳定形状）
    const collectionFile = collectionModuleFile(name);
    expected.add(collectionFile);
    writeIfChanged(collectionFile, renderCollectionModule(name, store.values(name)), result);
  }
  cleanStale(VCONTENT_DIR, expected, result);
  cleanStale(VMETA_DIR, expected, result);
  cleanStale(VSEG_DIR, expected, result);
  cleanStale(VCOLLECTION_DIR, expected, result);
  return result;
}

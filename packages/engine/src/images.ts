// 资产管线 v2（app 共享层，两后端共用）—— co-located 与授权远程图的发现、解析与响应式输出。
// 设计定稿：docs/images-v2-design.md（T1+T2；md ![]() 接管 opt-in、<mp-image> Marko 组件、
// AVIF/<picture>、densities、远程缓存 HTTP 语义）。参照系 Astro images / gatsby-plugin-image。
//
// 设计对齐（2026-10-19 v1，v2 保持）：不进 store、不进核心包（packages/content/AGENTS.md
// 「不做图片服务」+ sharp 依赖红线，audit 测试锁死）。整体活在 app 层：
//   发现：渲染时按 entry 归属目录扫旁挂图片（mtime/size stat 缓存，内容 digest 只算一次）；
//         远程图按授权面（domains/remotePatterns）fetch + 缓存（§远程）
//   失效：资产 digest 折进 entry 有效 digest（renderContentModule）⇒ 渲染缓存 /
//         transformBody / pageData / vcontent 落盘全级联；watcher 事件 → assetOwners
//         （同目录或同名子目录）→ 重渲染归属 entry；远程字节变化 → 新 contentSha →
//         resolveCache 换键 → 新 html 落 vcontent（无 watcher 事件，消费时重验驱动）
//   产物：public/_markopress/image/<源内容 sha1 前8>/ 内容寻址（同图去重、改名复用）；
//         vite 路径原生服务 publicDir，rspack 路径靠 markopack dev sirv 链 +
//         adapter-static buildEnd 拷贝（本仓库配套落地）
//
// 默认行为 = v1 逐字节兼容：formats 缺省 ["webp"] 单格式 <img srcset>、densities 缺省
// v1 梯、placeholder 缺省 blur、md ![]() 接管默认关——老站点不配 images 键则产物不变。
// v2 边界（刻意不做）：art direction / traced SVG / JS 行为 / frontmatter image() helper /
// transformOptions / CDN image service。
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync, readdirSync, copyFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import sharp from "sharp";
import { ROOT } from "./paths.ts";
import type { ImagesMarkdownDefaults, ImagesSettings } from "./plugins.ts";

/** 发现集合：参与归属/失效扫描的全部图片后缀 */
export const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"]);
/** 光栅集合：做变体 + blur；gif/svg 只拷贝原图（gif 动帧、svg 矢量） */
const RASTER_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);
const OUTPUT_URL_PREFIX = "/_markopress/image";
const OUTPUT_DIR = join(ROOT, "public", OUTPUT_URL_PREFIX);
const DEFAULT_QUALITY = 80;
/** 响应式梯（旧版 0.0.24 同款） */
const WIDTH_LADDER = [320, 480, 640, 768, 960, 1280, 1536, 1920];

// ── 远程图（v2 §3）：授权面 + 缓存 + HTTP 语义重验 ─────────────────────────────

/** 远程原图缓存（gitignore 生成区：.markopress/* 通配已盖住） */
const REMOTE_CACHE_DIR = join(ROOT, ".markopress", "cache", "images");
/** 响应无 Cache-Control 时的启发式新鲜度（Strapi uploads 默认不带缓存头——严格 HTTP
 *  语义会让每次构建全量打 CMS；构建工具的务实裁量，设计稿 §3 偏差点） */
const REMOTE_HEURISTIC_FRESHNESS_MS = 24 * 60 * 60 * 1000;
/** 新鲜度判定 memo：同 URL 60s 内不重复探测（dev 逐请求渲染不放大网络面） */
const REMOTE_FRESHNESS_MEMO_MS = 60_000;
const REMOTE_TIMEOUT_MS = 30_000;
const REMOTE_ATTEMPTS = 3;
const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

interface RemoteCacheMeta {
  url: string;
  etag?: string;
  lastModified?: string;
  cacheControl?: string;
  fetchedAt: number;
  contentType: string;
  contentSha: string;
  ext: string;
}

export interface RemoteSource {
  buffer: Buffer;
  ext: string;
  contentSha: string;
  contentType: string;
}

export function isRemoteSrc(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

/** `*.example.com` 匹配任意深度子域、不含裸域（Astro remotePatterns 同语义） */
function hostMatches(host: string, pattern: string): boolean {
  if (!pattern.includes("*")) return host === pattern;
  const suffix = `.${pattern.replace(/^\*+\.?/, "")}`;
  return host.endsWith(suffix) && host.length > suffix.length;
}

/**
 * 远程图授权判定（fetch 前的 SSRF 防线）。未授权 = 不 fetch 不优化，直通原始 URL。
 * 私网 IP 段不额外拦截（构建工具、授权面由管理员自配——接受 DNS rebinding 残留风险，
 * 设计稿 §3 注记）。
 */
export function isAuthorizedRemote(src: string, settings: ImagesSettings): boolean {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (settings.domains.has(url.hostname)) return true;
  return settings.remotePatterns.some(
    (p) =>
      (!p.protocol || url.protocol.replace(/:$/, "") === p.protocol) &&
      (!p.hostname || hostMatches(url.hostname, p.hostname)),
  );
}

/** max-age 内 = 新鲜；无 Cache-Control 走 24h 启发式（见常量注） */
function freshUntil(meta: RemoteCacheMeta): number {
  const maxAge = /(?:^|,)\s*max-age=(\d+)/i.exec(meta.cacheControl ?? "");
  const ttl = maxAge ? Number(maxAge[1]) * 1000 : REMOTE_HEURISTIC_FRESHNESS_MS;
  return meta.fetchedAt + ttl;
}

/** 5xx/网络错误/超时重试（3 次、300ms 间隔）；4xx 等立即失败 */
async function fetchWithRetry(url: string, headers?: Record<string, string>): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= REMOTE_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS),
        redirect: "follow",
      });
      if (response.ok || response.status === 304) return response;
      if (response.status >= 500 && attempt < REMOTE_ATTEMPTS) {
        lastError = new Error(`HTTP ${response.status}`);
      } else {
        throw new Error(`[markopress] remote image ${url} → HTTP ${response.status}`);
      }
    } catch (error) {
      lastError = error;
      // 自抛的 [markopress] 前缀错误（4xx/类型不支持）不可重试
      if (error instanceof Error && error.message.startsWith("[markopress]")) throw error;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function extFor(url: URL, contentType: string): string {
  const mime = contentType.split(";")[0].trim().toLowerCase();
  const byMime = MIME_EXT[mime];
  if (byMime) return byMime;
  // content-type 缺省或通用二进制：信 URL 扩展名（CMS 常见——上传路径带后缀、
  // 响应头却是 application/octet-stream）
  const ambiguous = !mime || mime === "application/octet-stream";
  if (ambiguous) {
    const byPath = extname(url.pathname).toLowerCase();
    if (IMAGE_EXTENSIONS.has(byPath)) return byPath;
    if (!mime) throw new Error(`[markopress] remote image ${url.href} 无 content-type 且 URL 无图片扩展名`);
  }
  throw new Error(`[markopress] remote image ${url.href} 不支持的类型（${contentType || "unknown"}）`);
}

interface CachedRemote {
  meta: RemoteCacheMeta;
  file: string;
}

function readRemoteCache(url: string): CachedRemote | undefined {
  const metaFile = join(REMOTE_CACHE_DIR, remoteKey(url), "meta.json");
  if (!existsSync(metaFile)) return undefined;
  try {
    const meta = JSON.parse(readFileSync(metaFile, "utf-8")) as RemoteCacheMeta;
    const file = join(REMOTE_CACHE_DIR, remoteKey(url), `source${meta.ext}`);
    if (!existsSync(file) || !meta.contentSha) return undefined;
    return { meta, file };
  } catch {
    return undefined;
  }
}

function remoteKey(url: string): string {
  return createHash("sha1").update(url).digest("hex");
}

function writeRemoteMeta(url: string, meta: RemoteCacheMeta): void {
  const dir = join(REMOTE_CACHE_DIR, remoteKey(url));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
}

function writeRemoteBytes(url: string, meta: RemoteCacheMeta, buffer: Buffer): void {
  const dir = join(REMOTE_CACHE_DIR, remoteKey(url));
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `source${meta.ext}`);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, buffer);
  renameSync(tmp, file);
  writeRemoteMeta(url, meta);
}

async function absorbRemoteResponse(url: string, response: Response): Promise<RemoteSource> {
  const contentType = response.headers.get("content-type") ?? "";
  const ext = extFor(new URL(url), contentType);
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentSha = createHash("sha1").update(buffer).digest("hex");
  writeRemoteBytes(
    url,
    {
      url,
      etag: response.headers.get("etag") ?? undefined,
      lastModified: response.headers.get("last-modified") ?? undefined,
      cacheControl: response.headers.get("cache-control") ?? undefined,
      fetchedAt: Date.now(),
      contentType,
      contentSha,
      ext,
    },
    buffer,
  );
  return { buffer, ext, contentSha, contentType };
}

const remoteMemo = new Map<string, { at: number; promise: Promise<RemoteSource> }>();

/**
 * 远程图获取（带缓存 + HTTP 语义重验，Astro 5.1 模型）：
 *   新鲜（max-age / 24h 启发式）→ 零请求；过期 + 验证器 → 条件请求（304 复用 / 200 替换）；
 *   过期无验证器 → 重拉；重验网络失败 + 有缓存 → warn + 陈旧降级（CMS 抖动不炸构建）；
 *   无缓存可降 → throw（build 期硬失败由调用方传播，dev 期 warn + 直通）。
 * 60s 新鲜度 memo + 失败即除名：同 URL 并发/密集渲染共享一次探测，恢复后无需重启。
 */
export function fetchRemoteCached(url: string): Promise<RemoteSource> {
  const memo = remoteMemo.get(url);
  if (memo && Date.now() - memo.at < REMOTE_FRESHNESS_MEMO_MS) return memo.promise;
  const promise = (async (): Promise<RemoteSource> => {
    const cached = readRemoteCache(url);
    if (!cached) return absorbRemoteResponse(url, await fetchWithRetry(url));
    const fromCache = (): RemoteSource => ({
      buffer: readFileSync(cached.file),
      ext: cached.meta.ext,
      contentSha: cached.meta.contentSha,
      contentType: cached.meta.contentType,
    });
    if (Date.now() < freshUntil(cached.meta)) return fromCache();
    const headers: Record<string, string> = {};
    if (cached.meta.etag) headers["if-none-match"] = cached.meta.etag;
    if (cached.meta.lastModified) headers["if-modified-since"] = cached.meta.lastModified;
    try {
      const response = await fetchWithRetry(url, Object.keys(headers).length ? headers : undefined);
      if (response.status === 304) {
        cached.meta.fetchedAt = Date.now();
        writeRemoteMeta(url, cached.meta);
        return fromCache();
      }
      return absorbRemoteResponse(url, response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnOnce(url, `remote image revalidation failed (${message}) — using stale cache`);
      return fromCache();
    }
  })();
  remoteMemo.set(url, { at: Date.now(), promise });
  promise.catch(() => remoteMemo.delete(url));
  return promise;
}

export function isImageFile(file: string): boolean {
  return IMAGE_EXTENSIONS.has(extname(file).toLowerCase());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 直通 `<img>`（未授权远程 / data: / md 接管的解析失败回填）——Astro 同语义：显示但不优化 */
export function plainImgHtml(src: string, alt: string, title?: string): string {
  return (
    `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt ?? "")}"` +
    `${title ? ` title="${escapeHtml(title)}"` : ""} loading="lazy" decoding="async"/>`
  );
}

// ── entry 归属目录 / 资产 digest 折叠 / watcher 归属 ─────────────────────────
// （ensureSynced 依赖三件套在 ./images-owners.ts——本文件是组件可 import 的叶子层，
//  不得经 content.ts 把内容层/CLI 集群拖进 server bundle（dogfood 实测踩中））

/** 单文件内容 digest 缓存：mtime+size 未变不重读（xxhash 在核心包，这里 app 层用 sha1 足够）。
 *  导出供 images-owners.ts 的目录折叠 digest 复用。 */
const contentDigestCache = new Map<string, { mtimeMs: number; size: number; digest: string }>();

export function fileDigest(file: string): string | undefined {
  try {
    const stat = statSync(file);
    const cached = contentDigestCache.get(file);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.digest;
    const digest = createHash("sha1").update(readFileSync(file)).digest("hex");
    contentDigestCache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, digest });
    return digest;
  } catch {
    contentDigestCache.delete(file);
    return undefined;
  }
}

// ── <mp-image> tag / md ![]() 预提取与解析 ────────────────────────────────────

export interface ImageTag {
  /** 占位符（HTML 注释——remark 按 raw HTML 块透传，stringify 原样输出） */
  token: string;
  /** 原始标签文本（tag 来源解析失败时原样回填） */
  raw: string;
  attrs: Record<string, string>;
  /**
   * 来源：tag = md 里的 `<mp-image/>`（回填原始标签）；md = `![]()` 接管（回填直通
   * `<img>`——解析失败时把 md 原文塞回 html 会字面显示，必须降级成直通图）。
   */
  origin: "tag" | "md";
}

const IMAGE_TAG_RE = /^ {0,3}<mp-image\s[^>]*?\/>$/;
/** 行尾内联形态：prose + 空格 + 标签（blog 实测有此写法）——拆到独立行后按块级处理 */
const IMAGE_TAG_TRAILING_RE = /^(.*\S)\s+(<mp-image\s[^>]*?\/>)$/;
/** 独立段落的 md 图片（整行只有图片语法；行内嵌句的不接管——布局包裹元素会打断行内排版） */
const MD_IMAGE_RE = /^ {0,3}!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*\)$/;
// 属性值三形态：双引号 / 单引号 / 无引号 token（HTML 合法；数字/单词自然写法）
const ATTRIBUTE_RE = /([a-zA-Z][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(?!["'\/])([^\s>]+))/g;

function attrValue(match: RegExpMatchArray): string {
  // 裸值分支会吞到自闭合斜杠（none/> → "none/"）——行尾 trim 掉
  const bare = match[4]?.replace(/\/+$/, "");
  return match[2] ?? match[3] ?? bare ?? "";
}
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * 从 body 块级提取自闭合 <mp-image …/>（行首 ≤3 空格；行尾内联形态拆行归一）与（opt-in）
 * 独立段落的 md 图片语法，替换为占位符注释。逐行扫描并跳过 fenced code——shiki 示例里
 * 的语法是教学文本，不是资产引用。
 *
 * options.markdown（config.images.markdown，默认 false）：接管 `![alt](src "title")`
 * 独立行 → 与 tag 同一占位符机制。boolean = 接管且属性走管线常量；对象形
 * （ImagesMarkdownDefaults，pdflux 反馈 #10）= 接管 + 站点级默认属性并入 attrs
 * 作缺省（md 语法自带的 src/alt/title 优先）。默认关 = 既有集合输出逐字节不变。
 */
export function extractImageTags(
  body: string,
  options?: { markdown?: boolean | ImagesMarkdownDefaults },
): { body: string; tags: Array<ImageTag> } {
  const lines = body.split("\n");
  const tags: Array<ImageTag> = [];
  // 对象形接管配置 → 站点级默认属性（merge 进 attrs；String() 归一，数组 densities 逗号连接）
  const mdDefaults = typeof options?.markdown === "object" ? options.markdown : undefined;
  let fence: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const fenceMatch = lines[i].match(FENCE_RE);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fenceMatch[1][0] === fence) fence = undefined;
      continue;
    }
    if (fence) continue;
    let tagText: string | undefined;
    let prefix: string | undefined;
    if (IMAGE_TAG_RE.test(lines[i])) {
      tagText = lines[i];
    } else {
      const trailing = lines[i].match(IMAGE_TAG_TRAILING_RE);
      if (trailing) {
        prefix = trailing[1];
        tagText = trailing[2];
      }
    }
    let tag: ImageTag | undefined;
    if (tagText) {
      const attrs: Record<string, string> = {};
      for (const match of tagText.matchAll(ATTRIBUTE_RE)) attrs[match[1]] = attrValue(match);
      if (attrs.src?.trim()) tag = { token: `<!--MPIMG${tags.length}-->`, raw: tagText, attrs, origin: "tag" };
    } else if (options?.markdown) {
      const md = lines[i].match(MD_IMAGE_RE);
      if (md) {
        // md 语法两分支同构：本地图（entry 目录解析）与远程图（授权判定）都进管线
        const attrs: Record<string, string> = { src: md[2], alt: md[1] };
        const title = md[3] ?? md[4];
        if (title) attrs.title = title;
        // 站点级默认属性作缺省（#10）——md 语法自带的 src/alt/title 永远优先；
        // 进 attrs ⇒ resolveCache 键随配置变化换键，不命中旧产物
        if (mdDefaults) {
          for (const [key, value] of Object.entries(mdDefaults)) {
            if (value !== undefined && attrs[key] === undefined) attrs[key] = String(value);
          }
        }
        tag = { token: `<!--MPIMG${tags.length}-->`, raw: lines[i], attrs, origin: "md" };
      }
    }
    if (!tag) continue;
    tags.push(tag);
    lines[i] = prefix !== undefined ? `${prefix}\n${tag.token}` : tag.token;
  }
  return { body: lines.join("\n"), tags };
}

// ── 解析：变体 / blur / 占位色 / <picture> / 静态 HTML ────────────────────────

interface ResolvedOutput {
  html: string;
}

/** (源内容 digest × 归一化属性) → 产物 html 的 promise。跨 entry 同图同属性共享，
 *  同键并发自动合并（Map 存 promise 而非值）。 */
const resolveCache = new Map<string, Promise<ResolvedOutput | undefined>>();
/** 解析失败已告警过的 src（dev 下每次重渲染都会走到，告警去抖） */
const warnedSrcs = new Set<string>();

function warnOnce(src: string, message: string): void {
  if (warnedSrcs.has(src)) return;
  warnedSrcs.add(src);
  console.warn(`[markopress] ${message}`);
}

/** 属性/站点默认 → 生效格式梯（单 webp = v1 `<img srcset>`；含 avif = `<picture>`） */
function effectiveFormats(attr: string | undefined, settings: ImagesSettings): Array<"webp" | "avif"> {
  const raw = attr ? attr.split(/[,\s]+/).filter(Boolean) : settings.formats;
  const formats = [...new Set(raw)].filter((f): f is "webp" | "avif" => f === "webp" || f === "avif");
  return formats.length ? formats : ["webp"];
}

/** densities 属性（"1,2,3" / "0.5,1,2"）→ 升序密度数组；无效/缺省 = undefined（走布局默认梯） */
function parseDensities(attr: string | undefined): Array<number> | undefined {
  if (!attr) return undefined;
  const list = attr
    .split(/[,\s]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  return list.length ? [...new Set(list)].sort((a, b) => a - b) : undefined;
}

function targetWidths(
  layout: string,
  displayWidth: number,
  sourceWidth: number,
  densities?: Array<number>,
): Array<number> {
  const widths = new Set<number>();
  if (densities?.length) {
    // densities 模式：显示宽 × 密度，封顶源宽，必含 1×（gatby outputPixelDensities 同式）
    const base = Math.min(displayWidth, sourceWidth);
    for (const d of densities) {
      const w = Math.round(base * d);
      if (w > 0 && w <= sourceWidth) widths.add(w);
    }
    widths.add(base);
    // srcset 恒含源宽档（#12，gatsby fluid 的 presentationWidth 同款）：源宽 > 梯最大
    // 时补一档——高 DPR 屏拿原图而非最近变体；密度已覆盖源宽时 Set 去重无副作用
    widths.add(sourceWidth);
  } else if (layout === "fixed") {
    // v1 语义（默认输出逐字节兼容）：1× + 2×（超源宽回落源宽）
    const base = Math.min(displayWidth, sourceWidth);
    widths.add(base);
    widths.add(2 * base <= sourceWidth ? 2 * base : sourceWidth);
  } else {
    for (const width of WIDTH_LADDER) if (width < sourceWidth) widths.add(width);
    widths.add(Math.min(displayWidth, sourceWidth));
    widths.add(sourceWidth);
  }
  return [...widths].filter((w) => Number.isFinite(w) && w > 0).sort((a, b) => a - b);
}

async function ensureVariant(
  buffer: Buffer,
  width: number,
  file: string,
  quality: number,
  format: "webp" | "avif",
): Promise<void> {
  if (existsSync(file)) return;
  mkdirSync(dirname(file), { recursive: true });
  // tmp + rename：并发渲染同一图片不至于写坏（后写者覆盖同内容）
  const tmp = `${file}.${process.pid}.tmp`;
  const image = sharp(buffer).rotate().resize({ width, withoutEnlargement: true });
  await (format === "avif" ? image.avif({ quality }) : image.webp({ quality })).toFile(tmp);
  renameSync(tmp, file);
}

async function blurDataUri(buffer: Buffer, hasAlpha: boolean): Promise<string> {
  const pipeline = sharp(buffer).resize({ width: 20, withoutEnlargement: true }).blur(6);
  const encoded = hasAlpha
    ? (await pipeline.clone().png({ compressionLevel: 9, palette: true }).toBuffer()).toString("base64")
    : (await pipeline.clone().jpeg({ quality: 40, mozjpeg: true }).toBuffer()).toString("base64");
  return `data:image/${hasAlpha ? "png" : "jpeg"};base64,${encoded}`;
}

/** 主色占位（gatby dominantColor 同款；缩小后取 stats，免全图解码开销） */
async function dominantColorStyle(buffer: Buffer): Promise<string> {
  const { dominant } = await sharp(buffer).resize({ width: 24, withoutEnlargement: true }).stats();
  if (!dominant) return "";
  return `background-color:rgb(${dominant.r},${dominant.g},${dominant.b});`;
}

/** src → 源文件定位（entry 目录优先，public/ 兜底）。找不到 = undefined（透传）。
 *  远程/data/协议相对由上游分流，不进本函数。entryDir 缺省（strapi 集合等无 filePath
 *  上下文）时只认 `/` 根路径（public/）。 */
function locateSource(src: string, entryDir: string | undefined): string | undefined {
  if (!src || src.startsWith("data:") || isRemoteSrc(src) || src.startsWith("//")) return undefined;
  const stripped = src.split(/[?#]/)[0].replace(/^\/+/, "");
  const candidate = entryDir ? resolve(entryDir, stripped) : undefined;
  const candidatePublic = src.startsWith("/") ? join(ROOT, "public", stripped) : undefined;
  const sourcePath = existsSync(candidate) ? candidate : candidatePublic && existsSync(candidatePublic) ? candidatePublic : undefined;
  if (!sourcePath || !IMAGE_EXTENSIONS.has(extname(stripped).toLowerCase())) {
    warnOnce(
      src,
      `<mp-image src="${src}"> not found ${entryDir ? `beside entry (${entryDir}) or ` : ""}under public/ — passing through`,
    );
    return undefined;
  }
  return sourcePath;
}

/** 单标签 → 静态 HTML。undefined = 透传（未授权远程、找不到源、不认识的扩展名）。 */
async function resolveTag(
  tag: ImageTag,
  entryDir: string | undefined,
  settings: ImagesSettings,
): Promise<ResolvedOutput | undefined> {
  const { attrs } = tag;
  const src = attrs.src.trim();

  // 源定位三态：本地文件 / 授权远程（缓存 fetch）/ 其余透传
  let buffer: Buffer;
  let ext: string;
  let contentDigest: string;
  let outName: string;
  if (isRemoteSrc(src)) {
    if (!isAuthorizedRemote(src, settings)) return undefined;
    const remote = await fetchRemoteCached(src);
    buffer = remote.buffer;
    ext = remote.ext;
    contentDigest = remote.contentSha;
    // 远程产物名用字节 sha（URL basename 可能含查询串/非法字符；同图跨 URL 去重）
    outName = `${contentDigest.slice(0, 12)}${ext}`;
  } else {
    const sourcePath = locateSource(src, entryDir);
    if (!sourcePath) return undefined;
    ext = extname(sourcePath).toLowerCase();
    buffer = readFileSync(sourcePath);
    contentDigest = createHash("sha1").update(buffer).digest("hex");
    outName = basename(sourcePath);
  }
  const outDir = join(OUTPUT_DIR, contentDigest.slice(0, 8));
  const urlFor = (name: string): string => encodeURI(`${OUTPUT_URL_PREFIX}/${contentDigest.slice(0, 8)}/${name}`);
  const alt = attrs.alt ?? "";
  const titleAttr = attrs.title ? ` title="${escapeHtml(attrs.title)}"` : "";
  // 原图链接包装（#11，gatsby-remark-images 缺省行为）：href = 管线拷贝的原图
  // （public/_markopress/image/<sha>/ 原名文件），新窗口打开；link="false" 显式关闭
  const wantsLink = attrs.link !== undefined && attrs.link !== "false";
  const linkWrap = (innerHtml: string): string =>
    wantsLink
      ? `<a class="mp-image-link" href="${urlFor(outName)}" style="display:block" target="_blank" rel="noopener">${innerHtml}</a>`
      : innerHtml;

  // gif / svg：拷原图，简单 <img>（无 aspect 盒无变体；远程同规则）
  if (ext === ".gif" || ext === ".svg") {
    mkdirSync(outDir, { recursive: true });
    const target = join(outDir, outName);
    if (!existsSync(target)) writeFileSync(target, buffer);
    const meta = await sharp(buffer, { animated: true }).metadata().catch(() => undefined);
    const dims =
      meta?.width && meta?.height ? ` width="${meta.width}" height="${meta.height}"` : "";
    return {
      html: linkWrap(
        `<img class="mp-image-plain" src="${urlFor(outName)}" alt="${escapeHtml(alt)}"` +
          `${titleAttr}${dims} loading="lazy" decoding="async"/>`,
      ),
    };
  }
  if (!RASTER_EXTENSIONS.has(ext)) {
    warnOnce(src, `<mp-image src="${src}"> unsupported extension "${ext}" — passing through`);
    return undefined;
  }

  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height) {
    warnOnce(src, `<mp-image src="${src}">: could not determine dimensions — passing through`);
    return undefined;
  }
  const layout = ["responsive", "fixed", "fluid"].includes(attrs.layout ?? "") ? attrs.layout! : "responsive";
  // 显示尺寸约束：width 或 height 任给其一（等比推导）；都不给 = 原尺寸
  const attrW = Number(attrs.width);
  const attrH = Number(attrs.height);
  const displayWidth = attrW > 0 ? attrW : attrH > 0 ? Math.round((meta.width * attrH) / meta.height) : meta.width;
  const quality = Math.min(100, Math.max(1, Number(attrs.quality) > 0 ? Number(attrs.quality) : DEFAULT_QUALITY));

  const formats = effectiveFormats(attrs.formats, settings);
  const densities = parseDensities(attrs.densities);
  const widths = targetWidths(layout, displayWidth, meta.width, densities);
  // 变体名含 quality 段（非默认时）：同源同宽不同质量/格式不会互相覆盖
  const qSuffix = quality !== DEFAULT_QUALITY ? `-q${quality}` : "";
  const variantName = (width: number, format: string) =>
    `${outName.replace(/\.[^.]+$/, "")}-${width}w${qSuffix}.${format}`;
  await Promise.all(
    formats.flatMap((format) =>
      widths.map((width) => ensureVariant(buffer, width, join(outDir, variantName(width, format)), quality, format)),
    ),
  );
  mkdirSync(outDir, { recursive: true });
  const originalName = join(outDir, outName);
  if (!existsSync(originalName)) writeFileSync(originalName, buffer);

  const srcsetFor = (format: string) => widths.map((width) => `${urlFor(variantName(width, format))} ${width}w`).join(", ");
  // src 兜底用原图拷贝（srcset 不被支持/变体缺失时的回退；现代浏览器走 srcset）
  const fallbackSrc = urlFor(outName);
  // sizes 可直传覆盖（响应式布局提示）；缺省按 layout 推导
  const sizes =
    attrs.sizes ??
    (layout === "fixed"
      ? `${displayWidth}px`
      : layout === "fluid"
        ? "100vw"
        : `(max-width: ${displayWidth}px) 100vw, ${displayWidth}px`);
  const priority = attrs.fetchpriority === "high" ? ` fetchpriority="high"` : "";
  const dimsAndAlt = ` width="${meta.width}" height="${meta.height}" alt="${escapeHtml(alt)}"${titleAttr} loading="lazy" decoding="async"${priority}`;

  // 单 webp = v1 形状（<img srcset>）；含 avif = <picture>（source 按格式优先序 + 原图 fallback）
  const inner =
    formats.length === 1 && formats[0] === "webp"
      ? `<img src="${fallbackSrc}" srcset="${srcsetFor("webp")}" sizes="${sizes}"${dimsAndAlt}/>`
      : `<picture>${formats
          .map((format) => `<source type="image/${format}" srcset="${srcsetFor(format)}" sizes="${sizes}"/>`)
          .join("")}<img src="${fallbackSrc}"${dimsAndAlt}/></picture>`;

  // 占位三态：blur（默认，v1）/ color（gatby dominantColor 同款）/ none（首屏大图省 data URI）
  const placeholderMode = attrs.placeholder === "none" || attrs.placeholder === "color" ? attrs.placeholder : "blur";
  let placeholderStyle = "";
  if (placeholderMode === "blur") {
    const blur = await blurDataUri(buffer, Boolean(meta.hasAlpha));
    placeholderStyle = blur ? `background-image:url(${blur});background-size:cover;background-position:center;` : "";
  } else if (placeholderMode === "color") {
    placeholderStyle = await dominantColorStyle(buffer);
  }
  const style =
    layout === "fixed"
      ? `width:${Math.min(displayWidth, meta.width)}px`
      : `aspect-ratio:${meta.width}/${meta.height}` + (layout === "responsive" ? `;max-width:${displayWidth}px` : "");
  const classAttr = attrs.class ? ` ${escapeHtml(attrs.class)}` : "";
  const html =
    `<div class="mp-image mp-image--${layout}${classAttr}" style="${style};${placeholderStyle}">${linkWrap(inner)}</div>`;
  return { html };
}

/**
 * 解析并回填 segments（原位替换占位符）。归属目录由调用方给（resolveEntryDir；远程图
 * 无需目录）。解析失败的回填：md 接管来源 / 远程 / data → 直通 <img>（原文回填会字面
 * 显示 md 语法或不可见标签）；本地 tag 来源 → 原始标签文本（v1 语义）。
 */
export async function resolveImageSegments(
  segments: Array<{ type: string; html: string }>,
  tags: Array<ImageTag>,
  entryDir: string | undefined,
  settings: ImagesSettings,
): Promise<void> {
  await Promise.all(
    tags.map(async (tag) => {
      const src = tag.attrs.src?.trim() ?? "";
      // 缓存键三态（v1 注记保留：同路径换字节不能命中旧产物，否则 vcontent 逐字节
      // 不变、失效断链）：本地 = 路径×内容 digest；授权远程 = URL×拉取字节 sha（经
      // fetchRemoteCached 的 60s memo，键计算不重复打网络）；其余不缓存（直通无成本）
      let key: string | undefined;
      if (isRemoteSrc(src)) {
        if (isAuthorizedRemote(src, settings)) {
          try {
            const remote = await fetchRemoteCached(src);
            key = `remote\u0000${src}\u0000${remote.contentSha}\u0000${JSON.stringify(tag.attrs)}`;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (process.env.MARKOPRESS_PHASE === "build") throw error;
            warnOnce(src, `remote image fetch failed (${message}) — passing through`);
          }
        }
      } else {
        const sourcePath = locateSource(src, entryDir);
        const contentDigest = sourcePath ? fileDigest(sourcePath) : undefined;
        if (sourcePath && contentDigest) {
          key = `${sourcePath}\u0000${contentDigest}\u0000${JSON.stringify(tag.attrs)}`;
        }
      }
      let html: string | undefined;
      const cached = key ? resolveCache.get(key) : undefined;
      if (cached) {
        html = (await cached)?.html;
      } else {
        const pending = resolveTag(tag, entryDir, settings).catch((error) => {
          const message = error instanceof Error ? error.message : error;
          console.warn(`[markopress] image resolve failed for ${tag.attrs.src}: ${message}`);
          if (process.env.MARKOPRESS_PHASE === "build") throw error;
          return undefined;
        });
        if (key) resolveCache.set(key, pending);
        html = (await pending)?.html;
        // 远程键不驻留失败产物：CMS 瞬时故障恢复后下一次渲染即重试（本地键由
        // watcher 资产 digest 换键重试，undefined 驻留无妨）
        if (html === undefined && key?.startsWith("remote")) resolveCache.delete(key);
      }
      const replacement =
        html ??
        (tag.origin === "md" || isRemoteSrc(src) || src.startsWith("data:")
          ? plainImgHtml(src, tag.attrs.alt ?? "", tag.attrs.title)
          : tag.raw);
      for (const segment of segments) {
        // 组件段（segments.ts 切出）无 html 字段——MPIMG 占位符只活在 html 段
        if (segment.type !== "html") continue;
        if (segment.html.includes(tag.token)) segment.html = segment.html.replaceAll(tag.token, replacement);
      }
    }),
  );
}

// ── 组件设置（叶子层获取 config.images 的通道）───────────────────────────────

/**
 * `.markopress/images-settings.json`：setup 期（content.ts）从 config.images 归一化落盘。
 * 组件渲染路径（server bundle 内）不能 import content.ts（ensureSynced 会把内容层
 * 拖进 bundle），设置经此文件传递——mtime 缓存读取，config 变更（resetSynced → setup
 * 重写）后下一次渲染自动生效。
 */
export const IMAGES_SETTINGS_FILE = join(ROOT, ".markopress", "images-settings.json");

let settingsCache: { mtimeMs: number; settings: ImagesSettings } | undefined;

export function loadImagesSettings(): ImagesSettings {
  try {
    const stat = statSync(IMAGES_SETTINGS_FILE);
    if (!settingsCache || settingsCache.mtimeMs !== stat.mtimeMs) {
      // JSON 往返会把 Set 变数组——读回时还原（isAuthorizedRemote 消费 Set.has）
      const parsed = JSON.parse(readFileSync(IMAGES_SETTINGS_FILE, "utf-8")) as Omit<ImagesSettings, "domains"> & { domains: string[] };
      settingsCache = {
        mtimeMs: stat.mtimeMs,
        settings: { ...parsed, domains: new Set(parsed.domains ?? []) },
      };
    }
    return settingsCache.settings;
  } catch {
    // 无设置文件（异常形态）：v1 默认——无授权域、单 webp、md 不接管
    return { domains: new Set(), remotePatterns: [], markdown: false, formats: ["webp"] };
  }
}

/** 测试钩子：清进程级缓存（resolveCache / 远程 memo / 告警去抖）——跨用例状态隔离 */
export function __testResetCaches(): void {
  resolveCache.clear();
  remoteMemo.clear();
  warnedSrcs.clear();
  settingsCache = undefined;
}

/**
 * 页面侧 `<mp-image>` Marko 组件的服务端解析入口（engine/tags/mp-image.marko 经
 * `server import` 调用；docs/images-v2-design.md §5）。src = 授权远程 URL 或站点
 * 根路径（/foo.png → public/foo.png）；相对路径以 public/ 为基（无 entry 上下文）。
 * attrs 值接受 string/number/数组（Marko 模板属性归一）。失败 throw——dev 由组件
 * `<@catch>` 显示，build 期随渲染炸出（SSG 爬取失败 = 构建失败）。
 */
export async function resolveImageTagHtml(attrs: Record<string, unknown>): Promise<string> {
  const settings = loadImagesSettings();
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value == null) continue;
    normalized[key] = Array.isArray(value) ? value.join(",") : String(value);
  }
  const src = normalized.src?.trim() ?? "";
  if (!src) throw new Error("[mp-image] missing src");
  const tag: ImageTag = { token: "", raw: "", attrs: normalized, origin: "tag" };
  const resolved = await resolveTag(tag, join(ROOT, "public"), settings);
  return resolved?.html ?? plainImgHtml(src, normalized.alt ?? "", normalized.title);
}

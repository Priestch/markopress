// 资产管线 v1（app 共享层，两后端共用）—— co-located 图片的发现、解析与响应式输出。
//
// 设计对齐（2026-10-19）：不进 store、不进核心包（packages/content/AGENTS.md「不做
// 图片服务」+ sharp 依赖红线，audit 测试锁死）。整体活在 app 层：
//   发现：渲染时按 entry 归属目录扫旁挂图片（mtime/size stat 缓存，内容 digest 只算一次）
//   失效：资产 digest 折进 entry 有效 digest（renderContentModule）⇒ 渲染缓存 /
//         transformBody / pageData / vcontent 落盘全级联；watcher 事件 → assetOwners
//         （同目录或同名子目录）→ 重渲染归属 entry
//   产物：public/_markopress/image/<源内容 sha1 前8>/ 内容寻址（同图去重、改名复用）；
//         vite 路径原生服务 publicDir，rspack 路径靠 markopack dev sirv 链 +
//         adapter-static buildEnd 拷贝（本仓库配套落地）
//
// v1 边界（刻意不做，v2 留门）：AVIF 输出 / <picture> 多格式 / art direction /
// 远程图 / frontmatter image() helper。<image> 只识别块级自闭合 + 双引号属性
// （blog 全量覆盖），其余原样透传；代码围栏内不处理（shiki 示例安全）。
// 展示层是纯静态 HTML + theme CSS（.mp-image），不是 Marko 组件——「位置与行为
// 都在构建期已知」，组件化留给 segments 门（content-modules.ts 头注）。
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import sharp from "sharp";
import type { DataEntry } from "@markopress/content";
import { ensureSynced } from "./content.ts";
import { ROOT } from "./paths.ts";

/** 发现集合：参与归属/失效扫描的全部图片后缀 */
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"]);
/** 光栅集合：做变体 + blur；gif/svg 只拷贝原图（gif 动帧、svg 矢量） */
const RASTER_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);
const OUTPUT_URL_PREFIX = "/_markopress/image";
const OUTPUT_DIR = join(ROOT, "public", OUTPUT_URL_PREFIX);
const DEFAULT_QUALITY = 80;
/** 响应式梯（旧版 0.0.24 同款） */
const WIDTH_LADDER = [320, 480, 640, 768, 960, 1280, 1536, 1920];

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

/** 单文件内容 digest 缓存：mtime+size 未变不重读（xxhash 在核心包，这里 app 层用 sha1 足够） */
const contentDigestCache = new Map<string, { mtimeMs: number; size: number; digest: string }>();

function fileDigest(file: string): string | undefined {
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

// ── <image> 预提取与解析 ──────────────────────────────────────────────────────

export interface ImageTag {
	/** 占位符（HTML 注释——remark 按 raw HTML 块透传，stringify 原样输出） */
	token: string;
	/** 原始标签文本（解析失败时原样回填） */
	raw: string;
	attrs: Record<string, string>;
}

const IMAGE_TAG_RE = /^ {0,3}<mp-image\s[^>]*?\/>$/;
/** 行尾内联形态：prose + 空格 + 标签（blog 实测有此写法）——拆到独立行后按块级处理 */
const IMAGE_TAG_TRAILING_RE = /^(.*\S)\s+(<mp-image\s[^>]*?\/>)$/;
// 属性值三形态：双引号 / 单引号 / 无引号 token（HTML 合法；数字/单词自然写法）
const ATTRIBUTE_RE = /([a-zA-Z][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(?!["'\/])([^\s>]+))/g;

function attrValue(match: RegExpMatchArray): string {
	// 裸值分支会吞到自闭合斜杠（none/> → "none/"）——行尾 trim 掉
	const bare = match[4]?.replace(/\/+$/, "");
	return match[2] ?? match[3] ?? bare ?? "";
}
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * 从 body 块级提取自闭合 <image …/>（行首 ≤3 空格、双引号属性；行尾内联形态拆行
 * 归一），替换为占位符注释。逐行扫描并跳过 fenced code——shiki 示例里的 <image>
 * 是教学文本，不是资产引用。
 */
export function extractImageTags(body: string): { body: string; tags: Array<ImageTag> } {
	const lines = body.split("\n");
	const tags: Array<ImageTag> = [];
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
		if (!tagText) continue;
		const attrs: Record<string, string> = {};
		for (const match of tagText.matchAll(ATTRIBUTE_RE)) attrs[match[1]] = attrValue(match);
		if (!attrs.src?.trim()) continue;
		const tag: ImageTag = { token: `<!--MPIMG${tags.length}-->`, raw: tagText, attrs };
		tags.push(tag);
		lines[i] = prefix !== undefined ? `${prefix}\n${tag.token}` : tag.token;
	}
	return { body: lines.join("\n"), tags };
}

// ── 解析：变体 / blur / 静态 HTML ────────────────────────────────────────────

interface ResolvedOutput {
	html: string;
}

/** (源内容 digest × 归一化属性) → 产物 html。跨 entry 同图同属性共享。 */
const resolveCache = new Map<string, Promise<ResolvedOutput | undefined>>();
/** 解析失败已告警过的 src（dev 下每次重渲染都会走到，告警去抖） */
const warnedSrcs = new Set<string>();

function warnOnce(src: string, message: string): void {
	if (warnedSrcs.has(src)) return;
	warnedSrcs.add(src);
	console.warn(`[markopress] ${message}`);
}

function targetWidths(layout: string, displayWidth: number, sourceWidth: number): Array<number> {
	const widths = new Set<number>();
	if (layout === "fixed") {
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

async function ensureVariant(buffer: Buffer, width: number, file: string, quality: number): Promise<void> {
	if (existsSync(file)) return;
	mkdirSync(dirname(file), { recursive: true });
	// tmp + rename：并发渲染同一图片不至于写坏（后写者覆盖同内容）
	const tmp = `${file}.${process.pid}.tmp`;
	await sharp(buffer).rotate().resize({ width, withoutEnlargement: true }).webp({ quality }).toFile(tmp);
	renameSync(tmp, file);
}

async function blurDataUri(buffer: Buffer, hasAlpha: boolean): Promise<string> {
	const pipeline = sharp(buffer).resize({ width: 20, withoutEnlargement: true }).blur(6);
	const encoded = hasAlpha
		? (await pipeline.clone().png({ compressionLevel: 9, palette: true }).toBuffer()).toString("base64")
		: (await pipeline.clone().jpeg({ quality: 40, mozjpeg: true }).toBuffer()).toString("base64");
	return `data:image/${hasAlpha ? "png" : "jpeg"};base64,${encoded}`;
}

/** src → 源文件定位（entry 目录优先，public/ 兜底）。找不到 = undefined（透传）。 */
function locateSource(src: string, entryDir: string): string | undefined {
	if (!src || src.startsWith("data:") || /^(https?:)?\/\//i.test(src)) return undefined;
	const stripped = src.split(/[?#]/)[0].replace(/^\/+/, "");
	const candidate = resolve(entryDir, stripped);
	const candidatePublic = src.startsWith("/") ? join(ROOT, "public", stripped) : undefined;
	const sourcePath = existsSync(candidate) ? candidate : candidatePublic && existsSync(candidatePublic) ? candidatePublic : undefined;
	if (!sourcePath || !(IMAGE_EXTENSIONS.has(extname(stripped).toLowerCase()) || extname(stripped).toLowerCase() === ".svg")) {
		warnOnce(src, `<image src="${src}"> not found beside entry (${entryDir}) or under public/ — passing through`);
		return undefined;
	}
	return sourcePath;
}

/** 单标签 → 静态 HTML。null = 透传原始标签（远程/data URL、找不到源文件、不认识的扩展名）。 */
async function resolveTag(tag: ImageTag, entryDir: string): Promise<ResolvedOutput | undefined> {
	const { attrs } = tag;
	const src = attrs.src.trim();
	const sourcePath = locateSource(src, entryDir);
	if (!sourcePath) return undefined;
	const ext = extname(sourcePath).toLowerCase();

	const buffer = readFileSync(sourcePath);
	const contentDigest = createHash("sha1").update(buffer).digest("hex");
	const outDir = join(OUTPUT_DIR, contentDigest.slice(0, 8));
	const outName = basename(sourcePath);
	const urlFor = (name: string): string => encodeURI(`${OUTPUT_URL_PREFIX}/${contentDigest.slice(0, 8)}/${name}`);
	const alt = attrs.alt ?? "";

	// gif / svg：拷原图，简单 <img>（无 aspect 盒无变体）
	if (ext === ".gif" || ext === ".svg") {
		mkdirSync(outDir, { recursive: true });
		const target = join(outDir, outName);
		if (!existsSync(target)) copyFileSync(sourcePath, target);
		const meta = await sharp(buffer, { animated: true }).metadata().catch(() => undefined);
		const dims =
			meta?.width && meta?.height ? ` width="${meta.width}" height="${meta.height}"` : "";
		return {
			html:
				`<img class="mp-image-plain" src="${urlFor(outName)}" alt="${escapeHtml(alt)}"` +
				`${dims} loading="lazy" decoding="async"/>`,
		};
	}

	const meta = await sharp(buffer).metadata();
	if (!meta.width || !meta.height) {
		warnOnce(src, `<image src="${src}">: could not determine dimensions — passing through`);
		return undefined;
	}
	const layout = ["responsive", "fixed", "fluid"].includes(attrs.layout ?? "") ? attrs.layout! : "responsive";
	// 显示尺寸约束：width 或 height 任给其一（等比推导）；都不给 = 原尺寸
	const attrW = Number(attrs.width);
	const attrH = Number(attrs.height);
	const displayWidth = attrW > 0 ? attrW : attrH > 0 ? Math.round((meta.width * attrH) / meta.height) : meta.width;
	const quality = Math.min(100, Math.max(1, Number(attrs.quality) > 0 ? Number(attrs.quality) : DEFAULT_QUALITY));

	const widths = targetWidths(layout, displayWidth, meta.width);
	// 变体名含 quality 段（非默认时）：同源同宽不同质量不会互相覆盖
	const variantName = (width: number) =>
		`${outName.replace(/\.[^.]+$/, "")}-${width}w${quality !== DEFAULT_QUALITY ? `-q${quality}` : ""}.webp`;
	await Promise.all(
		widths.map((width) => ensureVariant(buffer, width, join(outDir, variantName(width)), quality)),
	);
	mkdirSync(outDir, { recursive: true });
	const originalName = join(outDir, outName);
	if (!existsSync(originalName)) copyFileSync(sourcePath, originalName);

	const srcset = widths.map((width) => `${urlFor(variantName(width))} ${width}w`).join(", ");
	// src 兜底用原图拷贝（srcset 不被支持/变体缺失时的回退；现代浏览器走 srcset 拿 webp）
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
	const img =
		`<img src="${fallbackSrc}" srcset="${srcset}" sizes="${sizes}"` +
		` width="${meta.width}" height="${meta.height}" alt="${escapeHtml(alt)}"` +
		` loading="lazy" decoding="async"${priority}/>`;
	// blur 垫在容器背景：图片字节到达前占位区可见，字节到达后被 <img> 盖住——零 JS。
	// placeholder="none" 关闭（首屏大图省一段 data URI）
	const blur =
		attrs.placeholder === "none" ? "" : await blurDataUri(buffer, Boolean(meta.hasAlpha));
	const blurStyle = blur ? `background-image:url(${blur});background-size:cover;background-position:center;` : "";
	const style =
		layout === "fixed"
			? `width:${Math.min(displayWidth, meta.width)}px`
			: `aspect-ratio:${meta.width}/${meta.height}` + (layout === "responsive" ? `;max-width:${displayWidth}px` : "");
	const html =
		`<div class="mp-image mp-image--${layout}" style="${style};${blurStyle}">${img}</div>`;
	return { html };
}

/**
 * 解析并回填 segments（原位替换占位符）。归属目录由调用方给（resolveEntryDir）。
 * 解析失败的占位符回填原始标签文本（与未接管线时行为一致——透传）。
 */
export async function resolveImageSegments(
	segments: Array<{ type: string; html: string }>,
	tags: Array<ImageTag>,
	entryDir: string,
): Promise<void> {
	await Promise.all(
		tags.map(async (tag) => {
			let html: string | undefined;
			// 缓存键必须含源内容 digest：同路径换字节（编辑器重存/重压缩）不能命中旧产物——
			// 否则资产 digest 折叠虽触发重渲染，解析产物逐字节不变，vcontent 不重写、失效断链
			const sourcePath = locateSource(tag.attrs.src?.trim() ?? "", entryDir);
			const contentDigest = sourcePath ? fileDigest(sourcePath) : undefined;
			const key =
				sourcePath && contentDigest
					? `${sourcePath}\u0000${contentDigest}\u0000${JSON.stringify(tag.attrs)}`
					: undefined;
			const cached = key ? resolveCache.get(key) : undefined;
			if (cached) {
				html = (await cached)?.html;
			} else {
				const pending = resolveTag(tag, entryDir).catch((error) => {
					console.warn(`[markopress] image resolve failed for ${tag.attrs.src}: ${error}`);
					return undefined;
				});
				if (key) resolveCache.set(key, pending);
				html = (await pending)?.html;
			}
			const replacement = html ?? tag.raw;
			for (const segment of segments) {
				// 组件段（segments.ts 切出）无 html 字段——MPIMG 占位符只活在 html 段
				if (segment.type !== "html") continue;
				if (segment.html.includes(tag.token)) segment.html = segment.html.replaceAll(tag.token, replacement);
			}
		}),
	);
}

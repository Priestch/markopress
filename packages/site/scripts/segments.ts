// md 内 Marko 组件段（segments 机制）：两种用法在 md 正文直接写 Marko——
//
//   ① tag library：src/components/counter.marko → 正文块级 <counter/>（属性随标签透传，
//      由 Marko 编译器解析：未引号值按表达式、字符串要引号）
//   ② 内联围栏：```marko 围栏块，内容是自足模板片段（let/事件/核心 tag 皆可）——
//      一次性演示/demo 不建文件直接写
//
// 抽取 → 占位符注释 → md 渲染后按占位符切段（html | component）→ 组件段落盘
// .markopress/vseg/<c>/<id>/<n>.marko → 模块 import "virtual:mp/segment/<c>/<id>/<n>"
// （rspack：NormalModuleReplacementPlugin 重写；vite：resolveId 垫片——均解析到真实
// .marko 文件，编译归 bundler，失效走原生 watcher）。
//
// 与 images.ts 的分工：那边产出静态 HTML（无交互，纯注入）；这边产出活组件（可水合交互）。
// 只认白名单 tag 名 + 显式 ```marko 围栏——解析面收窄到与 <image> 同级。
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./paths.ts";

/** 组件 tag library 目录（app root marko.json 的 tags-dir 同款约定） */
export const COMPONENTS_DIR = join(ROOT, "src", "components");
/** 组件段落盘目录（真实 .marko 文件，进编译图） */
export const VSEG_DIR = join(ROOT, ".markopress", "vseg");
/** 虚拟段前缀：virtual:mp/segment/<collection>/<id>/<n> */
export const SEGMENT_PREFIX = "virtual:mp/segment/";

export interface ComponentTag {
	/** 占位符（HTML 注释，remark 原样透传，渲染后按它切段） */
	token: string;
	/** 原始标签文本（seg .marko 文件内容 = 它 + 换行；taglib 发现组件） */
	raw: string;
	name: string;
}

/** 块级自闭合 tag 行（先粗筛，命中才要白名单——避免每行 readdir） */
const TAG_LINE_RE = /^ {0,3}<([A-Za-z][\w.-]*)(\s[^>]*?)?\/>$/;
/** 围栏开/闭行：marker + info 首词（marko 围栏的识别键；闭行无 info） */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(\S*)/;

/** tag 名白名单缓存：目录 mtime 变（增删文件）才失效；文件内容变化不影响名单 */
let tagNamesCache: { mtimeMs: number; names: Set<string> } | undefined;

function knownTagNames(): Set<string> {
	try {
		const mtimeMs = statSync(COMPONENTS_DIR).mtimeMs;
		if (tagNamesCache?.mtimeMs === mtimeMs) return tagNamesCache.names;
		const names = new Set(
			readdirSync(COMPONENTS_DIR).filter((f) => f.endsWith(".marko")).map((f) => f.slice(0, -".marko".length)),
		);
		tagNamesCache = { mtimeMs, names };
		return names;
	} catch {
		return new Set();
	}
}

/**
 * 从 body 提取组件段，替换为占位符注释。两种形态（同一编号流，MPSEG 顺序即段序）：
 *   ① ```marko 围栏块 —— 内容是自足模板片段（可写 let/事件/任意核心 tag），
 *      整块（开栏…闭栏）替换为一个占位符行；无白名单，写什么编什么
 *      （md 是站点作者的内容，信任级等同 src/components/）
 *   ② 白名单 tag 行 —— 块级自闭合，名字命中 src/components/ 的 .marko 文件
 * 其余围栏（```md 等）仅做跳过状态跟踪，内容不提取。
 */
export function extractComponentTags(body: string): { body: string; tags: Array<ComponentTag> } {
	const lines = body.split("\n");
	const tags: Array<ComponentTag> = [];
	const hasComponents = existsSync(COMPONENTS_DIR);
	const names = hasComponents ? knownTagNames() : new Set<string>();
	let fence: { marker: string; len: number; markoFrom: number | undefined } | undefined;

	for (let i = 0; i < lines.length; i++) {
		const fenceMatch = lines[i].match(FENCE_RE);
		if (fenceMatch) {
			const marker = fenceMatch[1][0];
			const len = fenceMatch[1].length;
			if (!fence) {
				fence = { marker, len, markoFrom: fenceMatch[2] === "marko" ? i : undefined };
			} else if (marker === fence.marker && len >= fence.len && !fenceMatch[2]) {
				// 闭栏：marko 围栏的整块收编为段（空块跳过）
				if (fence.markoFrom !== undefined) {
					const content = lines.slice(fence.markoFrom + 1, i).join("\n");
					if (content.trim()) {
						tags.push({ token: `<!--MPSEG${tags.length}-->`, raw: content, name: "inline" });
						lines.splice(fence.markoFrom, i - fence.markoFrom + 1, tags.at(-1)!.token);
						i = fence.markoFrom;
					}
				}
				fence = undefined;
			}
			continue;
		}
		if (fence || !hasComponents) continue;
		const match = lines[i].match(TAG_LINE_RE);
		if (!match || !names.has(match[1])) continue;
		const tag: ComponentTag = { token: `<!--MPSEG${tags.length}-->`, raw: lines[i].trim(), name: match[1] };
		tags.push(tag);
		lines[i] = tag.token;
	}
	return { body: lines.join("\n"), tags };
}

export type MixedSegment = { type: "html"; html: string } | { type: "component"; index: number };

/**
 * 渲染后的 html 按占位符切成 html/component 交替段。空 html 段跳过（段首/段尾占位符
 * 的常见形态）。images.ts 的 MPIMG 占位符在 html 段内，由 resolveImageSegments 原位回填。
 */
export function splitSegments(html: string, tags: Array<ComponentTag>): Array<MixedSegment> {
	if (tags.length === 0) return [{ type: "html", html }];
	const segments: Array<MixedSegment> = [];
	let cursor = 0;
	for (const match of html.matchAll(/<!--MPSEG(\d+)-->/g)) {
		const index = Number(match[1]);
		if (match.index > cursor) segments.push({ type: "html", html: html.slice(cursor, match.index) });
		segments.push({ type: "component", index });
		cursor = (match.index ?? 0) + match[0].length;
	}
	if (cursor < html.length) segments.push({ type: "html", html: html.slice(cursor) });
	return segments.filter((s) => s.type === "component" || s.html.trim().length > 0);
}

/** seg 文件路径：.markopress/vseg/<collection>/<id>/<n>.marko（id 含 / 时嵌套目录） */
export function segmentFile(collection: string, id: string, index: number): string {
	return join(VSEG_DIR, collection, id, `${index}.marko`);
}

/**
 * 落盘一个 entry 的全部 seg 文件（write-if-changed）+ 清掉序号越界的孤儿
 * （tag 数减少时）。返回实际存在的文件清单（供全量 cleanStale 的 expected 集）。
 */
export function writeSegmentFiles(collection: string, id: string, tags: Array<ComponentTag>): Array<string> {
	const dir = join(VSEG_DIR, collection, id);
	const written: Array<string> = [];
	for (let i = 0; i < tags.length; i++) {
		const file = segmentFile(collection, id, i);
		const content = `${tags[i].raw}\n`;
		if (!existsSync(file) || readFileSync(file, "utf-8") !== content) {
			mkdirSync(dir, { recursive: true });
			writeFileSync(file, content);
		}
		written.push(file);
	}
	// 越界孤儿：本 entry 现有文件里序号 >= tags.length 的删掉
	if (existsSync(dir)) {
		for (const name of readdirSync(dir)) {
			const n = Number(name.match(/^(\d+)\.marko$/)?.[1]);
			if (Number.isInteger(n) && n >= tags.length) rmSync(join(dir, name));
		}
	}
	return written;
}

/** entry 删除时清整个 seg 目录 */
export function removeSegmentFiles(collection: string, id: string): void {
	rmSync(join(VSEG_DIR, collection, id), { recursive: true, force: true });
}

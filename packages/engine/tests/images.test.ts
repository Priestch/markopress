// 图片管线 v2 单测（docs/images-v2-design.md §8）。MARKOPRESS_ROOT 指到临时目录后
// 动态 import images.ts（ROOT 在模块加载期定格）——产物/缓存全部圈在临时目录。
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

const ROOT = mkdtempSync(join(tmpdir(), "mp-images-"));
process.env.MARKOPRESS_ROOT = ROOT;
// build 期硬失败分流默认关（单测逐个开）
delete process.env.MARKOPRESS_PHASE;

const {
  extractImageTags,
  isAuthorizedRemote,
  fetchRemoteCached,
  resolveImageSegments,
  resolveImageTagHtml,
  loadImagesSettings,
  IMAGES_SETTINGS_FILE,
  __testResetCaches,
} = await import("../src/images.ts");

const settings = (override?: Record<string, unknown>) => ({
  domains: new Set(["allowed.example.com"]),
  remotePatterns: [{ protocol: "https", hostname: "*.cdn.example.com" }],
  markdown: false,
  formats: ["webp" as const],
  ...override,
});

/** 400×300 纯色 png 夹具字节 */
async function pngBytes(width = 400, height = 300, color = { r: 200, g: 80, b: 40 }): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
}

function fetchStub(handler: (url: string, init?: RequestInit) => Response): ReturnType<typeof vi.fn> {
  const fn = vi.fn(handler);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MARKOPRESS_PHASE;
  __testResetCaches();
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

// ── 授权判定（SSRF 防线）─────────────────────────────────────────────────────

describe("isAuthorizedRemote", () => {
  it("domains 精确匹配；子域不含", () => {
    const s = settings();
    expect(isAuthorizedRemote("https://allowed.example.com/a.png", s)).toBe(true);
    expect(isAuthorizedRemote("https://sub.allowed.example.com/a.png", s)).toBe(false);
    expect(isAuthorizedRemote("https://evil.com/allowed.example.com/a.png", s)).toBe(false);
  });

  it("remotePatterns 通配子域；协议过滤", () => {
    const s = settings();
    expect(isAuthorizedRemote("https://img.cdn.example.com/a.png", s)).toBe(true);
    expect(isAuthorizedRemote("https://deep.img.cdn.example.com/a.png", s)).toBe(true);
    expect(isAuthorizedRemote("https://cdn.example.com/a.png", s)).toBe(false); // 裸域不含
    expect(isAuthorizedRemote("http://img.cdn.example.com/a.png", s)).toBe(false); // protocol: https
  });

  it("非 http(s) 与坏 URL 拒绝", () => {
    const s = settings();
    expect(isAuthorizedRemote("ftp://allowed.example.com/a.png", s)).toBe(false);
    expect(isAuthorizedRemote("not a url", s)).toBe(false);
  });
});

// ── md ![]() 接管提取 ────────────────────────────────────────────────────────

describe("extractImageTags", () => {
  it("默认不接管 md 图片（v1 行为不变）；开启后接管独立段落", () => {
    const body = "前文\n\n![alt text](pic.png \"标题\")\n\n后文";
    expect(extractImageTags(body).tags).toHaveLength(0);
    const { body: withToken, tags } = extractImageTags(body, { markdown: true });
    expect(tags).toHaveLength(1);
    expect(tags[0].origin).toBe("md");
    expect(tags[0].attrs).toEqual({ src: "pic.png", alt: "alt text", title: "标题" });
    expect(withToken).not.toContain("![");
  });

  it("行内嵌句与 fenced code 不接管", () => {
    const body = [
      "句子里的 ![inline](x.png) 图不接管",
      "",
      "```md",
      "![fenced](x.png)",
      "```",
    ].join("\n");
    const { tags } = extractImageTags(body, { markdown: true });
    expect(tags).toHaveLength(0);
  });

  it("远程 md 图片也接管（授权判定后置到解析层）", () => {
    const { tags } = extractImageTags("![x](https://allowed.example.com/a.png)", { markdown: true });
    expect(tags).toHaveLength(1);
    expect(tags[0].attrs.src).toBe("https://allowed.example.com/a.png");
  });

  it("对象形接管配置：站点默认属性并入 attrs 作缺省（#10）；md 自带属性优先", () => {
    const { tags } = extractImageTags('![alt](pic.png "标题")', {
      markdown: { width: 650, quality: 100, densities: [0.25, 0.5, 1, 1.5, 2], link: true, alt: "不应覆盖" },
    });
    expect(tags[0].attrs).toEqual({
      src: "pic.png",
      alt: "alt",
      title: "标题",
      width: "650",
      quality: "100",
      densities: "0.25,0.5,1,1.5,2",
      link: "true",
    });
  });
});

// ── 远程缓存状态机（HTTP 语义）───────────────────────────────────────────────

function metaPathFor(url: string): string {
  return join(ROOT, ".markopress", "cache", "images", require_sha1(url), "meta.json");
}

// images.ts 的 remoteKey 是 sha1(url)（模块私有）——用 node:crypto 同算
import { createHash } from "node:crypto";
function require_sha1(url: string): string {
  return createHash("sha1").update(url).digest("hex");
}

function pngResponse(bytes: Buffer, headers: Record<string, string> = {}): Response {
  return new Response(new Uint8Array(bytes), { status: 200, headers: { "content-type": "image/png", ...headers } });
}

describe("fetchRemoteCached", () => {
  it("冷拉：写字节 + meta，返回缓冲", async () => {
    const bytes = await pngBytes();
    const fn = fetchStub(() => pngResponse(bytes, { etag: '"v1"' }));
    const remote = await fetchRemoteCached("https://allowed.example.com/cold.png");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(remote.ext).toBe(".png");
    expect(remote.buffer.equals(bytes)).toBe(true);
    const meta = JSON.parse(readFileSync(metaPathFor("https://allowed.example.com/cold.png"), "utf-8"));
    expect(meta.etag).toBe('"v1"');
    expect(meta.contentSha).toBe(remote.contentSha);
  });

  it("新鲜期（max-age）零请求", async () => {
    const url = "https://allowed.example.com/fresh.png";
    const fn = fetchStub(async () => pngResponse(await pngBytes(), { "cache-control": "max-age=3600" }));
    await fetchRemoteCached(url);
    __testResetCaches(); // 清 60s memo，验证 freshness 本身
    const again = await fetchRemoteCached(url);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(again.buffer.length).toBeGreaterThan(0);
  });

  it("过期 + etag：条件请求 304 → 复用缓存（fetchedAt 续期）", async () => {
    const url = "https://allowed.example.com/etag.png";
    const fn = fetchStub((_u, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (headers["if-none-match"] === '"v1"') return new Response(null, { status: 304 });
      return pngResponse(pngBytesSync, { etag: '"v1"' });
    });
    await fetchRemoteCached(url);
    // 手工过期
    const file = metaPathFor(url);
    const meta = JSON.parse(readFileSync(file, "utf-8"));
    meta.fetchedAt = 0;
    writeFileSync(file, JSON.stringify(meta));
    __testResetCaches();
    const remote = await fetchRemoteCached(url);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(remote.contentSha).toBe(meta.contentSha); // 字节未换
    const renewed = JSON.parse(readFileSync(file, "utf-8"));
    expect(renewed.fetchedAt).toBeGreaterThan(0);
  });

  it("过期 + 200：字节与 meta 替换", async () => {
    const url = "https://allowed.example.com/replace.png";
    const secondBytes = await pngBytes(320, 240, { r: 1, g: 2, b: 3 });
    let call = 0;
    const fn = fetchStub(() => {
      call += 1;
      return call === 1
        ? pngResponse(pngBytesSync, { etag: '"a"' })
        : pngResponse(secondBytes, { etag: '"b"' });
    });
    const first = await fetchRemoteCached(url);
    expect(first.contentSha).not.toBe("");
    // 手工过期 + 清验证器 → 无条件重拉
    const file = metaPathFor(url);
    const meta = JSON.parse(readFileSync(file, "utf-8"));
    meta.fetchedAt = 0;
    meta.etag = undefined;
    meta.lastModified = undefined;
    writeFileSync(file, JSON.stringify(meta));
    __testResetCaches();
    const remote = await fetchRemoteCached(url);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(remote.buffer.equals(secondBytes)).toBe(true);
    expect(JSON.parse(readFileSync(file, "utf-8")).etag).toBe('"b"');
  });

  it("重验失败 + 有缓存 → 陈旧降级", async () => {
    const url = "https://allowed.example.com/stale-ok.png";
    fetchStub(() => pngResponse(pngBytesSync, { "cache-control": "max-age=1" }));
    await fetchRemoteCached(url);
    vi.unstubAllGlobals();
    fetchStub(() => {
      throw new Error("network down");
    });
    const file = metaPathFor(url);
    const meta = JSON.parse(readFileSync(file, "utf-8"));
    meta.fetchedAt = 0;
    writeFileSync(file, JSON.stringify(meta));
    __testResetCaches();
    const remote = await fetchRemoteCached(url);
    expect(remote.buffer.equals(pngBytesSync)).toBe(true);
  });

  it("无缓存 + 失败 → throw（build 期硬失败的根源）", async () => {
    fetchStub(() => {
      throw new Error("network down");
    });
    await expect(fetchRemoteCached("https://allowed.example.com/no-cache.png")).rejects.toThrow(/network down/);
  });

  it("不支持的 content-type → 不可重试错误", async () => {
    fetchStub(() => new Response("nope", { status: 200, headers: { "content-type": "text/html" } }));
    await expect(fetchRemoteCached("https://allowed.example.com/html.png")).rejects.toThrow(/不支持的类型/);
  });
});

// png 夹具的同步形态（describe 体外先造一份复用）
const pngBytesSync = await pngBytes(200, 150);

// ── 解析回填三态 ─────────────────────────────────────────────────────────────

function htmlSegment(html: string): Array<{ type: string; html: string }> {
  return [{ type: "html", html }];
}

describe("resolveImageSegments", () => {
  it("本地 tag：产物 html 原位回填", async () => {
    const dir = join(ROOT, "fixture");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "local.png"), pngBytesSync);
    const tag = {
      token: "<!--MPIMG0-->",
      raw: '<mp-image src="local.png" alt="本地"/>',
      attrs: { src: "local.png", alt: "本地" },
      origin: "tag" as const,
    };
    const segments = htmlSegment(`<p>x</p><!--MPIMG0--><p>y</p>`);
    await resolveImageSegments(segments, [tag], dir, settings());
    expect(segments[0].html).toContain('class="mp-image mp-image--responsive"');
    expect(segments[0].html).not.toContain("MPIMG");
  });

  it("未授权远程 tag：直通 <img>（非原始标签回填）", async () => {
    const tag = {
      token: "<!--MPIMG0-->",
      raw: '<mp-image src="https://evil.com/x.png" alt="远"/>',
      attrs: { src: "https://evil.com/x.png", alt: "远" },
      origin: "tag" as const,
    };
    const segments = htmlSegment("<!--MPIMG0-->");
    await resolveImageSegments(segments, [tag], join(ROOT), settings());
    expect(segments[0].html).toContain('<img src="https://evil.com/x.png" alt="远"');
  });

  it("md 来源 + 本地缺失：回填直通 <img>（不字面显示 md 语法）", async () => {
    const tag = {
      token: "<!--MPIMG0-->",
      raw: "![alt](missing.png)",
      attrs: { src: "missing.png", alt: "alt" },
      origin: "md" as const,
    };
    const segments = htmlSegment("<!--MPIMG0-->");
    await resolveImageSegments(segments, [tag], join(ROOT), settings());
    expect(segments[0].html).toContain('<img src="missing.png" alt="alt"');
  });

  it("link 属性（#11）：div 内包原图 <a>；缺省不包、link=false 显式关", async () => {
    const dir = join(ROOT, "fixture");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "linked.png"), pngBytesSync);
    const linked = {
      token: "<!--MPIMG0-->",
      raw: "",
      attrs: { src: "linked.png", alt: "x", link: "true" },
      origin: "tag" as const,
    };
    const segments = htmlSegment("<!--MPIMG0-->");
    await resolveImageSegments(segments, [linked], dir, settings());
    const html = segments[0].html;
    expect(html).toContain('<a class="mp-image-link" href="/_markopress/image/');
    expect(html).toContain('target="_blank" rel="noopener"');
    // 层序：div.mp-image > a.mp-image-link > img（与 gatsby wrapper > link > img 对位）
    expect(html.indexOf('<a class="mp-image-link"')).toBeGreaterThan(html.indexOf('<div class="mp-image'));
    expect(html).toMatch(/<\/a><\/div>$/);

    const plain = { ...linked, token: "<!--MPIMG1-->", attrs: { src: "linked.png", alt: "x" } };
    const off = { ...linked, token: "<!--MPIMG2-->", attrs: { src: "linked.png", alt: "x", link: "false" } };
    const more = htmlSegment("<!--MPIMG1-->\n<!--MPIMG2-->");
    await resolveImageSegments(more, [plain, off], dir, settings());
    expect(more[0].html).not.toContain("<a ");
  });

  it("授权远程（mock fetch）：变体 + picture（formats 含 avif）", async () => {
    fetchStub(() => pngResponse(pngBytesSync, { "cache-control": "max-age=3600" }));
    const tag = {
      token: "<!--MPIMG0-->",
      raw: "![x](https://allowed.example.com/a.png)",
      attrs: { src: "https://allowed.example.com/a.png", alt: "x" },
      origin: "md" as const,
    };
    const segments = htmlSegment("<!--MPIMG0-->");
    await resolveImageSegments(segments, [tag], join(ROOT), settings({ formats: ["avif", "webp"] }));
    expect(segments[0].html).toContain("<picture>");
    expect(segments[0].html).toContain('type="image/avif"');
    expect(segments[0].html).toContain("/_markopress/image/");
  });

  it("build 期：无缓存的远程失败硬炸（dev 软降级对照）", async () => {
    process.env.MARKOPRESS_PHASE = "build";
    fetchStub(() => {
      throw new Error("network down");
    });
    const tag = {
      token: "<!--MPIMG0-->",
      raw: "![x](https://allowed.example.com/dead.png)",
      attrs: { src: "https://allowed.example.com/dead.png", alt: "x" },
      origin: "md" as const,
    };
    await expect(
      resolveImageSegments(htmlSegment("<!--MPIMG0-->"), [tag], join(ROOT), settings()),
    ).rejects.toThrow(/network down/);
  });
});

// ── 组件入口（页面侧 <mp-image>）────────────────────────────────────────────

describe("resolveImageTagHtml（组件服务端入口）", () => {
  it("读设置文件（Set 还原）+ 授权远程解析出产物 html", async () => {
    mkdirSync(join(ROOT, ".markopress"), { recursive: true });
    writeFileSync(
      IMAGES_SETTINGS_FILE,
      JSON.stringify({ domains: ["allowed.example.com"], remotePatterns: [], markdown: false, formats: ["avif", "webp"] }),
    );
    fetchStub(() => pngResponse(pngBytesSync, { "cache-control": "max-age=3600" }));
    const html = await resolveImageTagHtml({ src: "https://allowed.example.com/comp.png", alt: "组件", width: 200 });
    expect(html).toContain("<picture>");
    expect(html).toContain('type="image/avif"');
    // 设置文件读取层：domains 还原为 Set
    const loaded = loadImagesSettings();
    expect(loaded.domains instanceof Set).toBe(true);
    expect(loaded.domains.has("allowed.example.com")).toBe(true);
  });

  it("未授权远程 → 直通 <img>；缺 src → throw", async () => {
    mkdirSync(join(ROOT, ".markopress"), { recursive: true });
    writeFileSync(
      IMAGES_SETTINGS_FILE,
      JSON.stringify({ domains: [], remotePatterns: [], markdown: false, formats: ["webp"] }),
    );
    const passthrough = await resolveImageTagHtml({ src: "https://evil.com/x.png", alt: "y" });
    expect(passthrough).toContain('<img src="https://evil.com/x.png"');
    await expect(resolveImageTagHtml({ alt: "no src" })).rejects.toThrow(/missing src/);
  });

  it("无设置文件 → v1 默认（无授权域）", () => {
    rmSync(IMAGES_SETTINGS_FILE, { force: true });
    __testResetCaches();
    const loaded = loadImagesSettings();
    expect(loaded.formats).toEqual(["webp"]);
    expect(loaded.domains.size).toBe(0);
    expect(loaded.markdown).toBe(false);
  });
});

// ── 占位三态 / 格式面（经由 resolveImageSegments 全链路）─────────────────────

describe("占位与格式", () => {
  it("placeholder=color 输出主色背景，无 data URI", async () => {
    const dir = join(ROOT, "fixture-color");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "c.png"), await pngBytes(200, 150, { r: 10, g: 20, b: 30 }));
    const tag = {
      token: "<!--MPIMG0-->",
      raw: "",
      attrs: { src: "c.png", alt: "", placeholder: "color" },
      origin: "tag" as const,
    };
    const segments = htmlSegment("<!--MPIMG0-->");
    await resolveImageSegments(segments, [tag], dir, settings());
    expect(segments[0].html).toMatch(/background-color:rgb\(\d+,\d+,\d+\)/);
    expect(segments[0].html).not.toContain("data:image");
  });

  it("单 webp = v1 <img srcset> 形状；含 avif = <picture>", async () => {
    const dir = join(ROOT, "fixture-fmt");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "f.png"), pngBytesSync);
    const mk = () => [{ type: "html", html: "<!--MPIMG0-->" }];
    const single = {
      token: "<!--MPIMG0-->", raw: "", attrs: { src: "f.png", alt: "" }, origin: "tag" as const,
    };
    let segments = mk();
    await resolveImageSegments(segments, [single], dir, settings()); // 默认 ["webp"]
    expect(segments[0].html).toContain("<img ");
    expect(segments[0].html).not.toContain("<picture>");
    const multi = {
      token: "<!--MPIMG0-->", raw: "", attrs: { src: "f.png", alt: "", formats: "avif,webp" }, origin: "tag" as const,
    };
    segments = mk();
    await resolveImageSegments(segments, [multi], dir, settings());
    expect(segments[0].html).toContain("<picture>");
    expect(existsSync(join(ROOT, "public", "_markopress", "image"))).toBe(true);
  });
});

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { compileSync } from "@marko/compiler";
import { rspack } from "@rspack/core";
import { JSDOM } from "jsdom";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";

const root = mkdtempSync(join(tmpdir(), "mp-image-modules-"));
process.env.MARKOPRESS_ROOT = root;
const { IMAGE_MODULE_PREFIX, renderImageModule } = await import("../src/image-modules.ts");
const { resolveImageTagHtml, __testResetCaches } = await import("../src/images.ts");
const { mpRspack } = await import("../src/rspack-shared.ts");
const { markopressPlugin } = await import("../src/markopress-plugin.ts");
const engine = dirname(import.meta.dirname);
const require = createRequire(import.meta.url);
const packRequire = createRequire(import.meta.resolve("@markopack/rspack"));
const loader = join(dirname(packRequire.resolve("@markopack/compiler")), "marko-loader.js");
const fixtureDir = mkdtempSync(join(engine, "tests", "image-fixture-"));
mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public", "known.png"), await sharp({ create: {
  width: 64, height: 32, channels: 3, background: "red",
} }).png().toBuffer());
const image = '<mp-image src="/known.png" alt="known & safe" width=32 placeholder="none" densities=[1,2]/>';
const attrs = { src: "/known.png", alt: "known & safe", width: 32, placeholder: "none", densities: [1, 2] };
const id = IMAGE_MODULE_PREFIX + Buffer.from(JSON.stringify(attrs)).toString("base64url");

function compile(source: string, output: "html" | "dom" | "hydrate") {
  return compileSync(source, join(fixtureDir, `${output}.marko`), {
    output, translator: "@marko/runtime-tags/translator", babelrc: false, configFile: false,
    resolveVirtualDependency: (_from, dep) => dep.virtualPath,
  });
}

async function bundle(name: string, source: string, output: "html" | "dom") {
  const file = join(fixtureDir, `${name}.marko`);
  writeFileSync(file, source);
  const entry = join(fixtureDir, `${name}.js`);
  writeFileSync(entry, output === "dom"
    ? `import template from ${JSON.stringify(file)}; window.imageTemplate = template;`
    : `import template from ${JSON.stringify(file)}; export default template;`);
  const config: any = {
    mode: "development", context: engine, target: output === "dom" ? "web" : "node",
    entry, devtool: false, output: { path: join(root, name), filename: "bundle.js",
      ...(output === "html" ? { library: { type: "commonjs2" } } : {}) },
    module: { rules: [{ test: /\.marko$/, use: [{ loader, options: { output } }] }] }, plugins: [],
  };
  mpRspack()(config, output === "dom" ? "browser" : "server");
  const compiler = rspack(config);
  const stats: any = await new Promise((resolve, reject) => compiler.run((err, stats) => err ? reject(err) : resolve(stats)));
  await new Promise<void>((resolve, reject) => compiler.close(err => err ? reject(err) : resolve()));
  expect(stats.toJson({ all: false, errors: true }).errors).toEqual([]);
  return { code: readFileSync(join(root, name, "bundle.js"), "utf8"), file: join(root, name, "bundle.js") };
}

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(fixtureDir, { recursive: true, force: true });
});

describe("build-known images in client-created subtrees", () => {
  it("uses the public compiler transform and prunes ordinary page hydration", () => {
    expect(compile(image, "hydrate").code.trim()).toBe("");
    const branch = compile(`<let/open=false><button onClick(){open=true}>go</button><if=open>${image}</if>`, "dom").code;
    expect(branch).toContain(IMAGE_MODULE_PREFIX);
    expect(branch).not.toContain("resolveImageTagHtml");
    expect(branch).not.toContain("images.ts");
  });

  it("never evaluates dynamic bindings or spreads as build-known props", () => {
    for (const source of ['<mp-image src=input.src/>', '<mp-image ...input/>', '<mp-image src="/known.png" alt=input.alt/>']) {
      const html = compile(source, "html").code;
      expect(html).not.toContain(IMAGE_MODULE_PREFIX);
      expect(html).toContain("mp-image.marko");
    }
  });

  it("precomputes via the existing image pipeline and registers local source watches", async () => {
    const watched: string[] = [];
    const source = await renderImageModule(id, file => watched.push(file));
    expect(JSON.parse(source.slice("export default ".length, -2))).toBe(await resolveImageTagHtml(attrs));
    expect(watched).toContain(join(root, "public", "known.png"));
    expect(source).not.toMatch(/node:|sharp|process\.env/);
    const first = source;
    writeFileSync(join(root, "public", "known.png"), await sharp({ create: {
      width: 64, height: 32, channels: 3, background: "blue",
    } }).png().toBuffer());
    __testResetCaches();
    expect(await renderImageModule(id)).not.toBe(first);
  });

  it("Vite resolves and loads the same public image module", async () => {
    const plugin: any = markopressPlugin();
    const resolved = plugin.resolveId(id);
    expect(resolved).toBe("\0" + id);
    const watches: string[] = [];
    expect(await plugin.load.call({ addWatchFile(file: string) { watches.push(file); } }, resolved))
      .toBe(await renderImageModule(id));
    expect(watches).toContain(join(root, "public", "known.png"));
  });

  it("Rspack bundles a closed branch and empty keyed loop, then browser creates/removes/recreates images", async () => {
    const source = `<let/open=false><let/items=[]>
<button onClick(){open=!open;items=open ? [1,2] : []}>toggle</button>
<if=open>${image}</if>
<for|item| of=items by=(item)=>item><section data-item=item>${image}</section></for>`;
    const { code } = await bundle("client", source, "dom");
    expect(code).not.toContain("resolveImageTagHtml");
    expect(code).not.toContain("sharp");
    const dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only", pretendToBeVisual: true, url: "https://image-fixture.test/" });
    // jsdom lacks MessageChannel; match browser task ordering without Node ports
    // that would keep the test worker alive after window.close().
    (dom.window as any).MessageChannel = class {
      port1 = { onmessage() {} };
      port2 = { postMessage: () => dom.window.setTimeout(() => this.port1.onmessage(), 0) };
    };
    try {
      dom.window.eval(code);
      (dom.window as any).imageTemplate.mount({}, dom.window.document.body);
      const tick = () => new Promise(resolve => dom.window.setTimeout(resolve, 40));
      expect(dom.window.document.querySelectorAll("img")).toHaveLength(0);
      for (const count of [3, 0, 3]) {
        dom.window.document.querySelector("button")!.click();
        await tick();
        const images = [...dom.window.document.querySelectorAll("img")];
        expect(images).toHaveLength(count);
        for (const img of images) {
          expect(img.getAttribute("srcset")).toContain("64w");
          expect(img.getAttribute("alt")).toBe("known & safe");
          expect(img.getAttribute("src")).toContain("/_markopress/image/");
        }
      }
    } finally { dom.window.close(); }
  }, 30000);

  it("Rspack SSR renders the same optimized HTML with no async replacement script", async () => {
    const { file } = await bundle("server", image, "html");
    const template = require(file).default;
    const html = await template.render({});
    expect(String(html)).toContain(await resolveImageTagHtml(attrs));
    expect(String(html)).not.toContain("<script");
  }, 30000);
});

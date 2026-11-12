import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { compileSync } from "@marko/compiler";
import { rspack } from "@rspack/core";

const fixture = await vi.hoisted(async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  return { root: mkdtempSync(join(tmpdir(), "mp-collection-content-")), synced: undefined as any };
});
vi.mock("../src/content.ts", () => ({
  ROOT: fixture.root,
  COMPONENTS_DIR: join(fixture.root, ".markopress/components"),
  CONFIG_FILE: join(fixture.root, ".markopress/config.ts"),
  STORE_DIR: join(fixture.root, ".markopress/store"),
  VIRTUAL_PREFIX: "virtual:mp/content/",
  ensureSynced: async () => fixture.synced,
  resetSynced: vi.fn(),
}));
vi.mock("../src/paths.ts", () => ({ ROOT: fixture.root, PAGES_DIR: join(fixture.root, "pages") }));
vi.mock("../src/gen-routes.ts", () => ({ generateRoutes: async () => ({ routes: [], written: [] }) }));
vi.mock("../src/images-owners.ts", () => ({
  entryAssetDigest: async () => "",
  resolveEntryDir: async () => undefined,
  assetOwners: async () => [],
}));

import {
  collectionContentModuleFile,
  collectionModuleFile,
  contentModuleFile,
  contentMetaFile,
  renderCollectionContentModule,
  renderCollectionModule,
  writeContentModules,
} from "../src/content-modules.ts";
import { markopressPlugin } from "../src/markopress-plugin.ts";
import { mpRspack } from "../src/rspack-shared.ts";

const makeEntry = (id: string, body = `Body ${id}`, slug = id) => ({
  id, slug, body, contentType: "text/markdown", digest: `${id}:${body}`,
  data: { title: id },
});
let entries: ReturnType<typeof makeEntry>[];

beforeEach(() => {
  rmSync(join(fixture.root, ".markopress"), { recursive: true, force: true });
  entries = [makeEntry("index"), makeEntry("nested/v1", "Body one", "v1")];
  fixture.synced = {
    config: { collections: { changelog: { route: false, loader: { watchDirs: [join(fixture.root, "content")] } } } },
    store: {
      collections: new Set(["changelog"]),
      values: (collection: string) => collection === "changelog" ? entries : [],
      get: (collection: string, id: string) => collection === "changelog" ? entries.find((e) => e.id === id) : undefined,
    },
    renderer: {
      render: async ({ body }: { body: string }) => ({
        segments: [{ type: "html", html: `<p>${body}</p>` }],
        headings: [{ depth: 2, slug: "heading", text: "Heading" }],
      }),
    },
    images: { markdown: false }, plugins: [], pluginCtx: {}, pluginsReady: Promise.resolve(),
    syncer: { syncFile: vi.fn(async () => ({ changed: [{ collection: "changelog", id: "index" }], removed: [] })) },
  };
});
afterAll(() => rmSync(fixture.root, { recursive: true, force: true }));

function hook(plugin: any, name: string) {
  const value = plugin[name];
  return typeof value === "function" ? value.bind(plugin) : value.handler.bind(plugin);
}

describe("opt-in collection content", () => {
  it("aggregates content by reference, preserves slugs/nested IDs, and leaves metadata body-free", () => {
    const source = renderCollectionContentModule("changelog", entries);
    expect(source).toContain('import { data as data1, segments as segments1, headings as headings1 } from "virtual:mp/content/changelog/nested/v1";');
    expect(source).toContain('{ id: "nested/v1", slug: "v1", data: data1, segments: segments1, headings: headings1 }');
    expect(source).not.toContain("Body one");
    expect(renderCollectionContentModule("changelog", [])).toContain("export const entries = []");
    const metadata = renderCollectionModule("changelog", entries);
    expect(metadata).toContain("virtual:mp/meta/changelog/nested/v1");
    expect(metadata).not.toMatch(/segments|virtual:mp\/content\/|collection-content/);
  });

  it("writes both aggregates, edits only entry modules, updates membership, and cleans removed collections", async () => {
    const bodyFile = collectionContentModuleFile("changelog");
    const metaFile = collectionModuleFile("changelog");
    expect(bodyFile).not.toBe(contentModuleFile("changelog", "index"));
    const full = await writeContentModules();
    expect(full.written).toEqual(expect.arrayContaining([bodyFile, metaFile]));
    expect(readFileSync(bodyFile, "utf8")).toBe(renderCollectionContentModule("changelog", entries));
    expect((await writeContentModules()).written).toEqual([]);

    entries[1] = makeEntry("nested/v1", "Body edited", "v1");
    const edit = await writeContentModules({ changed: [{ collection: "changelog", id: "nested/v1" }] });
    expect(edit.written).toEqual([contentModuleFile("changelog", "nested/v1")]);
    expect(readFileSync(contentModuleFile("changelog", "nested/v1"), "utf8")).toContain("Body edited");
    expect(readFileSync(contentMetaFile("changelog", "nested/v1"), "utf8")).not.toContain("Body edited");

    entries.push(makeEntry("new"));
    const add = await writeContentModules({ changed: [{ collection: "changelog", id: "new" }] });
    expect(add.written).toEqual(expect.arrayContaining([bodyFile, metaFile]));
    entries = [];
    const remove = await writeContentModules({ removed: ["index", "nested/v1", "new"].map((id) => ({ collection: "changelog", id })) });
    expect(remove.removed).toEqual(expect.arrayContaining([contentModuleFile("changelog", "new"), contentMetaFile("changelog", "new")]));
    expect(readFileSync(bodyFile, "utf8")).toContain("export const entries = []");
    fixture.synced.config.collections = {};
    const cleanup = await writeContentModules();
    expect(cleanup.removed).toEqual(expect.arrayContaining([bodyFile, metaFile]));
    expect(existsSync(bodyFile)).toBe(false);
  });

  it("retains the existing plugin data and component-segment render pipeline", async () => {
    entries = [makeEntry("component", 'Before\n\n```marko\n<strong>component</strong>\n```\n\nAfter')];
    fixture.synced.plugins = [{ name: "collection-test", pageData: async () => ({ extra: "plugin-data" }) }];
    await writeContentModules();
    const source = readFileSync(contentModuleFile("changelog", "component"), "utf8");
    expect(source).toContain('"extra":"plugin-data"');
    expect(source).toContain('"virtual:mp/segment/changelog/component/0"');
    expect(source).toContain('"type": "component", "component": seg0');
    expect(readFileSync(collectionContentModuleFile("changelog"), "utf8")).toContain("segments: segments0");
  });

  it("resolves and loads both Vite APIs, rejects unknown collections, and invalidates both aggregates", async () => {
    const plugin = markopressPlugin();
    const resolve = hook(plugin, "resolveId");
    const load = hook(plugin, "load");
    const contentId = resolve("virtual:mp/collection-content/changelog");
    const metaId = resolve("virtual:mp/collection/changelog");
    expect(contentId).toBe("\0virtual:mp/collection-content/changelog");
    expect(await load(contentId)).toBe(renderCollectionContentModule("changelog", entries));
    expect(await load(metaId)).toBe(renderCollectionModule("changelog", entries));
    await expect(load(resolve("virtual:mp/collection-content/missing"))).rejects.toThrow('no collection "missing"');

    await hook(plugin, "config")({}, { command: "serve" });
    let onEvent: any;
    const server = {
      watcher: { add: vi.fn(), on: (_event: string, cb: any) => { onEvent = cb; } },
      moduleGraph: { getModuleById: (id: string) => ({ id }), invalidateModule: vi.fn() },
      ws: { send: vi.fn() }, config: { logger: { error: vi.fn() } },
    };
    hook(plugin, "configureServer")(server);
    onEvent("change", join(fixture.root, "content/index.md"));
    await vi.waitFor(() => expect(server.ws.send).toHaveBeenCalled());
    expect(server.moduleGraph.invalidateModule).toHaveBeenCalledWith({ id: contentId });
    expect(server.moduleGraph.invalidateModule).toHaveBeenCalledWith({ id: metaId });
  });

  it("invalidates loaded empty aggregates after full config removal", async () => {
    entries = [];
    const plugin = markopressPlugin();
    const contentId = hook(plugin, "resolveId")("virtual:mp/collection-content/changelog");
    const metaId = hook(plugin, "resolveId")("virtual:mp/collection/changelog");
    expect(await hook(plugin, "load")(contentId)).toContain("export const entries = []");
    await hook(plugin, "load")(metaId);
    await hook(plugin, "config")({}, { command: "serve" });
    let onEvent: any;
    const server = {
      watcher: { add: vi.fn(), on: (_event: string, cb: any) => { onEvent = cb; } },
      moduleGraph: { getModuleById: (id: string) => ({ id }), invalidateModule: vi.fn() },
      ws: { send: vi.fn() }, config: { logger: { error: vi.fn() } },
    };
    hook(plugin, "configureServer")(server);
    fixture.synced.config.collections = {};
    fixture.synced.store.collections.clear();
    onEvent("change", join(fixture.root, ".markopress/config.ts"));
    await vi.waitFor(() => expect(server.ws.send).toHaveBeenCalled());
    expect(server.config.logger.error).not.toHaveBeenCalled();
    expect(server.moduleGraph.invalidateModule).toHaveBeenCalledWith({ id: contentId });
    expect(server.moduleGraph.invalidateModule).toHaveBeenCalledWith({ id: metaId });
    await expect(hook(plugin, "load")(contentId)).rejects.toThrow('no collection "changelog"');
  });

  it("rewrites the opt-in Rspack request to its own generated directory", async () => {
    const config: any = { plugins: [] };
    mpRspack()(config, "server");
    const replacement = config.plugins.find((p: any) => p instanceof rspack.NormalModuleReplacementPlugin);
    let options: any;
    replacement.apply({ __internal__registerBuiltinPlugin: (plugin: any) => { options = plugin.options; } });
    expect(options.resourceRegExp.test("virtual:mp/collection-content/changelog")).toBe(true);
    for (const [request, expected] of [
      ["virtual:mp/collection-content/changelog", collectionContentModuleFile("changelog")],
      ["virtual:mp/collection/changelog", collectionModuleFile("changelog")],
    ]) {
      const resource = { request };
      options.newResource(resource);
      expect(resource.request).toBe(expected);
    }
  });

  it("Marko server import emits the aggregate only for SSR, including in an interactive page", () => {
    const source = [
      'server import { entries } from "virtual:mp/collection-content/changelog"',
      '<let/count=0/>',
      '<button onClick() { count++ }>Clicks ${count}</button>',
      '<for|entry| of=entries>',
      '  <article><for|seg| of=entry.segments><if=seg.type === "html">$!{seg.html}</if><else><${seg.component}/></else></for></article>',
      '</for>',
    ].join("\n");
    const filename = join(import.meta.dirname, "collection-content-fixture.marko");
    const html = compileSync(source, filename, { output: "html" }).code;
    const dom = compileSync(source, filename, { output: "dom" }).code;
    expect(html).toContain("virtual:mp/collection-content/changelog");
    expect(dom).not.toContain("virtual:mp/collection-content/changelog");
    expect(dom).not.toMatch(/entry\.segments|seg\.html/);
  });

  it("纯数据 entry（无 body，契约 body 可选）：segments/headings 空数组而非报错", async () => {
    const cats = [{ id: "API", slug: "API", data: { name: "API" }, digest: "api" }];
    fixture.synced.config.collections = {
      changelog: fixture.synced.config.collections.changelog,
      categories: { route: false, loader: {} },
    };
    fixture.synced.store.collections = new Set(["changelog", "categories"]);
    fixture.synced.store.values = (c: string) =>
      c === "changelog" ? entries : c === "categories" ? cats : [];
    fixture.synced.store.get = (c: string, id: string) =>
      (c === "changelog" ? entries : c === "categories" ? cats : []).find((e) => e.id === id);
    const full = await writeContentModules();
    const module = readFileSync(contentModuleFile("categories", "API"), "utf8");
    expect(module).toContain("export const segments = []");
    expect(module).toContain("export const headings = []");
    expect(module).toContain('"name":"API"');
    expect(full.written).toEqual(expect.arrayContaining([
      contentMetaFile("categories", "API"),
      collectionModuleFile("categories"),
      collectionContentModuleFile("categories"),
    ]));
  });

  it("有 body 但 contentType 无渲染器：仍然 fail fast", async () => {
    entries = [{ id: "x", slug: "x", body: "b", contentType: "text/custom", digest: "d", data: {} }] as any;
    await expect(writeContentModules()).rejects.toThrow(/no renderer for contentType text\/custom/);
  });
});

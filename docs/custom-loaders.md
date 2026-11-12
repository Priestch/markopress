# 自定义内容 loader

> 何时读：内置两个 loader 覆盖不了你的数据源——`glob`（本地文件目录）、`strapi`
> （Strapi REST）之外的产品 REST API、数据库、其他 Headless CMS。契约的语义与
> 不变式见 `packages/engine/CONTRACT.md`；本文只讲怎么写。

## 心智模型

一个 loader = 「把**外部数据源的当前状态**写进一个集合的 scoped store」：

```ts
import { defineLoader } from "markopress";

export const myRest = defineLoader({
  name: "my-rest",
  async load(ctx) {
    const seen = new Set<string>();
    // 1) 拉数据（全量；分页自己翻完）
    // 2) 逐条：digest 命中跳过 → ctx.parseData → ctx.store.set
    // 3) 结束后：删除本轮没见到的 id（差集）
  },
});
```

写进 store 的每条 entry：`{ id, slug?, data, body?, contentType?, digest? }`。
两条铁律：

- `data` 必须经 `ctx.parseData({ id, data })`——它会过集合的 zod schema，错误带
  entry 坐标；不过 schema 的数据进不了 store。
- 带 markdown 正文的源把**原始 md** 放 `body` + `contentType: "text/markdown"`
  （渲染、图片处理、frontmatter 剥离由框架接管）。body 存源文本，不要预渲染 HTML。

## 完整范例：`{ items: [...] }` 形状的 REST 列表源

```ts
import { defineLoader, type Loader } from "markopress";

export interface MyRestOptions {
  baseUrl: string;        // 如 https://api.example.com
  token?: string;         // 只从环境变量读，不要写字面量
  pageSize?: number;
}

export function myRest(options: MyRestOptions): Loader {
  if (!options.baseUrl) throw new Error("[my-rest] options.baseUrl 必填");
  return defineLoader({
    name: "my-rest",
    async load(ctx) {
      const seen = new Set<string>();
      let page = 1;
      for (;;) {
        const res = await fetch(
          `${options.baseUrl}/articles?page=${page}&size=${options.pageSize ?? 100}`,
          { headers: options.token ? { Authorization: `Bearer ${options.token}` } : {} },
        );
        if (!res.ok) throw new Error(`[my-rest] ${res.status} ${res.url}`);
        const payload = (await res.json()) as { items?: Array<Record<string, unknown>>; pageCount?: number };
        for (const row of payload.items ?? []) {
          const id = String(row.id ?? "");
          if (!id) { ctx.logger.warn(`entry 缺 id，跳过：${JSON.stringify(row).slice(0, 120)}`); continue; }
          seen.add(id);

          // ① digest 命中跳过（失效三件套之一；整个 REST entry 参与指纹）
          const digest = ctx.generateDigest(row);
          if (ctx.store.get(id)?.digest === digest) continue;

          // ② md 正文：经 '.md' entryType 剥 frontmatter，与文件源同形
          let body: string | undefined;
          let frontmatter: Record<string, unknown> | undefined;
          const rawBody = row.content;
          if (typeof rawBody === "string" && rawBody.trim() !== "") {
            const entryType = ctx.entryTypes.get(".md");
            if (!entryType) throw new Error("[my-rest] 需要 '.md' entryType（引擎默认注入）");
            const info = await entryType.getEntryInfo({
              contents: rawBody,
              fileUrl: new URL(`file:///my-rest/${ctx.collection}/${id}.md`),
            });
            body = info.body;
            if (Object.keys(info.data).length > 0) frontmatter = info.data;
          }

          // ③ zod 入口 → store.set
          const data = await ctx.parseData({
            id,
            data: {
              title: row.title,
              ...(frontmatter ? { frontmatter } : {}),
            },
          });
          ctx.store.set({
            id,
            slug: typeof row.slug === "string" ? row.slug : id,
            data,
            ...(body !== undefined ? { body, contentType: "text/markdown" } : {}),
            digest,
          });
        }
        if (page >= (payload.pageCount ?? 1)) break;
        page += 1;
      }

      // ④ untouched 差集删除（失效三件套之二；loader 的策略）
      for (const id of ctx.store.keys()) {
        if (!seen.has(id)) ctx.store.delete(id);
      }
    },
  });
}
```

## 你免费获得的三件事（失效三件套）

1. **digest 跳过**：内容没变的条目不重解析不重渲染——重复 build 成本趋近于一次
   HTTP 拉取。
2. **差集删除**：只要你按范例记 `seen` 并做删除，远端删掉的条目自动从集合消失。
3. **配置指纹失效**：改集合 schema / 换 loader，store 自动全清重建，不会留脏类型。

## 增量与 watch（只有文件源需要）

REST/DB 源**不要**实现 `handleFileChange`/`watchDirs`——每次 sync 全量 `load` 即可。
文件型源（目录扫描）参考内置 `glob.ts`：`watchDirs` 告诉 app watcher 监听哪里，
`handleFileChange` 把单文件事件映射为 O(1) 的 store 增删。

## 在站点里接线

```ts
// .markopress/config.ts
import { defineCollection } from "markopress";
import { myRest } from "./src/loaders/my-rest.ts";   // 站点内模块，相对 import
import { z } from "zod";

export default defineMarkoPressConfig({
  collections: {
    articles: defineCollection({
      loader: myRest({ baseUrl: process.env.API_URL ?? "", token: process.env.API_TOKEN }),
      schema: z.object({ title: z.string(), frontmatter: z.record(z.string(), z.unknown()).optional() }),
      route: false,   // 列表型集合：不出 per-entry 路由，页面经 virtual:mp/collection/<name> 消费
    }),
  },
});
```

loader 可以是站点内模块（如上），也可以发独立 npm 包（此时 `name` 用包名，与内置
`glob`/`strapi` 同形——第三方 loader 与内置件地位完全平等）。

## 约束（依赖红线）

loader 运行在内容层，必须保持 framework-generic：只依赖 Node 内建与自身依赖
（如需 HTTP 就用全局 `fetch`），不得 import vite / marko / @marko/run。契约类型
（`Loader`/`LoaderContext` 等）从 `"markopress"` 或 `"markopress/content"` type-only
import。

## 测试

最简：dev 起一次（`.markopress/store/<collection>.json` 落盘即 sync 通过，坏数据看
报错坐标）。进阶：`MutableStore` + `PersistentMetaStore` + 内存 entryType 单测 loader
 本体，参照 `packages/engine/tests/content/helpers.ts` 的现成装配。

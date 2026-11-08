// sitemap 插件 —— app 级插件契约的第一个真实消费者（试金石 #1：API 诚实性试纸）。
//
// 契约：docs/plugin-design.md。本包刻意不 import app 的类型（@markopress/core 未抽，
// 结构化类型即可契约成立）——等 core 包落地后再换成显式类型依赖。
//
// 产出：路由 /sitemap.xml（handler 在 ./handler.ts）+ 数据模块 virtual:mp/plugin/sitemap。
// 增量性：URL 集只在 slug 增删时变；普通编辑下 urls 不变 → write-if-changed 吸收。
export interface SitemapOptions {
  /** 站点绝对地址（不带尾斜杠），如 "https://example.com" */
  site: string;
}

/** 与 markopress 的 MarkoPressPlugin 结构兼容的最小面（本插件只用到这几块） */
interface PluginHooks {
  name: string;
  contentSynced?(ctx: SitemapCtx, changed?: unknown): Promise<void>;
  routes?(ctx: SitemapCtx): Array<{ path: string; handlerModule: string; verbs: Array<"GET"> }>;
}

interface SitemapCtx {
  config: { collections: Record<string, unknown> };
  store: { values(name: string): Array<{ id: string }> };
  /** route:false 的集合返回 null——跳过（无 per-entry URL 的条目不进 sitemap） */
  urlOf(collection: string, id: string): string | null;
  setData(name: string, value: unknown): Promise<void>;
}

export function sitemap(options: SitemapOptions): PluginHooks {
  return {
    name: "sitemap",

    routes: () => [
      { path: "/sitemap.xml", handlerModule: "markopress/sitemap-handler", verbs: ["GET"] },
    ],

    async contentSynced(ctx) {
      const urls = Object.keys(ctx.config.collections).flatMap((collection) =>
        ctx.store
          .values(collection)
          .map((entry) => ctx.urlOf(collection, entry.id))
          .filter((url): url is string => url !== null),
      );
      urls.sort();
      await ctx.setData("sitemap", { site: options.site, urls });
    },
  };
}

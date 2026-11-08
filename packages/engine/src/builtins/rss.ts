// rss 插件 —— R2 试金石 #2：内容聚合型插件数据（对照 sitemap 的纯 URL 集合）。
//
// 契约：docs/plugin-design.md。与 sitemap 同构（routes + contentSynced → setData +
// handler 读 virtual:mp/plugin/rss），差异在数据投影：每条 entry 携带
// title/link/date/description 而非只有 URL。
//
// 已知边界（刻意不做，避免 contentSynced 全站渲染）：
// - description 取 frontmatter 的 description 字段（schema 有就有），不做正文摘要
//   （那需要在 sync 期 ctx.render 全站，成本与惰性渲染设计冲突——未来若做，
//   应走 pageData 缓存或按需渲染的独立通道）。
// - date 取 frontmatter 的 dateField（默认 "date"）；无日期的条目排尾部、不输出
//   pubDate（RSS 2.0 允许 item 级 pubDate 缺省）。
export interface RssOptions {
  /** 站点绝对地址（不带尾斜杠），如 "https://example.com" */
  site: string;
  /** feed 标题；缺省用 site */
  title?: string;
  /** feed 描述（channel.description 必填，缺省空串） */
  description?: string;
  /** 聚合的集合名；缺省 = 全部集合 */
  collections?: string[];
  /** 条目数上限（截断在排序之后）；缺省 = 不限 */
  limit?: number;
  /** entry.data 里当作发布日期的字段名（ISO 或 yaml date）；默认 "date" */
  dateField?: string;
}

export interface RssItem {
  title: string;
  /** 相对路径（如 "/getting-started"）；handler 侧拼 site */
  path: string;
  /** ISO 字符串（store 的 Date 经 setData JSON 化）；无日期条目缺省 */
  date?: string;
  description?: string;
}

/** 与 markopress 的 MarkoPressPlugin 结构兼容的最小面（同 sitemap：不 import app 类型） */
interface PluginHooks {
  name: string;
  contentSynced?(ctx: RssCtx, changed?: unknown): Promise<void>;
  routes?(ctx: RssCtx): Array<{ path: string; handlerModule: string; verbs: Array<"GET"> }>;
}

interface RssCtx {
  config: { collections: Record<string, unknown> };
  store: {
    values(name: string): Array<{
      id: string;
      slug: string;
      data: Record<string, unknown>;
    }>;
  };
  urlOf(collection: string, id: string): string;
  setData(name: string, value: unknown): Promise<void>;
}

function toIso(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  return undefined;
}

export function rss(options: RssOptions): PluginHooks {
  const dateField = options.dateField ?? "date";
  return {
    name: "rss",

    routes: () => [
      { path: "/rss.xml", handlerModule: "markopress/rss-handler", verbs: ["GET"] },
    ],

    async contentSynced(ctx) {
      const collectionNames = options.collections ?? Object.keys(ctx.config.collections);
      const items: Array<RssItem & { sortKey: number }> = [];
      for (const collection of collectionNames) {
        for (const entry of ctx.store.values(collection)) {
          const date = toIso(entry.data[dateField]);
          items.push({
            title: typeof entry.data.title === "string" ? entry.data.title : entry.slug || entry.id,
            path: ctx.urlOf(collection, entry.id),
            ...(date ? { date } : {}),
            ...(typeof entry.data.description === "string"
              ? { description: entry.data.description }
              : {}),
            // 无日期排尾部；有日期取毫秒数（ISO 字符串直接比较也单调，但显式数值更稳）
            sortKey: date ? new Date(date).getTime() : Number.NEGATIVE_INFINITY,
          });
        }
      }
      items.sort((a, b) => b.sortKey - a.sortKey);
      const limited = (options.limit ? items.slice(0, options.limit) : items).map(
        ({ sortKey: _sortKey, ...item }) => item,
      );
      await ctx.setData("rss", {
        site: options.site,
        title: options.title ?? options.site,
        description: options.description ?? "",
        items: limited,
      });
    },
  };
}

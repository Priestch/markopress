// search 插件 —— R3 试金石 #3：本地全文搜索（MiniSearch）+ 第一个带 UI 槽位的插件。
//
// 契约：docs/plugin-design.md §5.3。三层分工（换搜索方案 = 换插件包，槽位不变）：
//   索引生产（本文件，服务端）：contentSynced → store 直建 → setData 序列化。
//     渲染走 ctx.render 共享 digest 缓存（与页面渲染零重复）——这是 store 常驻服务端
//     的架构红利：dev 即可搜索（Pagefind 类产物索引方案做不到，见 plugin-design.md §7）。
//   索引交付：virtual:mp/plugin/search 数据模块（本插件内部形状，非公共 API）。
//   UI：tags/mp-search.marko 实现 <mp-search> 保留槽位（theme-docs 顶栏预留位）。
//
// 增量：changed 轮 O(变更)——变更/删除页 discard 其节文档，变更页重渲染后 add，
// 其余文档不动；随后整体序列化一次（write-if-changed，无变化零文件事件）。
import MiniSearch from "minisearch";
import { SEARCH_OPTIONS, type SearchDoc } from "./search-options.ts";

export interface SearchOptions {
  /** 纳入索引的集合名；缺省 = 全部集合（perf 夹具这类大集合应显式排除） */
  collections?: string[];
  /** entry.data 里当作页面标题的字段名；默认 "title" */
  titleField?: string;
}

// 与 markopress 的 MarkoPressPlugin / PluginCtx / ContentChange 结构兼容的最小面
// （同 rss：不 import app 类型——插件包不反向依赖 app 的 scripts/）。
interface SearchEntry {
  id: string;
  slug: string;
  contentType?: string;
  body?: string;
  data: Record<string, unknown>;
}

interface SearchCtx {
  config: { collections: Record<string, unknown> };
  store: {
    values(name: string): Array<SearchEntry>;
    get(name: string, id: string): SearchEntry | undefined;
  };
  /** route:false 的集合返回 null——跳过（搜索结果点了没地方去） */
  urlOf(collection: string, id: string): string | null;
  render(entry: SearchEntry): Promise<{ segments: Array<{ type: string; html: string }> }>;
  setData(name: string, value: unknown): Promise<void>;
}

interface SearchContentChange {
  changed: Array<{ collection: string; id: string }>;
  removed: Array<{ collection: string; id: string }>;
}

/** 渲染后 html → 纯文本（去标签 + 基本实体解码 + 折叠空白；代码块内容保留可搜） */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// h2/h3（与 TOC 同层级）且带 id 的标题为节边界：h1 是页标题已入 title 字段，
// h4+ 留在节内文本。rehype-slug 保证渲染产物的 heading 都有 id（属性序不定，id 非首位也命中）。
const SECTION_RE = /<h([23])[^>]*?\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;

/**
 * 单页渲染 html → 节文档数组（纯函数，单测覆盖）。首个标题前的引言自成一节
 * （heading 空）；无 h2/h3 时整页一节。空节（纯空白文本）丢弃。
 */
export function buildSearchDocs(
  html: string,
  page: { collection: string; id: string; title: string; url: string },
): SearchDoc[] {
  const base = `${page.collection}/${page.id}`;
  const docs: SearchDoc[] = [];
  let slug = "";
  let heading = "";
  let start = 0;
  const push = (end: number) => {
    const text = htmlToText(html.slice(start, end));
    if (text) {
      docs.push({
        id: slug ? `${base}#${slug}` : base,
        url: slug ? `${page.url}#${slug}` : page.url,
        title: page.title,
        heading,
        text,
      });
    }
  };
  for (const match of html.matchAll(SECTION_RE)) {
    push(match.index ?? 0); // 上一节到本标题前为止
    start = (match.index ?? 0) + match[0].length; // 节文本从标题之后开始（标题入 heading 字段）
    slug = match[2];
    heading = htmlToText(match[3]);
  }
  push(html.length);
  return docs;
}

export function search(options: SearchOptions = {}) {
  const titleField = options.titleField ?? "title";
  let index: MiniSearch<SearchDoc> | undefined;
  /** pageKey（collection/id）→ 该页节文档 id 列表（增量轮 discard 用） */
  let sectionsOf = new Map<string, string[]>();

  return {
    name: "search",
    slots: ["mp-search"],

    async contentSynced(ctx: SearchCtx, changed?: SearchContentChange): Promise<void> {
      const names = new Set(options.collections ?? Object.keys(ctx.config.collections));

      const docsOf = async (collection: string, entry: SearchEntry): Promise<SearchDoc[]> => {
        const url = ctx.urlOf(collection, entry.id);
        // route:false 的集合无 per-entry URL——结果点了没地方去，跳过（渲染也省了）
        if (url === null) return [];
        const { segments } = await ctx.render(entry);
        const title =
          typeof entry.data[titleField] === "string"
            ? (entry.data[titleField] as string)
            : entry.slug || entry.id;
        return buildSearchDocs(segments.map((segment) => segment.html).join("\n"), {
          collection,
          id: entry.id,
          title,
          url,
        });
      };

      const discardPage = (pageKey: string) => {
        const ids = sectionsOf.get(pageKey);
        if (!ids) return;
        for (const id of ids) {
          // 不在索引里（重复事件/上一轮已丢）时 MiniSearch 会抛——幂等处理
          try {
            index?.discard(id);
          } catch {
            /* id already gone */
          }
        }
        sectionsOf.delete(pageKey);
      };

      if (!changed || !index) {
        // 全量轮：dev 启动 / config 变更后的重建（渲染缓存与页面共享，边际成本 = 分词+建索引）
        index = new MiniSearch<SearchDoc>(SEARCH_OPTIONS);
        sectionsOf = new Map();
        const docs: SearchDoc[] = [];
        for (const collection of names) {
          for (const entry of ctx.store.values(collection)) {
            const page = await docsOf(collection, entry);
            sectionsOf.set(`${collection}/${entry.id}`, page.map((doc) => doc.id));
            docs.push(...page);
          }
        }
        index.addAll(docs);
      } else {
        // 增量轮：O(变更)——slug 改名天然覆盖（旧 id 进 removed、新 id 进 changed）
        for (const { collection, id } of [...changed.changed, ...changed.removed]) {
          discardPage(`${collection}/${id}`);
        }
        for (const { collection, id } of changed.changed) {
          if (!names.has(collection)) continue;
          const entry = ctx.store.get(collection, id);
          if (!entry) continue;
          const page = await docsOf(collection, entry);
          sectionsOf.set(`${collection}/${id}`, page.map((doc) => doc.id));
          index.addAll(page);
        }
      }
      await ctx.setData("search", { index: index.toJSON() });
    },
  };
}

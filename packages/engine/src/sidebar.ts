// 侧边栏数据派生（共享层纯函数）——store entries → 侧边栏树 + prev/next 平铺序。
//
// 数据流：gen-routes（全量/批末）调用 → .markopress/sidebar.json（tree 给 mp-layout，
// flat 给 page-nav.js 的邻居计算）。设计依据 docs/research/themes.md §3/§9：
// 排序链取四家共识骨架——frontmatter order > 文件名数字前缀 > index 置顶 > localeCompare；
// 树在生成期算死（不学 Nextra 全量 pageMap 进客户端 + 每导航 O(n) normalize——SSG 形态
// 无此约束，且 5000 页夹具下每页 HTML 内嵌整树的写放大只能靠集合过滤控制）。
import { routeFor } from "./plugins.ts";

export interface SidebarPageNode {
  type: "page";
  title: string;
  href: string;
  date?: string;
  description?: string;
}
export interface SidebarGroupNode {
  type: "group";
  title: string;
  /** 目录有 index 页时可点（index 页被吸收为分类入口，不再出现在 children） */
  href?: string;
  children: Array<SidebarNode>;
}
export type SidebarNode = SidebarPageNode | SidebarGroupNode;

/** 输入 = gen-routes 已有的投影（title/date/description 来自 frontmatter，order 可选） */
export interface SidebarEntryInput {
  collection: string;
  id: string;
  title?: string;
  order?: number;
  /** ISO 字符串（z.coerce.date 的序列化形态）；sortBy: "date" 的排序键 + flat 元数据 */
  date?: string;
  description?: string;
}

export interface Sidebar {
  tree: Array<SidebarNode>;
  /** DFS 平铺序（prev/next 数据源）；吸收进分组的 index 页也在序列里。
      date/description 为可选元数据（归档页/首页列表用；主题不需要可忽略） */
  flat: Array<{ title: string; href: string; date?: string; description?: string }>;
}

// Intl.Collator（numeric: "page-2" 排在 "page-10" 前）——Starlight 同款
const collator = new Intl.Collator(undefined, { numeric: true });

/**
 * 路径段数字前缀（Docusaurus 规则裁剪）：`01-intro` → { order: 1, base: "intro" }；
 * 日期/版本样（`2024-01-x`、`1.2-foo`）不当前缀；裸数字段（`01`）无前缀语义。
 */
function splitPrefix(segment: string): { order?: number; base: string } {
  if (/^\d+[-_.]\d/.test(segment)) return { base: segment };
  const m = /^(\d+)[-_.]+(.+)$/.exec(segment);
  if (!m) return { base: segment };
  return { order: Number(m[1]), base: m[2] };
}

/** 文件名 → 标题兜底：`getting-started` → "Getting started"（CJK 无大小写，原样） */
function humanize(base: string): string {
  const s = base.replaceAll(/[-_]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface MutableGroup {
  type: "group";
  title: string;
  href?: string;
  children: Array<MutableNode>;
  order?: number;
}
type MutableNode =
  | (SidebarPageNode & { order?: number; date?: string; description?: string })
  | MutableGroup;

export function buildSidebar(
  entries: Array<SidebarEntryInput>,
  opts?: { sortBy?: "alpha" | "date" },
): Sidebar {
  // date 模式：页节点按日期倒序（无日期沉底，组内保持 alpha 兜底）——
  // flat 序随之变为时间序 ⇒ page-nav 的 prev/next 自动成为「上一篇/下一篇」。
  // 分组（目录）顺序不受影响：目录不是时间实体。
  const dates = new Map<string, number>();
  if (opts?.sortBy === "date") {
    for (const e of entries) if (e.date) dates.set(routeFor(e.id), Date.parse(e.date));
  }
  const root: MutableGroup = { type: "group", title: "", children: [] };
  const groups = new Map<string, MutableGroup>([["", root]]);

  function groupFor(dir: string): MutableGroup {
    const existing = groups.get(dir);
    if (existing) return existing;
    const parent = dir.includes("/") ? dir.slice(0, dir.lastIndexOf("/")) : "";
    const base = dir.split("/").pop()!;
    const group: MutableGroup = {
      type: "group",
      title: humanize(splitPrefix(base).base),
      children: [],
      order: splitPrefix(base).order,
    };
    groupFor(parent).children.push(group);
    groups.set(dir, group);
    return group;
  }

  for (const entry of entries) {
    const segments = entry.id.split("/");
    const dir = segments.slice(0, -1).join("/");
    const last = segments[segments.length - 1];

    if (last === "index") {
      // index 页 = 所在目录的分类入口：标题/顺序提升为分组属性（Docusaurus 约定），
      // 自身不再作为子项出现。根 index（id "index"）是站点首页 → 树顶平铺页。
      if (dir === "") {
        root.href = routeFor(entry.id);
        root.title = entry.title ?? "Home";
        root.order = entry.order ?? Number.NEGATIVE_INFINITY;
      } else {
        const group = groupFor(dir);
        group.href = routeFor(entry.id);
        group.title = entry.title ?? group.title;
        group.order = entry.order ?? group.order;
      }
      continue;
    }

    const { order: prefixOrder, base } = splitPrefix(last);
    groupFor(dir).children.push({
      type: "page",
      title: entry.title ?? humanize(base),
      href: routeFor(entry.id),
      order: entry.order ?? prefixOrder,
      date: entry.date,
      description: entry.description,
    });
  }

  sortLevel(root.children, dates);

  // 序列化投影：剥离内部 order（主题不需要，sidebar.json 更瘦）
  const flat: Array<{ title: string; href: string }> = [];
  const tree = toTree(root, flat);
  // 根分组自身是页（有 index）时，树顶 = 首页节点 + 顶层子项
  const top: Array<SidebarNode> = root.href
    ? [{ type: "page", title: root.title, href: root.href }, ...tree]
    : tree;
  return { tree: top, flat };
}

/** 无 order 者排在所有有序项之后（Docusaurus 语义），同层兜底 localeCompare */
function sortLevel(nodes: Array<MutableNode>, dates: Map<string, number>): void {
  nodes.sort((a, b) => {
    // date 模式：页节点按日期倒序（无日期沉底）；分组仍走 order/alpha
    if (dates.size > 0) {
      const isPageA = a.type === "page";
      const isPageB = b.type === "page";
      if (isPageA && isPageB) {
        const ad = dates.get((a as SidebarPageNode).href) ?? Number.NEGATIVE_INFINITY;
        const bd = dates.get((b as SidebarPageNode).href) ?? Number.NEGATIVE_INFINITY;
        if (ad !== bd) return bd - ad;
      } else if (isPageA !== isPageB) {
        // 页 vs 组：组在前（目录是导航结构，时间流只在组内）——单层 blog 无感，多目录可预期
        return isPageA ? 1 : -1;
      }
    }
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return collator.compare(a.title, b.title);
  });
  for (const node of nodes) {
    if (node.type === "group") sortLevel(node.children, dates);
  }
}

function toTree(
  group: MutableGroup,
  flat: Array<{ title: string; href: string; date?: string; description?: string }>,
): Array<SidebarNode> {
  if (group.href) flat.push({ title: group.title, href: group.href });
  return group.children.map((node) => {
    if (node.type === "page") {
      flat.push({ title: node.title, href: node.href, date: node.date, description: node.description });
      return { type: "page" as const, title: node.title, href: node.href, date: node.date, description: node.description };
    }
    const children = toTree(node, flat);
    return node.href === undefined
      ? { type: "group" as const, title: node.title, children }
      : { type: "group" as const, title: node.title, href: node.href, children };
  });
}

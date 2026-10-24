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
}
export interface SidebarGroupNode {
  type: "group";
  title: string;
  /** 目录有 index 页时可点（index 页被吸收为分类入口，不再出现在 children） */
  href?: string;
  children: Array<SidebarNode>;
}
export type SidebarNode = SidebarPageNode | SidebarGroupNode;

/** 输入 = gen-routes 已有的投影（title 来自 frontmatter，order 可选） */
export interface SidebarEntryInput {
  collection: string;
  id: string;
  title?: string;
  order?: number;
}

export interface Sidebar {
  tree: Array<SidebarNode>;
  /** DFS 平铺序（prev/next 数据源）；吸收进分组的 index 页也在序列里 */
  flat: Array<{ title: string; href: string }>;
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
  | (SidebarPageNode & { order?: number })
  | MutableGroup;

export function buildSidebar(entries: Array<SidebarEntryInput>): Sidebar {
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
    });
  }

  sortLevel(root.children);

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
function sortLevel(nodes: Array<MutableNode>): void {
  nodes.sort((a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return collator.compare(a.title, b.title);
  });
  for (const node of nodes) {
    if (node.type === "group") sortLevel(node.children);
  }
}

function toTree(group: MutableGroup, flat: Array<{ title: string; href: string }>): Array<SidebarNode> {
  if (group.href) flat.push({ title: group.title, href: group.href });
  return group.children.map((node) => {
    if (node.type === "page") {
      flat.push({ title: node.title, href: node.href });
      return { type: "page" as const, title: node.title, href: node.href };
    }
    const children = toTree(node, flat);
    return node.href === undefined
      ? { type: "group" as const, title: node.title, children }
      : { type: "group" as const, title: node.title, href: node.href, children };
  });
}

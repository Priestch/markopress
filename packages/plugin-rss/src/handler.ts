// /rss.xml 的 GET handler —— 数据来自插件的 plugin-data 模块
// （virtual:mp/plugin/rss，由 markopress 的双后端虚拟模块机制解析到落盘文件）。
import data from "virtual:mp/plugin/rss";

interface RssData {
  site: string;
  title: string;
  description: string;
  items: Array<{ title: string; path: string; date?: string; description?: string }>;
}

const XML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPE[char]);
}

/** ISO → RFC 822（RSS 2.0 的 pubDate 格式，如 "Thu, 16 Oct 2026 12:00:00 +0000"） */
function rfc822(iso: string): string {
  return new Date(iso).toUTCString().replace("GMT", "+0000");
}

export function GET(): Response {
  const { site, title, description, items } = data as RssData;
  const dates = items.map((item) => (item.date ? new Date(item.date).getTime() : 0));
  const lastBuild = Math.max(0, ...dates);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(site)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    ...(lastBuild > 0
      ? [`    <lastBuildDate>${rfc822(new Date(lastBuild).toISOString())}</lastBuildDate>`]
      : []),
    ...items.map((item) => {
      const link = escapeXml(site + item.path);
      return [
        "    <item>",
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${link}</link>`,
        `      <guid>${link}</guid>`,
        ...(item.description
          ? [`      <description>${escapeXml(item.description)}</description>`]
          : []),
        ...(item.date ? [`      <pubDate>${rfc822(item.date)}</pubDate>`] : []),
        "    </item>",
      ].join("\n");
    }),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}

// /sitemap.xml 的 GET handler —— 数据来自插件的 plugin-data 模块
// （virtual:mp/plugin/sitemap，由 markopress 的双后端虚拟模块机制解析到落盘文件）。
import data from "virtual:mp/plugin/sitemap";

interface SitemapData {
  site: string;
  urls: string[];
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

export function GET(): Response {
  const { site, urls } = data as SitemapData;
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${escapeXml(site + url)}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}

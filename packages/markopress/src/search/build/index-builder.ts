import MiniSearch from 'minisearch';
import type { SearchIndexEntry, SearchConfig } from '../types.js';

const headingRegex = /<h(\d)[^>]*>(.*?)<\/h\1>/gi;
const headingContentRegex = /<a[^>]*href="#([^"]*)"[^>]*>(.*?)<\/a>/i;

export async function buildSearchIndex(
  pages: Array<{
    url: string;
    html: string;
    title: string;
    frontmatter?: Record<string, unknown>;
  }>,
  config?: SearchConfig
): Promise<string> {
  const miniSearch = new MiniSearch<SearchIndexEntry>({
    fields: ['title', 'titles', 'text'],
    storeFields: ['title', 'titles', 'url'],
  });

  for (const page of pages) {
    if (page.frontmatter?.search === false) continue;
    if (isExcluded(page.url, config?.exclude)) continue;

    const sections = splitPageIntoSections(page.html, page.url);
    for (const section of sections) {
      if (section.text || section.title) {
        miniSearch.add({
          id: section.id,
          title: section.title,
          titles: section.titles,
          text: section.text,
          url: section.url,
        });
      }
    }
  }

  return JSON.stringify(miniSearch.toJSON());
}

function isExcluded(url: string, exclude?: string[]): boolean {
  if (!exclude) return false;
  return exclude.some(pattern => {
    if (pattern.endsWith('*')) {
      return url.startsWith(pattern.slice(0, -1));
    }
    return url === pattern;
  });
}

function splitPageIntoSections(
  html: string,
  baseUrl: string
): Array<{
  id: string;
  title: string;
  titles: string[];
  text: string;
  url: string;
}> {
  const sections: Array<{
    id: string;
    title: string;
    titles: string[];
    text: string;
    url: string;
  }> = [];

  const parts = html.split(headingRegex);
  parts.shift();

  let parentTitles: string[] = [];

  for (let i = 0; i < parts.length; i += 3) {
    const level = parseInt(parts[i]) - 1;
    const headingHtml = parts[i + 1] || '';
    const content = parts[i + 2] || '';

    const headingMatch = headingContentRegex.exec(headingHtml);
    const title = stripHtmlTags(headingMatch?.[2] || headingHtml).trim();
    const anchor = headingMatch?.[1] || '';

    if (!title) continue;

    const titles = parentTitles.slice(0, level);
    titles[level] = title;

    const id = anchor ? `${baseUrl}#${anchor}` : baseUrl;
    const url = id;

    sections.push({
      id,
      title,
      titles: titles.filter(Boolean),
      text: stripHtmlTags(content),
      url,
    });

    if (level === 0) {
      parentTitles = [title];
    } else {
      parentTitles[level] = title;
    }
  }

  if (sections.length === 0 && html) {
    sections.push({
      id: baseUrl,
      title: '',
      titles: [],
      text: stripHtmlTags(html),
      url: baseUrl,
    });
  }

  return sections;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

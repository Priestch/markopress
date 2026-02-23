import MiniSearch from 'minisearch';
import type { SearchIndexEntry, SearchResult, SearchConfig } from '../types.js';

let searchIndex: MiniSearch<SearchIndexEntry> | null = null;
let loadPromise: Promise<MiniSearch<SearchIndexEntry>> | null = null;

export async function initSearch(basePath = ''): Promise<MiniSearch<SearchIndexEntry>> {
  if (searchIndex) return searchIndex;
  if (loadPromise) return loadPromise;

  const indexPath = basePath ? `${basePath}/search-index.json` : '/search-index.json';

  loadPromise = fetch(indexPath)
    .then(r => {
      if (!r.ok) throw new Error(`Failed to load search index: ${r.status}`);
      return r.text();
    })
    .then(data => {
      searchIndex = MiniSearch.loadJSON<SearchIndexEntry>(data, {
        fields: ['title', 'titles', 'text'],
        storeFields: ['title', 'titles', 'url'],
      });
      return searchIndex;
    });

  return loadPromise;
}

export async function search(
  query: string,
  config?: SearchConfig,
  limit = 10
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const index = await initSearch();

  const results = index.search(query, {
    fuzzy: config?.minisearch?.fuzzy ?? 0.2,
    prefix: config?.minisearch?.prefix ?? true,
    boost: {
      title: config?.minisearch?.boost?.title ?? 4,
      titles: config?.minisearch?.boost?.titles ?? 2,
      text: config?.minisearch?.boost?.text ?? 1,
    },
  });

  return results.slice(0, limit).map((result) => ({
    id: result.id,
    title: result.title as string,
    titles: result.titles as string[],
    text: (result as unknown as { text?: string }).text ?? '',
    url: result.url as string,
    score: result.score,
  })) as SearchResult[];
}

export function clearSearchIndex(): void {
  searchIndex = null;
  loadPromise = null;
}

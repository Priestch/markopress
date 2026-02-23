import MiniSearch from 'minisearch';
import type { SearchIndexEntry, SearchResult, SearchConfig } from '../types.js';

let searchIndex: MiniSearch<SearchIndexEntry> | null = null;
let loadPromise: Promise<MiniSearch<SearchIndexEntry>> | null = null;

interface ImportMetaWithEnv extends ImportMeta {
  env?: {
    BASE_URL?: string;
  };
}

function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.trim();
  if (!trimmed || trimmed === '/') return '';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

function resolveRuntimeBasePath(): string {
  const globalBase = (globalThis as typeof globalThis & {
    __MARKOPRESS_BASE_PATH__?: string;
  }).__MARKOPRESS_BASE_PATH__;

  if (typeof globalBase === 'string') return globalBase;

  const htmlBase = (globalThis as typeof globalThis & {
    document?: {
      documentElement?: {
        getAttribute?: (name: string) => string | null;
      };
    };
  }).document?.documentElement?.getAttribute?.('data-markopress-base-path');

  if (typeof htmlBase === 'string') return htmlBase;

  const viteBase = (import.meta as ImportMetaWithEnv).env?.BASE_URL;
  if (typeof viteBase === 'string') return viteBase;

  return '';
}

export async function initSearch(basePath?: string): Promise<MiniSearch<SearchIndexEntry>> {
  if (searchIndex) return searchIndex;
  if (loadPromise) return loadPromise;

  const normalizedBase = normalizeBasePath(basePath ?? resolveRuntimeBasePath());
  const indexPath = `${normalizedBase}/search-index.json`;

  loadPromise = fetch(indexPath)
    .then(r => {
      if (!r.ok) throw new Error(`Failed to load search index: ${r.status}`);
      return r.json();
    })
    .then((data: any) => {
      console.log('[search] Loaded index with', data.documentCount, 'documents');
      searchIndex = MiniSearch.loadJSON<SearchIndexEntry>(JSON.stringify(data), {
        fields: ['title', 'titles', 'text'],
        storeFields: ['title', 'titles', 'url'],
      });
      return searchIndex;
    })
    .catch(err => {
      console.error('[search] Failed to load index:', err);
      loadPromise = null;
      throw err;
    });

  return loadPromise;
}

export async function search(
  query: string,
  config?: SearchConfig,
  limit = 10
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  try {
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

    console.log('[search] Query:', query, 'Results:', results.length);

    return results.slice(0, limit).map((result) => ({
      id: result.id,
      title: result.title as string,
      titles: result.titles as string[],
      text: (result as unknown as { text?: string }).text ?? '',
      url: result.url as string,
      score: result.score,
    })) as SearchResult[];
  } catch (err) {
    console.error('[search] Search failed:', err);
    return [];
  }
}

export function clearSearchIndex(): void {
  searchIndex = null;
  loadPromise = null;
}

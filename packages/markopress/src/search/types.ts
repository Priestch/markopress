/**
 * Search types for MarkoPress
 */

export interface SearchIndexEntry {
  id: string;
  title: string;
  titles: string[];
  text: string;
  url: string;
}

export interface SearchResult {
  id: string;
  title: string;
  titles: string[];
  text: string;
  url: string;
  score: number;
}

export interface SearchConfig {
  enabled?: boolean;
  exclude?: string[];
  minisearch?: {
    fuzzy?: number;
    prefix?: boolean;
    boost?: {
      title?: number;
      titles?: number;
      text?: number;
    };
  };
}

export interface SearchIndexData {
  entries: SearchIndexEntry[];
  index: string;
}

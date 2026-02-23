/**
 * Search types for MarkoPress
 */

export { type SearchConfig } from '../config/types.js';

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

export interface SearchIndexData {
  entries: SearchIndexEntry[];
  index: string;
}

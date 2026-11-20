// MiniSearch 配置的单一来源：服务端建索引与浏览器 loadJSON 必须用同一份
// （options 含函数（tokenize），不经 JSON 序列化传递——toJSON/loadJSON 两端各自传）。
import type * as MiniSearch from "minisearch";

/**
 * CJK 感知分词：拉丁/数字段整词 + 中文逐字（unigram）。
 * MiniSearch 默认按标点/空白切，中文整句会变成一个超长 token——
 * 无空格语言下前缀永远从句首匹配，等于不可搜。
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const word of text.split(/[\n\r\p{Z}\p{P}]+/u)) {
    for (const match of word.matchAll(/[A-Za-z0-9_]+|[一-鿿]/g)) {
      tokens.push(match[0].toLowerCase());
    }
  }
  return tokens;
}

export interface SearchDoc {
  id: string;
  url: string;
  title: string;
  heading: string;
  text: string;
}

export const SEARCH_OPTIONS: MiniSearch.Options<SearchDoc> = {
  fields: ["title", "heading", "text"],
  storeFields: ["url", "title", "heading"],
  tokenize,
  searchOptions: { boost: { title: 4, heading: 2 }, prefix: true, fuzzy: 0.2 },
};

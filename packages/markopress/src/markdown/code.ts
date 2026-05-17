/**
 * Code block enhancements for Shiki
 * Implements VitePress-style code features:
 * - Line highlighting: {4}, {5-8}, {4,7,9}
 * - Line numbers
 * - Code titles
 * - Diff syntax (// [!code --], // [!code ++])
 * - Code focus (// [!code focus])
 * - Error/warning annotations (// [!code error], // [!code warning])
 *
 * Uses codeToHast() for better performance - generates HAST (tree) instead of HTML string,
 * then converts to HTML at the end with hastToHtml().
 */

import type { Highlighter } from 'shiki';
import { hastToHtml } from 'shiki';
import type { Element, Text, Root, ElementContent } from 'hast';

export interface CodeBlockOptions {
  /**
   * Show line numbers globally
   * @default true
   */
  lineNumbers?: boolean;

  /**
   * Language aliases
   */
  languageAlias?: Record<string, string>;

  /**
   * Shiki themes for dual-theme highlighting
   */
  theme?: { light?: string; dark?: string };
}

export interface CodeBlockMeta {
  /**
   * Lines to highlight (e.g., {4}, {5-8}, {4,7,9})
   */
  highlightLines?: Set<number>;

  /**
   * Whether to show line numbers for this block
   */
  lineNumbers?: boolean;

  /**
   * Code title/caption
   */
  title?: string;

  /**
   * Language name
   */
  lang?: string;
}

/**
 * Parse code block meta string
 * Examples:
 *  - ```js{4}
 *  - ```js{1,4-6}
 *  - ```js:line-numbers
 *  - ```js:line-numbers=false
 *  - ```js title="my-file.js"
 *  - ```js{4} title="Example" :line-numbers
 */
export function parseCodeMeta(info: string, globalLineNumbers: boolean = true): CodeBlockMeta {
  const meta: CodeBlockMeta = {
    highlightLines: new Set(),
    lineNumbers: globalLineNumbers,
  };

  // Extract language
  const langMatch = info.match(/^([a-z0-9-]+)/);
  if (langMatch) {
    meta.lang = langMatch[1];
  }

  // Extract line highlights {1,4-6,8}
  const highlightMatch = info.match(/\{([0-9,-]+)\}/);
  if (highlightMatch) {
    const ranges = highlightMatch[1].split(',');
    for (const range of ranges) {
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(Number);
        for (let i = start; i <= end; i++) {
          meta.highlightLines!.add(i);
        }
      } else {
        meta.highlightLines!.add(Number(range));
      }
    }
  }

  // Extract title
  const titleMatch = info.match(/title="([^"]+)"|title='([^']+)'/);
  if (titleMatch) {
    meta.title = titleMatch[1] || titleMatch[2];
  }

  // Extract line-numbers flag
  if (info.includes(':line-numbers') || info.includes(':ln')) {
    meta.lineNumbers = true;
  } else if (info.includes(':no-line-numbers') || info.includes(':line-numbers=false')) {
    meta.lineNumbers = false;
  }

  return meta;
}

/**
 * Process code lines for special markers
 * - // [!code --]  - Diff remove
 * - // [!code ++]  - Diff add
 * - // [!code focus] - Focus line
 * - // [!code error] - Error annotation
 * - // [!code warning] - Warning annotation
 */
export interface ProcessedLine {
  content: string;
  classes: string[];
  isDiff?: boolean;
  diffType?: 'add' | 'remove';
  isFocus?: boolean;
  isError?: boolean;
  isWarning?: boolean;
}

export function processCodeLines(code: string): ProcessedLine[] {
  const lines = code.split('\n');
  const processed: ProcessedLine[] = [];

  for (const line of lines) {
    const result: ProcessedLine = {
      content: line,
      classes: [],
    };

    // Check for diff markers
    if (line.includes('// [!code --]') || line.includes('// [!code -]')) {
      result.isDiff = true;
      result.diffType = 'remove';
      result.classes.push('diff', 'remove');
      result.content = line.replace(/\/\/ \[!code --?\]/, '').trim();
    } else if (line.includes('// [!code ++]') || line.includes('// [!code +]')) {
      result.isDiff = true;
      result.diffType = 'add';
      result.classes.push('diff', 'add');
      result.content = line.replace(/\/\/ \[!code \+\+?\]/, '').trim();
    }

    // Check for focus marker
    if (line.includes('// [!code focus]')) {
      result.isFocus = true;
      result.classes.push('focus');
      result.content = result.content.replace(/\/\/ \[!code focus\]/, '').trim();
    }

    // Check for error marker
    if (line.includes('// [!code error]')) {
      result.isError = true;
      result.classes.push('error');
      result.content = result.content.replace(/\/\/ \[!code error\]/, '').trim();
    }

    // Check for warning marker
    if (line.includes('// [!code warning]')) {
      result.isWarning = true;
      result.classes.push('warning');
      result.content = result.content.replace(/\/\/ \[!code warning\]/, '').trim();
    }

    processed.push(result);
  }

  return processed;
}

/**
 * Enhanced code highlighter with line features
 * Uses codeToHast() for better performance - generates HAST (tree) instead of HTML string
 * Supports dual themes (light + dark) in a single pass for dark mode support
 */
export function createEnhancedHighlighter(
  highlighter: Highlighter,
  options: CodeBlockOptions = {}
): (code: string, lang: string, info: string) => string {
  return (code: string, lang: string, info: string): string => {
    const meta = parseCodeMeta(info, options.lineNumbers ?? true);

    // Resolve language alias
    const resolvedLang = options.languageAlias?.[lang] || lang;

    // Process lines for special markers
    const processedLines = processCodeLines(code);
    const cleanCode = processedLines.map((l) => l.content).join('\n');

    // Generate HAST with Shiki using dual themes (light + dark) in one pass
    // This generates CSS variables that switch via parent class (.shiki-dark)
    let hast: Root;
    try {
      hast = highlighter.codeToHast(cleanCode, {
        lang: resolvedLang,
        themes: {
          light: options.theme?.light || 'vitesse-light',
          dark: options.theme?.dark || 'vitesse-dark',
        },
      });
    } catch (e) {
      // Fallback for unsupported languages - log warning and return plain code
      if ((e as any).message?.includes('language')) {
        console.warn(`[Shiki] Language "${resolvedLang}" not supported, falling back to plain text. ` +
          `Run build with debug=true to see available languages.`);
      }
      return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
    }

    // Enhance HAST with line features
    enhanceHastWithLineFeatures(hast, meta, processedLines);

    // Convert HAST to HTML
    let html = hastToHtml(hast);

    // Wrap with title if provided
    if (meta.title) {
      html = `<div class="code-block">
  <div class="code-title">${escapeHtml(meta.title)}</div>
  ${html}
</div>`;
    }

    return html;
  };
}

/**
 * Enhance HAST with line numbers, highlights, and other features.
 * Shiki 1.x already wraps each line in <span class="line">, so we only
 * need to find those spans and add classes/attributes.
 */
function enhanceHastWithLineFeatures(
  hast: Root,
  meta: CodeBlockMeta,
  processedLines: ProcessedLine[]
): void {
  // Find the <pre> element
  const preElement = findElement(hast, 'pre');
  if (!preElement) return;

  // Update pre classes (Shiki uses 'class' property in HAST)
  const existingRaw = preElement.properties?.class ?? preElement.properties?.className ?? [];
  const existingClasses = (Array.isArray(existingRaw) ? existingRaw : [existingRaw]).filter(Boolean) as string[];
  const preClasses: string[] = [
    ...existingClasses,
    meta.lineNumbers ? 'line-numbers' : '',
    meta.highlightLines?.size ? 'has-highlights' : '',
  ].filter(Boolean);
  preElement.properties = { ...preElement.properties, class: preClasses };
  delete preElement.properties.className;

  // Find the <code> element
  const codeElement = findElement(preElement, 'code');
  if (!codeElement) return;

  // Shiki 1.x wraps each line in <span class="line"> — find them and enhance
  const lineSpans = (codeElement.children || []).filter(
    (child): child is Element =>
      child.type === 'element' && child.tagName === 'span' && hasClass(child, 'line')
  );

  for (let i = 0; i < lineSpans.length; i++) {
    const span = lineSpans[i];
    const lineNum = i + 1;
    const processed = processedLines[i] || { classes: [] };

    const classes: string[] = ['line'];
    if (meta.highlightLines?.has(lineNum)) {
      classes.push('highlighted');
    }
    classes.push(...processed.classes);
    span.properties = { ...span.properties, class: classes };
    delete span.properties.className;

    if (meta.lineNumbers) {
      span.properties['data-line'] = lineNum;
    }
  }
}

/**
 * Find an element by tag name in HAST tree
 */
function findElement(parent: Root | Element, tagName: string): Element | null {
  if (parent.type === 'element' && parent.tagName === tagName) return parent;

  for (const child of parent.children || []) {
    if (child.type === 'element') {
      const found = findElement(child, tagName);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Check if an element has a specific class
 */
function hasClass(el: Element, cls: string): boolean {
  const raw = el.properties?.class ?? el.properties?.className;
  if (!raw) return false;
  const classes = Array.isArray(raw) ? raw : [raw];
  return classes.includes(cls);
}

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

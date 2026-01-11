/**
 * Code block enhancements for Shiki
 * Implements VitePress-style code features:
 * - Line highlighting: {4}, {5-8}, {4,7,9}
 * - Line numbers
 * - Code titles
 * - Diff syntax (// [!code --], // [!code ++])
 * - Code focus (// [!code focus])
 * - Error/warning annotations (// [!code error], // [!code warning])
 */

import type { Highlighter } from 'shiki';

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

    // Generate HTML with Shiki
    let html: string;
    try {
      // Reconstruct code without markers
      const cleanCode = processedLines.map((l) => l.content).join('\n');
      html = highlighter.codeToHtml(cleanCode, {
        lang: resolvedLang,
        theme: 'github-light',
      });
    } catch (e) {
      // Fallback for unsupported languages
      return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
    }

    // Parse the generated HTML to add enhancements
    html = enhanceHighlightedCode(html, meta, processedLines);

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
 * Enhance Shiki-generated HTML with line features
 */
function enhanceHighlightedCode(
  html: string,
  meta: CodeBlockMeta,
  processedLines: ProcessedLine[]
): string {
  // Parse HTML and add line numbers + classes
  const lines = html.split('\n');

  // Check if it's wrapped in <pre><code>
  const preMatch = html.match(/<pre class="([^"]*)"[^>]*>/);
  const codeMatch = html.match(/<code[^>]*>/);

  if (!preMatch || !codeMatch) {
    return html;
  }

  const preClasses = preMatch[1];
  const newPreClasses = [
    preClasses,
    meta.lineNumbers ? 'line-numbers' : '',
    meta.highlightLines?.size ? 'has-highlights' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Extract code lines (between <code> and </code>)
  const codeContent = html.match(/<code[^>]*>([\s\S]*)<\/code>/)?.[1] || '';
  const codeLines = codeContent.split('\n').filter((l) => l.length > 0);

  // Build enhanced lines
  const enhancedLines = codeLines.map((line, idx) => {
    const lineNum = idx + 1;
    const processed = processedLines[idx] || { classes: [] };
    const classes: string[] = ['line'];

    // Add highlight class
    if (meta.highlightLines?.has(lineNum)) {
      classes.push('highlighted');
    }

    // Add processed classes (diff, focus, error, warning)
    classes.push(...processed.classes);

    // Build line HTML
    const classStr = classes.join(' ');
    return `<span class="${classStr}"${meta.lineNumbers ? ` data-line="${lineNum}"` : ''}>${line}</span>`;
  });

  return `<pre class="${newPreClasses}"><code>${enhancedLines.join('\n')}</code></pre>`;
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

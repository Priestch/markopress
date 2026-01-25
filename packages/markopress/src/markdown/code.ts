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
          light: 'github-light',
          dark: 'github-dark',
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
 * Enhance HAST with line numbers, highlights, and other features
 * Works directly on the tree structure for better performance than string manipulation
 */
function enhanceHastWithLineFeatures(
  hast: Root,
  meta: CodeBlockMeta,
  processedLines: ProcessedLine[]
): void {
  // Find the <pre> element
  const preElement = findElement(hast, 'pre');
  if (!preElement) return;

  // Update pre classes
  const existingClasses = preElement.properties?.className || [];
  const preClasses: string[] = [
    ...(Array.isArray(existingClasses) ? existingClasses : [existingClasses]).filter(Boolean) as string[],
    meta.lineNumbers ? 'line-numbers' : '',
    meta.highlightLines?.size ? 'has-highlights' : '',
  ].filter(Boolean);
  preElement.properties = { ...preElement.properties, className: preClasses };

  // Find the <code> element
  const codeElement = findElement(preElement, 'code');
  if (!codeElement) return;

  // Split code children into lines and enhance each line
  const lines = splitChildrenIntoLines(codeElement.children || []);
  const enhancedChildren: ElementContent[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNodes = lines[i];
    const lineNum = i + 1;
    const processed = processedLines[i] || { classes: [] };

    // Skip empty lines
    if (lineNodes.length === 0 || (lineNodes.length === 1 && isEmptyText(lineNodes[0]))) {
      continue;
    }

    // Build classes for this line
    const lineClasses: string[] = ['line'];
    if (meta.highlightLines?.has(lineNum)) {
      lineClasses.push('highlighted');
    }
    lineClasses.push(...processed.classes);

    // Find the first element node to attach classes/attributes
    const firstElement = lineNodes.find((node): node is Element => node.type === 'element');

    if (firstElement) {
      // Add classes to existing element
      const elemClasses = firstElement.properties?.className || [];
      const combinedClasses: string[] = [
        ...(Array.isArray(elemClasses) ? elemClasses : [elemClasses]).filter(Boolean) as string[],
        ...lineClasses,
      ];
      firstElement.properties = {
        ...firstElement.properties,
        className: combinedClasses,
      };

      // Add data-line attribute if needed
      if (meta.lineNumbers) {
        firstElement.properties['data-line'] = lineNum;
      }
    } else if (lineNodes[0]) {
      // Wrap text-only line in a span
      const wrapper: Element = {
        type: 'element',
        tagName: 'span',
        properties: {
          className: lineClasses,
          ...(meta.lineNumbers && { 'data-line': lineNum }),
        },
        children: lineNodes,
      };
      enhancedChildren.push(wrapper);
      continue;
    }

    enhancedChildren.push(...lineNodes);
  }

  // Rebuild code children with newlines between lines
  codeElement.children = [];
  for (let i = 0; i < enhancedChildren.length; i++) {
    codeElement.children.push(enhancedChildren[i]);
    // Add newline between lines (but not after the last one)
    if (i < enhancedChildren.length - 1) {
      codeElement.children.push({ type: 'text', value: '\n' });
    }
  }
}

/**
 * Find an element by tag name in HAST tree
 */
function findElement(parent: Root | Element, tagName: string): Element | null {
  if (parent.type !== 'element') return null;
  if (parent.tagName === tagName) return parent;

  for (const child of parent.children || []) {
    if (child.type === 'element') {
      const found = findElement(child, tagName);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Split code element children into lines
 * Text nodes with newlines create line boundaries
 */
function splitChildrenIntoLines(children: ElementContent[]): Array<Array<ElementContent>> {
  const lines: Array<Array<ElementContent>> = [];
  let currentLine: Array<ElementContent> = [];

  for (const child of children) {
    if (child.type === 'text') {
      // Split text by newlines
      const parts = child.value.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          // Newline encountered - start a new line
          lines.push(currentLine);
          currentLine = [];
        }
        if (parts[i]) {
          // Only add non-empty text
          currentLine.push({ type: 'text', value: parts[i] });
        }
      }
    } else {
      // Element node - add to current line
      currentLine.push(child);
    }
  }

  // Don't forget the last line
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Check if a node is an empty text node
 */
function isEmptyText(node: ElementContent): boolean {
  return node.type === 'text' && !node.value;
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

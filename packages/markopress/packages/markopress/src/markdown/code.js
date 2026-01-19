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
export function parseCodeMeta(info, globalLineNumbers = true) {
    const meta = {
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
                    meta.highlightLines.add(i);
                }
            }
            else {
                meta.highlightLines.add(Number(range));
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
    }
    else if (info.includes(':no-line-numbers') || info.includes(':line-numbers=false')) {
        meta.lineNumbers = false;
    }
    return meta;
}
export function processCodeLines(code) {
    const lines = code.split('\n');
    const processed = [];
    for (const line of lines) {
        const result = {
            content: line,
            classes: [],
        };
        // Check for diff markers
        if (line.includes('// [!code --]') || line.includes('// [!code -]')) {
            result.isDiff = true;
            result.diffType = 'remove';
            result.classes.push('diff', 'remove');
            result.content = line.replace(/\/\/ \[!code --?\]/, '').trim();
        }
        else if (line.includes('// [!code ++]') || line.includes('// [!code +]')) {
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
export function createEnhancedHighlighter(highlighter, options = {}) {
    return (code, lang, info) => {
        const meta = parseCodeMeta(info, options.lineNumbers ?? true);
        // Resolve language alias
        const resolvedLang = options.languageAlias?.[lang] || lang;
        // Process lines for special markers
        const processedLines = processCodeLines(code);
        // Generate HTML with Shiki
        let html;
        try {
            // Reconstruct code without markers
            const cleanCode = processedLines.map((l) => l.content).join('\n');
            html = highlighter.codeToHtml(cleanCode, {
                lang: resolvedLang,
                theme: 'github-light',
            });
        }
        catch (e) {
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
function enhanceHighlightedCode(html, meta, processedLines) {
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
    // Split by newlines - don't filter yet as we need to preserve line numbers
    const codeLines = codeContent.split('\n');
    // Build enhanced lines
    const enhancedLines = codeLines
        .map((line, idx) => {
        const lineNum = idx + 1;
        const processed = processedLines[idx] || { classes: [] };
        // Check if line already has a span wrapper (from Shiki)
        if (line.trim().startsWith('<span')) {
            // Shiki already wrapped it, just add line number attribute if needed
            if (meta.lineNumbers) {
                return line.replace(/^(<span\s+)/, `$1data-line="${lineNum}" `);
            }
            return line;
        }
        // Plain line without span wrapper
        const classes = ['line'];
        // Add highlight class
        if (meta.highlightLines?.has(lineNum)) {
            classes.push('highlighted');
        }
        // Add processed classes (diff, focus, error, warning)
        classes.push(...processed.classes);
        // Build line HTML
        const classStr = classes.join(' ');
        return `<span class="${classStr}"${meta.lineNumbers ? ` data-line="${lineNum}"` : ''}>${line}</span>`;
    })
        .filter(line => {
        // Remove empty spans (from empty lines in code blocks)
        return !line.match(/<span class="line"><\/span>/) &&
            !line.match(/<span class="line">\s*<\/span>/);
    });
    return `<pre class="${newPreClasses}"><code>${enhancedLines.join('\n')}</code></pre>`;
}
/**
 * Escape HTML entities
 */
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

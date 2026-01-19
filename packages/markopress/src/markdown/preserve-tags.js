/**
 * Markdown-it plugin to preserve Marko tags (kebab-case) during markdown processing
 *
 * This plugin detects Marko component tags (kebab-case only) and preserves them verbatim,
 * allowing Marko's runtime to handle component discovery and rendering.
 *
 * Tag Detection Rules:
 * - Must be kebab-case: <my-component> (matches [a-z][a-z0-9-]*)
 * - Cannot be standard HTML5 element (will be processed normally by markdown-it)
 * - Can be self-closing: <my-tag />
 * - Can have attributes: <my-tag prop="value">
 * - Can have content: <my-tag>content</my-tag>
 * - Can be nested: <parent><child/></parent>
 *
 * Algorithm:
 * 1. Find all Marko tags in markdown
 * 2. Replace with placeholder tokens (MARKO_TAG_N_..._MARKO_TAG_N)
 * 3. Let markdown-it process everything normally
 * 4. Restore Marko tags from placeholders
 */
// Standard HTML5 elements that should NOT be preserved
// These will be processed normally by markdown-it
const HTML_ELEMENTS = new Set([
    // Common block elements
    'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'blockquote', 'pre', 'figure', 'figcaption',
    // Text elements
    'span', 'a', 'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup', 'code', 'small',
    // Lists
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    // Tables
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'col', 'colgroup',
    // Forms
    'form', 'input', 'button', 'select', 'datalist', 'optgroup', 'option', 'textarea',
    'label', 'fieldset', 'legend',
    // Embedded content
    'img', 'video', 'audio', 'source', 'track', 'canvas', 'map', 'area',
    // Scripting and styling
    'script', 'style', 'link', 'meta', 'noscript',
    // Document sections
    'html', 'head', 'body', 'title', 'base', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main', 'address',
    // Interactive
    'details', 'summary', 'dialog',
    // Other
    'iframe', 'object', 'param', 'embed',
]);
/**
 * Create placeholder for a detected Marko tag
 * Using HTML div with data attribute so markdown-it recognizes it as a block element
 */
function createPlaceholder(id) {
    return `<div data-marko-tag="${id}"></div>`;
}
/**
 * Restore Marko tags from placeholders
 */
function restoreTags(html, tokens) {
    let result = html;
    // Restore in reverse order to preserve positions
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        const placeholder = createPlaceholder(token.id);
        result = result.replace(placeholder, token.tag);
    }
    return result;
}
/**
 * Regex to match kebab-case Marko tags
 * Pattern: <[a-z][a-z0-9-]*> or </[a-z][a-z0-9-]*>
 * Matches: <my-component>, <alert-box>, <user-card>
 * Does NOT match: <MyComponent>, <myButton>, <button>, <div>
 */
const TAG_PATTERN = /<\/?([a-z][a-z0-9-]*)([^>]*)>/g;
/**
 * Detect Marko tags (kebab-case) in markdown
 */
function detectMarkoTags(markdown) {
    const tokens = [];
    let id = 0;
    // Track line numbers
    const lines = markdown.split('\n');
    let currentLine = 0;
    let position = 0;
    TAG_PATTERN.lastIndex = 0;
    let match;
    while ((match = TAG_PATTERN.exec(markdown)) !== null) {
        const tagName = match[1];
        // Skip if it's a standard HTML element
        if (HTML_ELEMENTS.has(tagName)) {
            continue;
        }
        // Calculate line number
        const matchPosition = match.index;
        while (currentLine < lines.length - 1 && position + lines[currentLine].length <= matchPosition) {
            position += lines[currentLine].length + 1; // +1 for newline
            currentLine++;
        }
        tokens.push({
            id: id++,
            start: match.index,
            end: match.index + match[0].length,
            tag: match[0],
            tagName: tagName,
        });
    }
    return tokens;
}
/**
 * Main plugin function
 */
export function preserveTagsPlugin(md, options) {
    const { onTagDetected } = options || {};
    // Track tokens for this render
    let currentTokens = [];
    // Phase 1: Replace Marko tags with placeholders before markdown processing
    // We wrap the render method to intercept and modify the output
    const originalRender = md.render.bind(md);
    md.render = (src, env) => {
        // Detect Marko tags
        const tokens = detectMarkoTags(src);
        // Notify callback for validation
        if (onTagDetected) {
            for (const token of tokens) {
                const lineNumber = getLineNumber(src, token.start);
                onTagDetected(token.tagName, lineNumber);
            }
        }
        // Replace with placeholders (accounting for shifting positions)
        let processedSrc = src;
        let offset = 0;
        for (const token of tokens) {
            const placeholder = createPlaceholder(token.id);
            const adjustedStart = token.start + offset;
            const adjustedEnd = token.end + offset;
            processedSrc = processedSrc.substring(0, adjustedStart) +
                placeholder +
                processedSrc.substring(adjustedEnd);
            // Update offset for next replacement
            offset += placeholder.length - (token.end - token.start);
        }
        // Render with placeholders
        const result = originalRender(processedSrc, env);
        // Restore Marko tags
        const restored = restoreTags(String(result), tokens);
        return restored;
    };
}
/**
 * Get line number from position in text
 */
function getLineNumber(text, position) {
    const before = text.substring(0, position);
    return before.split('\n').length;
}

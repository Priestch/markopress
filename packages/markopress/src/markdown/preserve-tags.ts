/**
 * Markdown-it plugin to preserve Marko tags (kebab-case) during markdown processing
 *
 * This plugin detects Marko component tags and preserves them verbatim,
 * allowing Marko's runtime to handle component discovery and rendering.
 *
 * - Preserves self-closing tags: <my-tag prop="value"/>
 * - Preserves tags with content: <my-tag>content</my-tag>
 * - Converts markdown→HTML inside tags that don't contain Marko syntax
 * - Preserves Marko template content as-is (nested components, slots)
 */

// Standard HTML5 elements that should NOT be preserved
const HTML_ELEMENTS = new Set([
    'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'blockquote', 'pre', 'figure', 'figcaption',
    'span', 'a', 'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup', 'code', 'small',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'col', 'colgroup',
    'form', 'input', 'button', 'select', 'datalist', 'optgroup', 'option', 'textarea',
    'label', 'fieldset', 'legend',
    'img', 'video', 'audio', 'source', 'track', 'canvas', 'map', 'area',
    'script', 'style', 'link', 'meta', 'noscript',
    'html', 'head', 'body', 'title', 'base', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main', 'address',
    'details', 'summary', 'dialog',
    'iframe', 'object', 'param', 'embed',
]);

interface Component {
    id: number;
    start: number;
    end: number;
    originalTag: string;
    content: string;
    processedTag: string;
}

/**
 * Create placeholder for a detected Marko component
 */
function createPlaceholder(id: number): string {
    return `<div data-marko-tag="${id}"></div>`;
}

/**
 * Restore Marko components from placeholders
 */
function restoreComponents(html: string, components: Component[]): string {
    let result = html;
    // Restore in reverse order to preserve positions
    for (let i = components.length - 1; i >= 0; i--) {
        const comp = components[i];
        const placeholder = createPlaceholder(comp.id);
        result = result.replace(placeholder, comp.processedTag);
    }
    return result;
}

/**
 * Check if content contains Marko syntax (nested components or named slots)
 */
function hasMarkoSyntax(content: string): boolean {
    // Check for nested Marko components (kebab-case tags)
    const nestedComponentRegex = /<[a-z][a-z0-9-]*(?:\s[^>]*?)?>/;
    // Check for named slots (@slot-name)
    const namedSlotRegex = /<@[\w-]+/;

    return nestedComponentRegex.test(content) || namedSlotRegex.test(content);
}

/**
 * Process component content - convert markdown to HTML if no Marko syntax present
 */
function processComponentContent(content: string, md: any): string {
    if (!content || !content.trim()) {
        return '';
    }

    if (hasMarkoSyntax(content)) {
        // Content is a Marko template - preserve as-is
        return content;
    }

    // Content is plain markdown - convert to HTML
    let html = md.render(content);

    // Unwrap <p> tags if markdown-it wrapped the content
    // (markdown-it wraps plain text in <p> tags)
    const trimmed = html.trim();
    if (trimmed.startsWith('<p>') && trimmed.endsWith('</p>')) {
        const inner = trimmed.slice(3, -4);
        // Check if there are no other block elements, then unwrap
        if (!inner.includes('</div>') && !inner.includes('<pre>')) {
            html = inner;
        }
    }

    return html;
}

/**
 * Parse opening tag: <name attrs> or <name attrs/>
 */
interface ParsedTag {
    name: string;
    attrs: string;
    selfClosing: boolean;
    end: number;
}

function parseOpeningTag(markdown: string, pos: number): ParsedTag | null {
    const tagRegex = /<([a-z][a-z0-9-]*)(\s[^>]*?)?(\/)?>/g;
    tagRegex.lastIndex = pos;
    const match = tagRegex.exec(markdown);

    if (!match) {
        return null;
    }

    return {
        name: match[1],
        attrs: match[2] || '',
        selfClosing: match[3] === '/',
        end: match.index + match[0].length
    };
}

/**
 * Extract full Marko component with content
 */
function extractComponent(markdown: string, startPos: number, md: any, onTagDetected?: (tag: string, line: number) => void, getLineNumber?: (text: string, pos: number) => number): Component | null {
    const openingTag = parseOpeningTag(markdown, startPos);

    if (!openingTag) {
        return null;
    }

    const tagName = openingTag.name;

    // Skip if it's a standard HTML element
    if (HTML_ELEMENTS.has(tagName)) {
        return null;
    }

    // Notify callback for validation
    if (onTagDetected && getLineNumber) {
        const lineNumber = getLineNumber(markdown, startPos);
        onTagDetected(tagName, lineNumber);
    }

    // If self-closing, return immediately
    if (openingTag.selfClosing) {
        return {
            id: 0,
            start: startPos,
            end: openingTag.end,
            originalTag: markdown.slice(startPos, openingTag.end),
            content: '',
            processedTag: markdown.slice(startPos, openingTag.end)
        };
    }

    // Find matching closing tag (handle nesting)
    let pos = openingTag.end;
    let depth = 1;
    const closeTagStart = `</${tagName}`;
    const closeTagFull = `</${tagName}>`;

    while (pos < markdown.length && depth > 0) {
        const nextOpen = markdown.indexOf(`<${tagName}`, pos);
        const nextClose = markdown.indexOf(closeTagFull, pos);

        if (nextClose === -1) {
            // No closing tag found - treat what we have
            break;
        }

        if (nextOpen !== -1 && nextOpen < nextClose) {
            // Found opening tag before closing
            const potentialTag = parseOpeningTag(markdown, nextOpen);
            if (potentialTag && potentialTag.name === tagName) {
                depth++;
                pos = potentialTag.end;
                continue;
            }
        }

        // Found closing tag
        depth--;
        if (depth === 0) {
            const endPos = nextClose + closeTagFull.length;
            const content = markdown.slice(openingTag.end, nextClose);

            // Process content (convert markdown or preserve Marko)
            const processedContent = processComponentContent(content, md);

            return {
                id: 0,
                start: startPos,
                end: endPos,
                originalTag: markdown.slice(startPos, endPos),
                content,
                processedTag: `<${tagName}${openingTag.attrs}>${processedContent}</${tagName}>`
            };
        }

        pos = nextClose + closeTagFull.length;
    }

    // No matching closing tag found - treat as self-closing
    return {
        id: 0,
        start: startPos,
        end: openingTag.end,
        originalTag: markdown.slice(startPos, openingTag.end),
        content: '',
        processedTag: `<${tagName}${openingTag.attrs}/>`
    };
}

/**
 * Extract all Marko components from markdown
 */
function extractComponents(markdown: string, md: any, onTagDetected?: (tag: string, line: number) => void, getLineNumber?: (text: string, pos: number) => number): Component[] {
    const components: Component[] = [];
    let pos = 0;
    let id = 0;

    while (pos < markdown.length) {
        // Find next potential tag
        const tagStart = markdown.indexOf('<', pos);
        if (tagStart === -1) {
            break;
        }

        const component = extractComponent(markdown, tagStart, md, onTagDetected, getLineNumber);
        if (component) {
            component.id = id++;
            components.push(component);
            pos = component.end;
        } else {
            pos = tagStart + 1;
        }
    }

    return components;
}

/**
 * Get line number from position in text
 */
function getLineNumber(text: string, position: number): number {
    const before = text.substring(0, position);
    return before.split('\n').length;
}

/**
 * Main plugin function
 */
export function preserveTagsPlugin(md: any, options: any): void {
    const { onTagDetected } = options || {};

    // Wrap the render method
    const originalRender = md.render.bind(md);
    md.render = (src: string, env: any) => {
        // Extract all Marko components (with content processing)
        const components = extractComponents(src, md, onTagDetected, getLineNumber);

        // Replace with placeholders
        let processedSrc = src;
        let offset = 0;

        for (const comp of components) {
            const placeholder = createPlaceholder(comp.id);
            const adjustedStart = comp.start + offset;
            const adjustedEnd = comp.end + offset;

            processedSrc = processedSrc.substring(0, adjustedStart) +
                placeholder +
                processedSrc.substring(adjustedEnd);

            offset += placeholder.length - (comp.end - comp.start);
        }

        // Render with placeholders
        const result = originalRender(processedSrc, env);

        // Restore Marko components (with processed content)
        const restored = restoreComponents(String(result), components);

        return restored;
    };
}

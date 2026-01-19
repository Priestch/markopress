/**
 * Custom container plugin for markdown-it
 * Implements VitePress-style and Docusaurus-style containers
 */
import container from 'markdown-it-container';
const DEFAULT_TYPES = ['tip', 'info', 'note', 'warning', 'danger', 'details'];
/**
 * Setup custom containers for markdown-it
 */
export function setupContainers(md, options = {}) {
    const types = options.types || DEFAULT_TYPES;
    // Register each container type
    for (const type of types) {
        md.use(container, type, {
            validate: (params) => {
                return params.trim().match(new RegExp(`^${type}\\s*(.*)$`));
            },
            render: (tokens, idx) => {
                const token = tokens[idx];
                if (token.nesting === 1) {
                    // Opening tag
                    const info = token.info.trim().slice(type.length).trim();
                    const title = md.utils.escapeHtml(info || getDefaultTitle(type));
                    return `<div class="custom-container ${type}">
  <p class="custom-container-title">${title}</p>
`;
                }
                else {
                    // Closing tag
                    return '</div>\n';
                }
            },
        });
    }
    // GitHub-style alerts (NOTE, TIP, IMPORTANT, WARNING, CAUTION)
    setupGitHubAlerts(md);
}
/**
 * Setup GitHub-style alerts
 * Syntax: [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]
 */
function setupGitHubAlerts(md) {
    const alertTypes = {
        NOTE: 'note',
        TIP: 'tip',
        IMPORTANT: 'important',
        WARNING: 'warning',
        CAUTION: 'danger',
    };
    // Add a rule to detect GitHub-style alerts in blockquotes
    md.core.ruler.after('block', 'github-alerts', (state) => {
        const tokens = state.tokens;
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].type !== 'blockquote_open') {
                continue;
            }
            // Check if the next token is a paragraph containing an alert marker
            const nextToken = tokens[i + 1];
            if (!nextToken || nextToken.type !== 'paragraph_open') {
                continue;
            }
            const inlineToken = tokens[i + 2];
            if (!inlineToken || inlineToken.type !== 'inline') {
                continue;
            }
            const content = inlineToken.content;
            const match = content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/);
            if (match) {
                const [, alertType, restContent] = match;
                const containerType = alertTypes[alertType];
                // Convert blockquote to custom container
                tokens[i].type = 'container_note_open';
                tokens[i].tag = 'div';
                tokens[i].attrSet('class', `custom-container ${containerType}`);
                // Add title
                const titleToken = new state.Token('html_block', '', 0);
                titleToken.content = `<p class="custom-container-title">${alertType}</p>\n`;
                tokens.splice(i + 1, 0, titleToken);
                // Update content
                if (restContent.trim()) {
                    inlineToken.content = restContent.trim();
                }
                else {
                    // Remove empty paragraph
                    tokens.splice(i + 1, 3);
                    i += 1;
                    continue;
                }
                // Find the closing blockquote tag and change it
                for (let j = i + 1; j < tokens.length; j++) {
                    if (tokens[j].type === 'blockquote_close') {
                        tokens[j].type = 'container_note_close';
                        tokens[j].tag = 'div';
                        break;
                    }
                }
                i += 3; // Skip the processed tokens
            }
        }
    });
}
/**
 * Get default title for container type
 */
function getDefaultTitle(type) {
    const titles = {
        tip: 'TIP',
        info: 'INFO',
        note: 'NOTE',
        warning: 'WARNING',
        danger: 'DANGER',
        details: 'Details',
        important: 'IMPORTANT',
        caution: 'CAUTION',
    };
    return titles[type] || type.toUpperCase();
}
/**
 * Setup collapsible details container
 */
export function setupDetails(md) {
    md.use(container, 'details', {
        validate: (params) => {
            return params.trim().match(/^details\s*(.*)$/);
        },
        render: (tokens, idx) => {
            const token = tokens[idx];
            if (token.nesting === 1) {
                // Opening tag
                const info = token.info.trim().slice('details'.length).trim();
                const summary = md.utils.escapeHtml(info || 'Details');
                return `<details class="custom-container details">
  <summary>${summary}</summary>
`;
            }
            else {
                // Closing tag
                return '</details>\n';
            }
        },
    });
}

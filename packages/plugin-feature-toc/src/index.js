/**
 * TOC Plugin for MarkoPress
 *
 * Generates table of contents from markdown headers
 */

/**
 * Create TOC plugin
 */
export default function tocPlugin(options = {}) {
  const { minDepth = 1, maxDepth = 3 } = options;

  return {
    name: '@markopress/plugin-feature-toc',
    modules: ['docs', 'pages', 'blog'],

    async enhanceModules(modules) {
      modules.forEach(module => {
        // Create a Map to store TOC for each file
        const tocMap = new Map();

        module.files.forEach(file => {
          const toc = buildTocFromHeaders(
            file.processed.headers,
            minDepth,
            maxDepth
          );
          tocMap.set(file.urlPath, toc);
        });

        // Add the TOC map as an enhancement
        module.enhance('toc', tocMap);
      });
    },
  };
}

/**
 * Strip markdown link syntax from text
 * Converts [text](url) -> text
 */
function stripMarkdownLinks(text) {
  if (!text) return text;
  // Match [text](url) pattern and replace with just text
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

/**
 * Build TOC from markdown headers
 * Returns a hierarchical structure with nested children
 */
function buildTocFromHeaders(headers, minDepth, maxDepth) {
  // Headers are stored as a tree (h1 -> h2 children -> h3 children)
  // We need to flatten the tree to get all headers
  const flatHeaders = [];

  function flattenTree(nodes) {
    for (const node of nodes) {
      flatHeaders.push(node);
      if (node.children && node.children.length > 0) {
        flattenTree(node.children);
      }
    }
  }

  flattenTree(headers);

  // Filter headers by depth
  const filteredHeaders = flatHeaders.filter(h => h.level >= minDepth && h.level <= maxDepth);

  if (filteredHeaders.length === 0) {
    return [];
  }

  // Build hierarchical structure
  const result = [];
  const stack = [];

  for (const header of filteredHeaders) {
    const item = {
      id: header.slug || header.id,
      text: stripMarkdownLinks(header.title),
      level: header.level,
    };

    // Pop items from stack until we find the parent level
    while (stack.length > 0 && stack[stack.length - 1].level >= header.level) {
      stack.pop();
    }

    // If stack is empty, add to root
    if (stack.length === 0) {
      result.push(item);
    } else {
      // Add as child of parent
      const parent = stack[stack.length - 1];
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(item);
    }

    // Push current item to stack
    stack.push(item);
  }

  return result;
}

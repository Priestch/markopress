import path from 'node:path';

const GLOBAL_COMPONENTS_KEY = '__MARKOPRESS_MARKDOWN_COMPONENTS__';
const markdownComponents = ((globalThis as unknown) as Record<string, Map<string, string>>)[GLOBAL_COMPONENTS_KEY] ??= new Map();
const virtualIds = new Map<string, string>();
const VIRTUAL_PREFIX = 'virtual:markdown-content/';
const MARKO_SUFFIX = '.marko';

export function registerMarkdownContent(id: string, html: string): void {
  markdownComponents.set(id, html);
}

export function getMarkdownContent(id: string): string | undefined {
  return markdownComponents.get(id);
}

export function markdownContentPlugin() {
  const virtualModuleId = 'virtual:markdown-content';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;
  let rootDir = process.cwd();
  let generatedDir = toPosixPath(path.join(rootDir, 'src', '.generated', 'markdown'));

  const debug = (msg: string, data: unknown) => {
    try {
      const fs = require('node:fs');
      fs.appendFileSync('/tmp/markopress-plugin-debug.log', `${msg}: ${JSON.stringify(data)}\n`);
    } catch {
      // Ignore
    }
  };

  debug('PLUGIN_FUNCTION_CALLED', { timestamp: Date.now() });

  return {
    name: 'markopress-markdown-content',
    enforce: 'pre',

    configResolved(config: { root?: string }) {
      rootDir = config.root || process.cwd();
      generatedDir = toPosixPath(path.join(rootDir, 'src', '.generated', 'markdown'));
    },

    resolveId(id: string, importer?: string) {
      debug('resolveId', { id, importer });
      if (id.startsWith(VIRTUAL_PREFIX)) {
        const moduleId = id.slice(VIRTUAL_PREFIX.length);
        const normalizedId = moduleId.endsWith(MARKO_SUFFIX)
          ? moduleId
          : `${moduleId}${MARKO_SUFFIX}`;
        const resolved = toPosixPath(path.join(generatedDir, normalizedId));
        const contentId = moduleId.endsWith(MARKO_SUFFIX)
          ? moduleId.slice(0, -MARKO_SUFFIX.length)
          : moduleId;
        virtualIds.set(resolved, contentId);
        debug('resolveId_MATCH', { id, resolved });
        return resolved;
      }
      return undefined;
    },

    load(id: string) {
      debug('load', { id });
      const contentId = resolveContentId(id, generatedDir);
      if (!contentId) {
        return undefined;
      }

      debug('load_MATCH', { contentId, storedKeys: Array.from(markdownComponents.keys()) });

      const html = markdownComponents.get(contentId);
      if (!html) {
        debug('load_NO_HTML', { contentId });
        return `<div class="markdown-content">\n  <div class="markdown-placeholder">Content not found: ${escapeHtml(contentId)}</div>\n</div>`;
      }

      debug('load_FOUND_HTML', { contentId, htmlLength: html.length });

      // Escape the HTML for use in a Marko template
      // We need to escape $ to prevent Marko from interpreting ${...} as template expressions
      const escapedHtml = html
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$');

      // Return a Marko component that renders the HTML using a static literal
      return `<div class="markdown-content">\n$!{\`${escapedHtml}\`}\n</div>`;
    },
  };
}

export async function loadMarkdownModule(id: string): Promise<Record<string, unknown>> {
  const devGlobal = (globalThis as { __marko_run_dev__?: { devServers?: Set<any> } }).__marko_run_dev__;
  const devServer = devGlobal?.devServers?.values().next().value;

  if (devServer?.ssrLoadModule) {
    return devServer.ssrLoadModule(id);
  }

  return import(/* @vite-ignore */ id);
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeMarkoText(value: string): string {
  const input = String(value);
  let output = '';
  let inTag = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '<') {
      inTag = true;
      output += char;
      continue;
    }

    if (char === '>') {
      inTag = false;
      output += char;
      continue;
    }

    if (!inTag && char === '$' && input[i + 1] === '{') {
      output += '&#36;{';
      i++;
      continue;
    }

    output += char;
  }

  return output;
}

function resolveContentId(id: string, generatedDir: string): string | null {
  const cleanId = toPosixPath(id.split('?', 1)[0]);
  const mapped = virtualIds.get(cleanId);
  if (mapped) {
    return mapped;
  }
  if (cleanId.startsWith(generatedDir)) {
    const relative = cleanId.slice(generatedDir.length + 1);
    if (relative) {
      return relative.endsWith(MARKO_SUFFIX)
        ? relative.slice(0, -MARKO_SUFFIX.length)
        : relative;
    }
  }
  return null;
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

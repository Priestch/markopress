/**
 * MarkoPress Preview Server
 * Serves the production build with base path support
 */

import path from 'node:path';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import { loadConfig } from '../config/index.js';
import type { PreviewOptions } from '../build/types.js';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function toCandidatePaths(requestPath: string): string[] {
  if (requestPath === '/') {
    return ['/index.html'];
  }

  if (requestPath.endsWith('/')) {
    return [`${requestPath}index.html`];
  }

  const ext = path.posix.extname(requestPath);
  if (ext) {
    return [requestPath];
  }

  return [
    `${requestPath}.html`,
    `${requestPath}/index.html`,
  ];
}

function toSafeAbsolutePath(rootDir: string, requestPath: string): string | null {
  const safeRelativePath = requestPath.replace(/^\/+/, '');
  const absolutePath = path.join(rootDir, safeRelativePath);
  const relative = path.relative(rootDir, absolutePath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return absolutePath;
}

async function resolvePublicFile(
  publicDir: string,
  requestPath: string,
): Promise<{ filePath: string; statusCode: number } | null> {
  for (const candidate of toCandidatePaths(requestPath)) {
    const absolutePath = toSafeAbsolutePath(publicDir, candidate);
    if (!absolutePath) continue;

    try {
      const stat = await fs.stat(absolutePath);
      if (stat.isFile()) {
        return { filePath: absolutePath, statusCode: 200 };
      }
    } catch {
      // Ignore missing files while checking candidates
    }
  }

  const notFoundPath = toSafeAbsolutePath(publicDir, '/404.html');
  if (!notFoundPath) {
    return null;
  }

  try {
    const stat = await fs.stat(notFoundPath);
    if (stat.isFile()) {
      return { filePath: notFoundPath, statusCode: 404 };
    }
  } catch {
    // No custom 404 page
  }

  return null;
}

export async function preview(options: PreviewOptions = {}): Promise<never> {
  const { port = 4173, host = 'localhost', root } = options;

  // Use resolved root or fall back to process.cwd()
  const projectRoot = root || process.cwd();

  // Load config to check for base path
  const config = await loadConfig(projectRoot, { mode: 'production', command: 'preview' });
  const base = (config.site?.base || '/').replace(/\/?$/, '/');

  // Resolve the @marko/run app root (.markopress directory)
  const markoAppRoot = path.join(projectRoot, '.markopress');
  const appRoot = existsSync(markoAppRoot) && statSync(markoAppRoot).isDirectory()
    ? markoAppRoot
    : projectRoot;
  const outDir = config.build?.outDir || 'dist';
  const publicDir = path.join(appRoot, outDir, 'public');

  try {
    const stat = await fs.stat(publicDir);
    if (!stat.isDirectory()) {
      throw new Error();
    }
  } catch {
    console.error(`Preview build output not found at: ${publicDir}`);
    console.error('Run "markopress build" before "markopress preview".');
    process.exit(1);
  }

  const basePrefix = base.replace(/\/$/, '');

  const server = createServer((req, res) => {
    const method = req.method || 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405);
      res.end('Method Not Allowed');
      return;
    }

    const requestUrl = new URL(req.url || '/', `http://${host}:${port}`);
    let requestPath = requestUrl.pathname || '/';

    // Support both prefixed and non-prefixed requests for local preview convenience.
    if (basePrefix && requestPath.startsWith(`${basePrefix}/`)) {
      requestPath = requestPath.slice(basePrefix.length) || '/';
    } else if (basePrefix && requestPath === basePrefix) {
      requestPath = '/';
    }

    const decodedPath = decodeURIComponent(requestPath);

    void resolvePublicFile(publicDir, decodedPath)
      .then((resolved) => {
        if (!resolved) {
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('Not Found');
          return;
        }

        const contentType = CONTENT_TYPES[path.extname(resolved.filePath)] || 'application/octet-stream';
        res.writeHead(resolved.statusCode, {
          'content-type': contentType,
          'cache-control': 'no-cache',
        });

        if (method === 'HEAD') {
          res.end();
          return;
        }

        createReadStream(resolved.filePath).pipe(res);
      })
      .catch(() => {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error');
      });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });

  console.log('🚀 Starting MarkoPress preview server...\n');
  if (basePrefix) {
    console.log(`   Server: http://${host}:${port}${basePrefix}/`);
    console.log(`   Base path: ${base}`);
  } else {
    console.log(`   Server: http://${host}:${port}`);
  }
  console.log(`   Serving: ${publicDir}`);
  console.log('   Press Ctrl+C to stop\n');

  process.on('SIGINT', () => {
    server.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    server.close();
    process.exit(0);
  });

  // Keep the process running
  return new Promise(() => {});
}

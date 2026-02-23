/**
 * MarkoPress Preview Server
 * Serves the production build with base path support
 */

import path from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { spawn } from 'node:child_process';
import { loadConfig } from '../config/index.js';
import type { PreviewOptions } from '../build/types.js';

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

  if (base !== '/') {
    // Non-root base: start marko-run preview on a random internal port,
    // then proxy through a server that strips the base prefix.
    const internalPort = 30000 + Math.floor(Math.random() * 10000);

    const previewProcess = spawn('npx', ['marko-run', 'preview', '--port', String(internalPort)], {
      stdio: 'pipe',
      cwd: appRoot,
    });

    // Wait for the internal server to be ready
    await new Promise<void>((resolve) => {
      const onData = (data: Buffer) => {
        const text = data.toString();
        if (text.includes('Preview server started') || text.includes('localhost')) {
          resolve();
        }
      };
      previewProcess.stdout?.on('data', onData);
      previewProcess.stderr?.on('data', onData);
      // Fallback: resolve after a short delay
      setTimeout(resolve, 2000);
    });

    // Create a proxy server that strips the base path
    const basePrefix = base.replace(/\/$/, ''); // e.g. '/markopress'
    const proxy = createServer((req, res) => {
      let url = req.url || '/';

      // Strip the base prefix from the URL
      if (url.startsWith(basePrefix + '/')) {
        url = url.slice(basePrefix.length) || '/';
      } else if (url === basePrefix) {
        url = '/';
      }

      // Forward to the internal marko-run preview server
      const proxyReq = httpRequest(
        {
          hostname: 'localhost',
          port: internalPort,
          path: url,
          method: req.method,
          headers: req.headers,
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          proxyRes.pipe(res);
        },
      );

      proxyReq.on('error', () => {
        res.writeHead(502);
        res.end('Bad Gateway');
      });

      req.pipe(proxyReq);
    });

    proxy.listen(port, () => {
      console.log('🚀 Starting MarkoPress preview server...\n');
      console.log(`   Server: http://${host}:${port}${basePrefix}/`);
      console.log(`   Base path: ${base}`);
      console.log('   Press Ctrl+C to stop\n');
    });

    previewProcess.on('error', (error) => {
      console.error('Failed to start preview server:', error.message);
      process.exit(1);
    });

    process.on('SIGINT', () => {
      previewProcess.kill();
      proxy.close();
      process.exit(0);
    });
  } else {
    // Root base: use marko-run preview directly
    console.log('🚀 Starting MarkoPress preview server...\n');
    console.log(`   Server: http://${host}:${port}`);
    console.log('   Press Ctrl+C to stop\n');

    const previewProcess = spawn('npx', ['marko-run', 'preview', '--port', String(port)], {
      stdio: 'inherit',
      cwd: appRoot,
    });

    previewProcess.on('error', (error) => {
      console.error('Failed to start preview server:', error.message);
      process.exit(1);
    });
  }

  // Keep the process running
  return new Promise(() => {});
}

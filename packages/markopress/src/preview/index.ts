/**
 * MarkoPress Preview Server
 * Serves the production build
 */

import path from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import type { PreviewOptions } from '../build/types.js';

export async function preview(options: PreviewOptions = {}): Promise<never> {
  const { port = 4173, host = 'localhost', root } = options;

  console.log('🚀 Starting MarkoPress preview server...\n');
  console.log(`   Server: http://${host}:${port}`);
  console.log('   Press Ctrl+C to stop\n');

  // Use resolved root or fall back to process.cwd()
  const projectRoot = root || process.cwd();

  // Resolve the @marko/run app root (.markopress directory)
  const markoAppRoot = path.join(projectRoot, '.markopress');
  const appRoot = existsSync(markoAppRoot) && statSync(markoAppRoot).isDirectory()
    ? markoAppRoot
    : projectRoot;

  // Use @marko/run preview command
  const previewProcess = spawn('npx', ['marko-run', 'preview', '--port', String(port)], {
    stdio: 'inherit',
    cwd: appRoot,
  });

  previewProcess.on('error', (error) => {
    console.error('Failed to start preview server:', error.message);
    process.exit(1);
  });

  // Keep the process running
  return new Promise(() => {});
}

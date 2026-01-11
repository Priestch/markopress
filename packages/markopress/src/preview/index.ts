/**
 * MarkoPress Preview Server
 * Serves the production build
 */

import { spawn } from 'node:child_process';
import type { PreviewOptions } from '../build/types.js';

export async function preview(options: PreviewOptions = {}): Promise<never> {
  const { port = 4173, host = 'localhost' } = options;

  console.log('🚀 Starting MarkoPress preview server...\n');
  console.log(`   Server: http://${host}:${port}`);
  console.log('   Press Ctrl+C to stop\n');

  // Use @marko/run preview command
  const previewProcess = spawn('npx', ['marko-run', 'preview', '--port', String(port)], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  previewProcess.on('error', (error) => {
    console.error('Failed to start preview server:', error.message);
    process.exit(1);
  });

  // Keep the process running
  return new Promise(() => {});
}

#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the CLI directly from dist/cli/index.js
const cliPath = resolve(__dirname, '../dist/cli/index.js');
if (existsSync(cliPath)) {
  await import(cliPath);
} else {
  console.error('Error: CLI not found. Please run `pnpm build` first.');
  process.exit(1);
}

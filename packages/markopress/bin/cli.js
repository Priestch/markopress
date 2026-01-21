#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to find and import the CLI from multiple possible locations
const possiblePaths = [
  resolve(__dirname, '../dist/cli/index.js'),
  resolve(__dirname, '../dist/index.mjs'),
  resolve(__dirname, '../cli/index.js'),
];

for (const cliPath of possiblePaths) {
  if (existsSync(cliPath)) {
    await import(cliPath);
    break;
  }
}

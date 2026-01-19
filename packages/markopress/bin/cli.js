#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import from dist directory relative to bin directory
const cliPath = resolve(__dirname, '../dist/cli/index.js');
await import(cliPath);

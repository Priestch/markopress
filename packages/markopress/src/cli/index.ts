#!/usr/bin/env node
/**
 * MarkoPress CLI
 */

import { Command } from 'commander';
import { resolveAppRoot } from '../config/app-root.js';
import { startDevServer } from '../dev/index.js';
import { build } from '../build/index.js';
import { preview } from '../preview/index.js';

// Resolve the app root (e.g., website/.markopress)
const appRoot = resolveAppRoot();

interface DevOptions {
  port: string;
  host: string;
  open: boolean;
  catchAll?: boolean;
}

interface BuildOptions {
  debug: boolean;
  output: string;
  catchAll?: boolean;
}

interface PreviewOptions {
  port: string;
  host: string;
}

interface InitOptions {
  template: string;
}

const program = new Command();

program
  .name('markopress')
  .description('A general-purpose static site generator using Marko.js v6')
  .version('0.1.0');

program
  .command('dev')
  .description('Start development server')
  .option('-p, --port <port>', 'Port to run server on', '3000')
  .option('--host <host>', 'Host to run server on', 'localhost')
  .option('--open', 'Open browser automatically', false)
  .option('--catch-all', 'Use catch-all dynamic routes')
  .action(async (options: DevOptions) => {
    await startDevServer({
      port: parseInt(options.port),
      host: options.host,
      open: options.open,
      useCatchAllRoutes: options.catchAll,
      root: appRoot,
    });
  });

program
  .command('build')
  .description('Build for production')
  .option('--debug', 'Debug mode', false)
  .option('-o, --output <dir>', 'Output directory', 'dist')
  .option('--catch-all', 'Use catch-all dynamic routes')
  .action(async (options: BuildOptions) => {
    const result = await build({
      debug: options.debug,
      outDir: options.output,
      useCatchAllRoutes: options.catchAll,
      root: appRoot,
    });

    if (!result.success) {
      console.error('\n❌ Build failed!');
      result.errors.forEach((error) => console.error(`   ${error}`));
      process.exit(1);
    }
  });

program
  .command('preview')
  .description('Preview production build')
  .option('-p, --port <port>', 'Port to run server on', '4173')
  .option('--host <host>', 'Host to run server on', 'localhost')
  .action(async (options: PreviewOptions) => {
    await preview({
      port: parseInt(options.port),
      host: options.host,
      root: appRoot,
    });
  });

program
  .command('init [site-dir]')
  .description('Create a new MarkoPress site')
  .option('-t, --template <template>', 'Template to use', 'default')
  .action(async (siteDir: string | undefined, options: InitOptions) => {
    const dir = siteDir || '.';
    console.log(`Initializing MarkoPress site in ${dir}...`);
    console.log(`Template: ${options.template}`);
    // TODO: Implement init
  });

program.parse();

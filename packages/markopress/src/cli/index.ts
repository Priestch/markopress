#!/usr/bin/env node
/**
 * MarkoPress CLI
 */

import { Command } from 'commander';
import { startDevServer } from '../dev/index.js';
import { build } from '../build/index.js';
import { preview } from '../preview/index.js';

interface DevOptions {
  port: string;
  host: string;
  open: boolean;
}

interface BuildOptions {
  debug: boolean;
  output: string;
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
  .action(async (options: DevOptions) => {
    await startDevServer({
      port: parseInt(options.port),
      host: options.host,
      open: options.open,
    });
  });

program
  .command('build')
  .description('Build for production')
  .option('--debug', 'Debug mode', false)
  .option('-o, --output <dir>', 'Output directory', 'dist')
  .action(async (options: BuildOptions) => {
    const result = await build({
      debug: options.debug,
      outDir: options.output,
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

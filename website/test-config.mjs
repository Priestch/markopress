import { loadConfig } from '/home/gp/Projects/markopress/packages/markopress/dist/config/index.js';
const config = await loadConfig(process.cwd(), { mode: 'production', command: 'build' });
console.log('Content config:', JSON.stringify(config.content, null, 2));
console.log('Build config:', JSON.stringify(config.build, null, 2));

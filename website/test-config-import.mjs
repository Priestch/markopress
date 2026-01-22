// Try to load the config file directly
const configModule = await import('./markopress.config.js');
console.log('Config module type:', typeof configModule.default);
console.log('Config:', JSON.stringify(configModule.default, null, 2));

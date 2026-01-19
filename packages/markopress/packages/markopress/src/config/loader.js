/**
 * Configuration loader for MarkoPress
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateConfigSafe } from './validation.js';
const DEFAULT_CONFIG = {
    site: {
        title: 'MarkoPress Site',
        description: '',
        base: '/',
        lang: 'en-US',
        head: [],
    },
    content: {
        pages: 'content/pages',
        docs: 'content/docs',
        blog: 'content/blog',
    },
    theme: {
        name: '@markopress/theme-default',
        options: {},
    },
    markdown: {
        lineNumbers: false, // Changed default to false to avoid Marko parser issues
        theme: {
            light: 'github-light',
            dark: 'github-dark',
        },
    },
    build: {
        useCatchAllRoutes: false,
        outDir: 'dist',
        assetsDir: 'assets',
    },
    plugins: [],
};
/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
        const sourceValue = source[key];
        const targetValue = result[key];
        if (sourceValue === undefined) {
            continue;
        }
        if (isObject(targetValue) && isObject(sourceValue)) {
            result[key] = deepMerge(targetValue, sourceValue);
        }
        else {
            result[key] = sourceValue;
        }
    }
    return result;
}
function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/**
 * Validate configuration using Zod schema
 */
function validateConfig(config) {
    const result = validateConfigSafe(config);
    if (!result.success) {
        return {
            valid: false,
            errors: result.errors.map((err) => `${err.path}: ${err.message}`),
        };
    }
    return {
        valid: true,
        errors: [],
    };
}
/**
 * Find and load the configuration file
 */
export async function loadConfigFromFile(root, env) {
    // Check .markopress/config.ts first (higher priority)
    const configFiles = [
        '.markopress/config.ts',
        '.markopress/config.js',
        '.markopress/config.mjs',
        'markopress.config.ts',
        'markopress.config.js',
        'markopress.config.mjs',
    ];
    for (const file of configFiles) {
        const filePath = path.resolve(root, file);
        try {
            await fs.access(filePath);
            // Use pathToFileURL for better cross-platform support
            const fileUrl = pathToFileURL(filePath).href;
            // Add timestamp to bypass module cache during development
            const importUrl = `${fileUrl}?t=${Date.now()}`;
            const configModule = await import(importUrl);
            const configExport = configModule.default;
            if (!configExport) {
                throw new Error(`Config file ${file} must have a default export`);
            }
            let config;
            if (typeof configExport === 'function') {
                config = await configExport(env);
            }
            else {
                config = configExport;
            }
            // Validate the loaded config
            const validation = validateConfig(config);
            if (!validation.valid) {
                throw new Error(`Invalid configuration in ${file}:\n${validation.errors.map((e) => `  - ${e}`).join('\n')}`);
            }
            console.log(`✓ Loaded config from ${file}`);
            return { file: filePath, config };
        }
        catch (error) {
            // Only throw if file exists but failed to load/parse
            if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
                throw new Error(`Failed to load config from ${file}: ${error instanceof Error ? error.message : String(error)}`);
            }
            // File doesn't exist, continue to next option
        }
    }
    return null;
}
/**
 * Resolve the configuration with defaults
 */
export function resolveConfig(userConfig, root) {
    // Use deep merge for nested configurations
    const site = deepMerge(DEFAULT_CONFIG.site, userConfig.site || {});
    const content = deepMerge(DEFAULT_CONFIG.content, userConfig.content || {});
    const theme = deepMerge(DEFAULT_CONFIG.theme, userConfig.theme || {});
    const markdown = deepMerge(DEFAULT_CONFIG.markdown, userConfig.markdown || {});
    const build = deepMerge(DEFAULT_CONFIG.build, userConfig.build || {});
    // Plugins need special handling - don't merge, just replace
    const plugins = userConfig.plugins || DEFAULT_CONFIG.plugins;
    return {
        root,
        site,
        content,
        theme,
        markdown,
        build,
        plugins,
    };
}
/**
 * Load the configuration from a directory
 */
export async function loadConfig(root = process.cwd(), env = { mode: 'development', command: 'dev' }) {
    const loaded = await loadConfigFromFile(root, env);
    if (!loaded) {
        // Return default config if no config file found
        return resolveConfig({ site: DEFAULT_CONFIG.site }, root);
    }
    return resolveConfig(loaded.config, root);
}
/**
 * Define configuration helper with type safety
 */
export function defineConfig(config) {
    return config;
}
export function defineConfigWithCallback(config) {
    return config;
}

/**
 * Plugin manager for MarkoPress
 * Manages plugin lifecycle, dependencies, and hook execution
 */

import type {
  MarkoPressPlugin,
  PluginConfig,
  PluginContext,
  ContentContext,
  BuildContext,
  ContentManifest,
  RouteManifest,
  PageData,
  PostData,
} from './types.js';
import type { ResolvedConfig } from '../config/index.js';
import MarkdownIt from 'markdown-it';

export interface PluginLoadResult {
  plugin: MarkoPressPlugin;
  config: PluginConfig;
  error?: Error;
}

export class PluginManager {
  private plugins: MarkoPressPlugin[] = [];
  private config: ResolvedConfig;
  private pluginLoadOrder: string[] = [];
  private loadResults: PluginLoadResult[] = [];

  constructor(config: ResolvedConfig) {
    this.config = config;
  }

  /**
   * Load plugins from configuration with dependency resolution
   */
  async loadPlugins(pluginConfigs: PluginConfig[]): Promise<void> {
    // Resolve plugin dependencies
    const orderedConfigs = await this.resolvePluginDependencies(pluginConfigs);

    // Load plugins in dependency order
    for (const pluginConfig of orderedConfigs) {
      const result = await this.loadPlugin(pluginConfig);
      if (result) {
        this.plugins.push(result.plugin);
        this.loadResults.push(result);
        this.pluginLoadOrder.push(result.plugin.name);
      }
    }

    console.log(`✓ Loaded ${this.plugins.length} plugins: ${this.pluginLoadOrder.join(', ')}`);
  }

  /**
   * Resolve plugin dependencies using topological sort
   */
  private async resolvePluginDependencies(
    pluginConfigs: PluginConfig[]
  ): Promise<PluginConfig[]> {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const sorted: PluginConfig[] = [];
    const pluginMap = new Map<string, PluginConfig>();

    // Map plugin names to configs
    for (const config of pluginConfigs) {
      const name = this.getPluginName(config);
      pluginMap.set(name, config);
    }

    const visit = async (name: string): Promise<void> => {
      if (visited.has(name)) {
        return;
      }

      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected among plugins: ${name}`);
      }

      visiting.add(name);

      const config = pluginMap.get(name);
      if (!config) {
        throw new Error(`Plugin not found: ${name}`);
      }

      // Get plugin dependencies
      const deps = await this.getPluginDependencies(config);
      for (const dep of deps) {
        if (pluginMap.has(dep)) {
          await visit(dep);
        }
      }

      visiting.delete(name);
      visited.add(name);
      sorted.push(config);
    };

    // Visit all plugins
    for (const name of pluginMap.keys()) {
      await visit(name);
    }

    return sorted;
  }

  /**
   * Get plugin name from config
   */
  private getPluginName(config: PluginConfig): string {
    if (typeof config === 'string') {
      return config;
    } else if (Array.isArray(config)) {
      return config[0];
    } else {
      return config.name;
    }
  }

  /**
   * Get plugin dependencies
   */
  private async getPluginDependencies(config: PluginConfig): Promise<string[]> {
    try {
      const plugin = await this.loadPluginModule(config);
      if (plugin && plugin.dependencies) {
        return plugin.dependencies;
      }
    } catch {
      // Ignore errors during dependency checking
    }
    return [];
  }

  /**
   * Load plugin module without executing it
   */
  private async loadPluginModule(config: PluginConfig): Promise<MarkoPressPlugin | null> {
    try {
      if (typeof config === 'string') {
        const module = await import(config);
        return module.default;
      } else if (Array.isArray(config)) {
        const [name] = config;
        const module = await import(name);
        return module.default;
      } else {
        return config;
      }
    } catch {
      return null;
    }
  }

  /**
   * Load a single plugin with error isolation
   */
  private async loadPlugin(pluginConfig: PluginConfig): Promise<PluginLoadResult | null> {
    const pluginName = this.getPluginName(pluginConfig);

    try {
      let plugin: MarkoPressPlugin;

      if (typeof pluginConfig === 'string') {
        // Load from package name
        const module = await import(pluginConfig);
        plugin = module.default;
      } else if (Array.isArray(pluginConfig)) {
        // Load with options
        const [name, options] = pluginConfig;
        const module = await import(name);
        plugin = typeof module.default === 'function'
          ? await module.default(options)
          : module.default;
      } else {
        // Inline plugin
        plugin = pluginConfig;
      }

      if (!plugin || !plugin.name) {
        throw new Error(`Invalid plugin: ${pluginName} - must have a 'name' property`);
      }

      // Execute config hook if present
      if (plugin.config) {
        const originalConfig = { ...this.config };
        try {
          this.config = await plugin.config(this.config);
        } catch (error) {
          console.error(
            `Plugin ${plugin.name} config hook failed, using original config:`,
            error
          );
          this.config = originalConfig;
        }
      }

      return { plugin, config: pluginConfig };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to load plugin ${pluginName}: ${errorMsg}`);
      return {
        plugin: { name: pluginName },
        config: pluginConfig,
        error: error instanceof Error ? error : new Error(errorMsg),
      };
    }
  }

  /**
   * Get all loaded plugins
   */
  getPlugins(): MarkoPressPlugin[] {
    return this.plugins;
  }

  /**
   * Get plugin load results (including errors)
   */
  getLoadResults(): PluginLoadResult[] {
    return this.loadResults;
  }

  /**
   * Execute markdown hooks on all plugins
   */
  async execMarkdownHooks(md: MarkdownIt): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.extendMarkdown) {
        try {
          await plugin.extendMarkdown(md);
        } catch (error) {
          console.error(
            `Plugin ${plugin.name} extendMarkdown hook failed:`,
            error
          );
        }
      }
    }
  }

  /**
   * Execute contentLoaded hooks on all plugins
   */
  async execContentLoadedHooks(manifest: ContentManifest): Promise<void> {
    const ctx = this.createContentContext(manifest);

    for (const plugin of this.plugins) {
      if (plugin.contentLoaded) {
        try {
          await plugin.contentLoaded(ctx);
        } catch (error) {
          console.error(
            `Plugin ${plugin.name} contentLoaded hook failed:`,
            error
          );
        }
      }
    }
  }

  /**
   * Execute beforeBuild hooks on all plugins
   */
  async execBeforeBuildHooks(manifest: ContentManifest, routes: RouteManifest): Promise<void> {
    const ctx = this.createBuildContext(manifest, routes);

    for (const plugin of this.plugins) {
      if (plugin.beforeBuild) {
        try {
          await plugin.beforeBuild(ctx);
        } catch (error) {
          console.error(
            `Plugin ${plugin.name} beforeBuild hook failed:`,
            error
          );
        }
      }
    }
  }

  /**
   * Execute afterBuild hooks on all plugins
   */
  async execAfterBuildHooks(manifest: ContentManifest, routes: RouteManifest): Promise<void> {
    const ctx = this.createBuildContext(manifest, routes);

    for (const plugin of this.plugins) {
      if (plugin.afterBuild) {
        try {
          await plugin.afterBuild(ctx);
        } catch (error) {
          console.error(
            `Plugin ${plugin.name} afterBuild hook failed:`,
            error
          );
        }
      }
    }
  }

  /**
   * Execute extendRoutes hooks on all plugins
   */
  async execExtendRoutesHooks(routes: RouteManifest): Promise<RouteManifest> {
    let result = routes;

    for (const plugin of this.plugins) {
      if (plugin.extendRoutes) {
        try {
          result = await plugin.extendRoutes(result) || result;
        } catch (error) {
          console.error(
            `Plugin ${plugin.name} extendRoutes hook failed:`,
            error
          );
        }
      }
    }

    return result;
  }

  /**
   * Create plugin context
   */
  createPluginContext(): PluginContext {
    return {
      config: this.config,
      utils: {
        log: (msg: string) => console.log(`[markopress] ${msg}`),
        warn: (msg: string) => console.warn(`[markopress] ${msg}`),
        error: (msg: string) => console.error(`[markopress] ${msg}`),
      },
    };
  }

  /**
   * Create content context
   */
  createContentContext(manifest: ContentManifest): ContentContext {
    const baseContext = this.createPluginContext();

    return {
      ...baseContext,
      addPage: (page: PageData) => {
        manifest.pages.push(page);
      },
      addPost: (post: PostData) => {
        manifest.blog.push(post);
      },
      getPages: () => manifest.pages,
      getPosts: () => manifest.blog,
    };
  }

  /**
   * Create build context
   */
  createBuildContext(manifest: ContentManifest, routes: RouteManifest): BuildContext {
    const baseContext = this.createPluginContext();

    return {
      ...baseContext,
      content: manifest,
      routes,
    };
  }
}

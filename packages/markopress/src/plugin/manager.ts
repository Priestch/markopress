/**
 * Plugin manager for MarkoPress
 * Manages plugin lifecycle, dependencies, and hook execution
 */

import type {
  MarkoPressPlugin,
  PluginConfig,
  PluginContext,
  BuildContext,
  ContentManifest,
  RouteManifest,
  PluginContent,
  RouteConfig,
} from './types.js';
import type { ContentFile } from '../content/types.js';
import type { ContentModule } from '../content/registry.js';
import type { ResolvedConfig } from '../config/index.js';
import MarkdownIt from 'markdown-it';
import { AllContentImpl, ContentActionsImpl } from './context.js';
import { wrapLegacyPlugin } from './compat.js';

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
  private allContent = new AllContentImpl();
  private contentActions = new ContentActionsImpl();

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
        // Wrap plugin for backward compatibility
        const wrappedPlugin = wrapLegacyPlugin(result.plugin);

        this.plugins.push(wrappedPlugin);
        this.loadResults.push(result);
        this.pluginLoadOrder.push(wrappedPlugin.name);
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
   * Resolve plugin name to import path
   * Built-in plugins are resolved from markopress/plugins/*
   * External plugins are resolved by package name
   */
  private resolvePluginPath(name: string): string {
    // Built-in plugins - simple names like 'sidenav', 'toc', 'blog-index', 'seo'
    const builtInPlugins = ['sidenav', 'toc', 'blog-index', 'seo'];
    if (builtInPlugins.includes(name)) {
      return `../plugins/${name}/index.js`;
    }
    return name;
  }

  /**
   * Load plugin module without executing it
   */
  private async loadPluginModule(config: PluginConfig): Promise<MarkoPressPlugin | null> {
    try {
      if (typeof config === 'string') {
        const module = await import(this.resolvePluginPath(config));
        return module.default;
      } else if (Array.isArray(config)) {
        const [name] = config;
        const module = await import(this.resolvePluginPath(name));
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
        // Load from package name (resolve built-in or external)
        const module = await import(this.resolvePluginPath(pluginConfig));
        // Check if default export is a function (plugin factory)
        plugin = typeof module.default === 'function'
          ? await module.default()
          : module.default;
      } else if (Array.isArray(pluginConfig)) {
        // Load with options
        const [name, options] = pluginConfig;
        const module = await import(this.resolvePluginPath(name));
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
   * Execute loadContent hooks on all plugins
   * Allows plugins to load content from external sources
   */
  async execLoadContentHooks(): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.loadContent) {
        try {
          const content = await plugin.loadContent();
          this.allContent.addPluginContent(plugin.name, content);
        } catch (error) {
          console.error(
            `Plugin ${plugin.name} loadContent hook failed:`,
            error
          );
        }
      }
    }
  }

  /**
   * Execute enhanceModules hooks on all plugins
   * Allows plugins to enhance content modules with metadata
   */
  async execEnhanceModulesHooks(modules: ContentModule[]): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.enhanceModules) {
        try {
          // Filter modules based on plugin's modules declaration
          let modulesToEnhance = modules;
          if (plugin.modules && plugin.modules.length > 0) {
            modulesToEnhance = modules.filter(m =>
              plugin.modules!.includes(m.id)
            );
          }

          await plugin.enhanceModules(modulesToEnhance);
        } catch (error) {
          console.error(
            `Plugin ${plugin.name} enhanceModules hook failed:`,
            error
          );
        }
      }
    }
  }

  /**
   * Execute contentLoaded hooks with enhanced context
   */
  async execContentLoadedHooks(manifest?: ContentManifest): Promise<void> {
    // No need to merge manifest - plugins work directly with dynamic modules
    for (const plugin of this.plugins) {
      if (plugin.contentLoaded) {
        try {
          // Get plugin's own content
          const pluginContent = this.allContent.getContent(plugin.name)[0] as PluginContent || {};

          await plugin.contentLoaded({
            content: pluginContent,
            allContent: this.allContent,
            actions: this.contentActions,
          } as any);
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
   * Execute allContentLoaded hooks on all plugins
   * Called after all plugins have processed their content
   */
  async execAllContentLoadedHooks(routes: RouteManifest): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.allContentLoaded) {
        try {
          await plugin.allContentLoaded({
            allContent: this.allContent,
            routes,
            actions: this.contentActions,
          });
        } catch (error) {
          console.error(
            `Plugin ${plugin.name} allContentLoaded hook failed:`,
            error
          );
        }
      }
    }
  }

  /**
   * Execute postBuild hooks on all plugins
   */
  async execPostBuildHooks(
    config: ResolvedConfig,
    outDir: string,
    routes: RouteManifest,
    assets: string[]
  ): Promise<void> {
    // Execute postBuild hooks
    for (const plugin of this.plugins) {
      if (plugin.postBuild) {
        try {
          await plugin.postBuild({
            config,
            outDir,
            routes,
            assets,
            allContent: this.allContent,
          });
        } catch (error) {
          console.error(
            `Plugin ${plugin.name} postBuild hook failed:`,
            error
          );
        }
      }
    }
  }

  /**
   * Get plugin-generated routes
   */
  getPluginRoutes(): RouteConfig[] {
    return this.contentActions.getAllRoutes();
  }

  /**
   * Get plugin data
   */
  getPluginData(): Map<string, unknown> {
    return this.contentActions.getData();
  }

  /**
   * Clear plugin state
   */
  clear(): void {
    this.allContent = new AllContentImpl();
    this.contentActions = new ContentActionsImpl();
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

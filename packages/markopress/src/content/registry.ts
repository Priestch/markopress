/**
 * Module Registry
 *
 * Central registry for managing content modules during the build process.
 */

import type { ContentModule } from './module.js';

/**
 * Module registry for managing content modules
 */
export class ModuleRegistry {
  private modules: Map<string, ContentModule>;

  constructor() {
    this.modules = new Map();
  }

  /**
   * Register a module
   * @param module - Module to register
   * @throws Error if module with same ID already exists
   */
  register(module: ContentModule): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Module with ID '${module.id}' already exists`);
    }
    this.modules.set(module.id, module);
  }

  /**
   * Get a module by ID
   * @param id - Module ID
   * @returns Module or undefined if not found
   */
  get(id: string): ContentModule | undefined {
    return this.modules.get(id);
  }

  /**
   * Get all registered modules
   * @returns Array of all modules
   */
  getAll(): ContentModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get modules by type
   * @param type - Module type to filter by
   * @returns Array of modules of the specified type
   */
  getByType(type: ContentModule['type']): ContentModule[] {
    return this.getAll().filter((module) => module.type === type);
  }

  /**
   * Enhance a specific module
   * @param id - Module ID
   * @param key - Enhancement key
   * @param data - Enhancement data
   * @throws Error if module not found
   */
  enhance(id: string, key: string, data: unknown): void {
    const module = this.modules.get(id);
    if (!module) {
      throw new Error(`Module with ID '${id}' not found`);
    }
    module.enhance(key, data);
  }

  /**
   * Check if a module exists
   * @param id - Module ID
   * @returns true if module exists
   */
  has(id: string): boolean {
    return this.modules.has(id);
  }

  /**
   * Get all module IDs
   * @returns Array of module IDs
   */
  getIds(): string[] {
    return Array.from(this.modules.keys());
  }

  /**
   * Clear all modules from the registry
   */
  clear(): void {
    this.modules.clear();
  }

  /**
   * Get the number of registered modules
   * @returns Number of modules
   */
  get size(): number {
    return this.modules.size;
  }
}

/**
 * Create a new module registry instance
 */
export function createModuleRegistry(): ModuleRegistry {
  return new ModuleRegistry();
}

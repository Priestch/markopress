/**
 * Module Registry Stub
 *
 * Kept for backward compatibility. Content modules have been removed
 * in favor of request-time rendering.
 */

/**
 * Stub ContentModule type for backward compatibility
 */
export type ContentModule = any;

/**
 * Module registry stub - no-op since content is rendered at request time
 */
export class ModuleRegistry {
  register(_module: ContentModule): void {
    // No-op: modules no longer used
  }

  get(_id: string): ContentModule | undefined {
    return undefined;
  }

  getAll(): ContentModule[] {
    return [];
  }

  getByType(_type: string): ContentModule[] {
    return [];
  }

  enhance(_id: string, _key: string, _data: unknown): void {
    // No-op
  }

  has(_id: string): boolean {
    return false;
  }

  getIds(): string[] {
    return [];
  }

  clear(): void {
    // No-op
  }

  get size(): number {
    return 0;
  }
}

/**
 * Create a new module registry instance
 */
export function createModuleRegistry(): ModuleRegistry {
  return new ModuleRegistry();
}

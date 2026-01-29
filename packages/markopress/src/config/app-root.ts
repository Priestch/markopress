import path from 'node:path';
import fs from 'node:fs';

export interface ResolveAppRootOptions {
  cwd?: string;
  appDirName?: string;
}

/**
 * Resolve the app root directory.
 * If appDirName exists as a directory under cwd, returns that path.
 * Otherwise returns cwd.
 */
export function resolveAppRoot(options: ResolveAppRootOptions = {}): string {
  const cwd = options.cwd ?? process.cwd();
  const appDirName = options.appDirName ?? '.markopress';
  const candidate = path.join(cwd, appDirName);

  // Check if candidate exists and is a directory
  try {
    const stat = fs.statSync(candidate);
    if (stat.isDirectory()) {
      return candidate;
    }
  } catch {
    // Doesn't exist or isn't accessible, fall through to returning cwd
  }

  return cwd;
}

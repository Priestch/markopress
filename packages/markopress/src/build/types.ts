/**
 * Build system types
 */

export interface BuildOptions {
  useCatchAllRoutes?: boolean;
  outDir?: string;
  debug?: boolean;
  root?: string;
}

export interface BuildResult {
  success: boolean;
  outDir: string;
  pages: number;
  errors: string[];
}

export interface PreviewOptions {
  port?: number;
  host?: string;
  root?: string;
}

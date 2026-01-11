/**
 * Build system types
 */

export interface BuildOptions {
  outDir?: string;
  debug?: boolean;
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
}

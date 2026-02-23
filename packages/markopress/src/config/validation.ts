/**
 * Configuration validation using Zod
 * Provides runtime validation and type safety for user config
 */

import { z } from 'zod';

/**
 * Site configuration schema
 */
const SiteConfigSchema = z.object({
  title: z.string().min(1, { message: 'Site title is required' }).max(100, { message: 'Site title too long' }),
  description: z.string().max(500, { message: 'Description too long' }).optional(),
  base: z.string().startsWith('/', { message: 'Base must start with /' }).optional(),
  lang: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, { message: 'Invalid language code' }).optional(),
  head: z.array(z.tuple([z.string(), z.record(z.string(), z.string())])).optional(),
});

/**
 * Content configuration schema
 * Allows arbitrary module names (e.g., pages, guides, docs, blog, tutorials, etc.)
 * Each entry can be a string (directory path) or an object with options
 */
const ContentEntrySchema = z.union([
  z.string(),
  z.object({
    dir: z.string().optional(),
    sidebar: z.boolean().optional(),
    toc: z.boolean().optional(),
    rss: z.boolean().optional(),
    list: z.boolean().optional(),
  }).passthrough(),
]);
const ContentConfigSchema = z.record(z.string(), ContentEntrySchema);

/**
 * Navigation item schema
 */
const NavItemSchema = z.object({
  text: z.string().min(1, { message: 'Nav item text is required' }),
  link: z.string().min(1, { message: 'Nav item link is required' }),
});

/**
 * Sidebar item schema
 */
const SidebarItemSchema = z.object({
  text: z.string().min(1, { message: 'Sidebar item text is required' }),
  link: z.string().min(1, { message: 'Sidebar item link is required' }),
});

/**
 * Sidebar configuration schema
 */
const SidebarConfigSchema = z.record(
  z.string(),
  z.union([
    z.array(SidebarItemSchema),
    z.object({ autoGenerate: z.boolean() }),
  ])
);

/**
 * Theme options schema
 */
const ThemeOptionsSchema = z.object({
  navbar: z.array(NavItemSchema).optional(),
  sidebar: SidebarConfigSchema.optional(),
}).passthrough(); // Allow additional properties

/**
 * Theme configuration schema
 */
const ThemeConfigSchema = z.object({
  name: z.string()
    .regex(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/, { message: 'Invalid theme name' })
    .refine(
      (name) => !name.includes('..'),
      { message: 'Theme name cannot contain path traversal' }
    )
    .optional(),
  designSystem: z.enum(['vitepress', 'docusaurus', 'rspress']).optional(),
  options: ThemeOptionsSchema.optional(),
});

/**
 * Markdown configuration schema
 */
const MarkdownConfigSchema = z.object({
  lineNumbers: z.boolean().optional(),
  theme: z.object({
    light: z.string().optional(),
    dark: z.string().optional(),
  }).optional(),
  markoTags: z.object({
    enabled: z.boolean().optional(),
    tagsDir: z.string().optional(),
  }).optional(),
});

/**
 * Build configuration schema
 */
const BuildConfigSchema = z.object({
  useCatchAllRoutes: z.boolean().optional(),
  outDir: z.string().optional(),
  assetsDir: z.string().optional(),
  sourcemap: z.boolean().optional(),
  minify: z.boolean().optional(),
  clean: z.boolean().optional(),
}).passthrough();

/**
 * Plugin configuration schema
 * Supports: string | [string, options] | { name, options }
 */
const PluginConfigSchema = z.union([
  z.string(),
  z.tuple([z.string(), z.record(z.string(), z.unknown()).optional()]),
  z.object({
    name: z.string().min(1, { message: 'Plugin name is required' }),
    options: z.record(z.string(), z.unknown()).optional(),
  }),
]);

/**
 * Main MarkoPress configuration schema
 */
export const MarkoPressConfigSchema = z.object({
  site: SiteConfigSchema,
  contentDir: z.string().optional(),
  content: ContentConfigSchema.optional(),
  theme: ThemeConfigSchema.optional(),
  markdown: MarkdownConfigSchema.optional(),
  build: BuildConfigSchema.optional(),
  search: z.object({
    enabled: z.boolean().optional(),
  }).passthrough().optional(),
  plugins: z.array(PluginConfigSchema).optional(),
});

/**
 * Validate user configuration
 * @param config - User configuration to validate
 * @returns Validated configuration
 * @throws {z.ZodError} If validation fails
 */
export function validateConfig(config: unknown) {
  return MarkoPressConfigSchema.parse(config);
}

/**
 * Validate user configuration with detailed error messages
 * @param config - User configuration to validate
 * @returns Result with success status and data or errors
 */
export function validateConfigSafe(config: unknown) {
  const result = MarkoPressConfigSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
    }));

    return {
      success: false as const,
      errors,
    };
  }

  return {
    success: true as const,
    data: result.data,
  };
}

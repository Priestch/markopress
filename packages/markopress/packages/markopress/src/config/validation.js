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
 */
const ContentConfigSchema = z.object({
    pages: z.string().optional(),
    docs: z.string().optional(),
    blog: z.string().optional(),
});
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
const SidebarConfigSchema = z.record(z.string(), z.union([
    z.array(SidebarItemSchema),
    z.object({ autoGenerate: z.boolean() }),
]));
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
        .refine((name) => !name.includes('..'), { message: 'Theme name cannot contain path traversal' })
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
});
/**
 * Build configuration schema
 */
const BuildConfigSchema = z.object({
    outDir: z.string().optional(),
    assetsDir: z.string().optional(),
});
/**
 * Plugin configuration schema
 */
const PluginConfigSchema = z.union([
    z.string(),
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
    content: ContentConfigSchema.optional(),
    theme: ThemeConfigSchema.optional(),
    markdown: MarkdownConfigSchema.optional(),
    build: BuildConfigSchema.optional(),
    plugins: z.array(PluginConfigSchema).optional(),
});
/**
 * Validate user configuration
 * @param config - User configuration to validate
 * @returns Validated configuration
 * @throws {z.ZodError} If validation fails
 */
export function validateConfig(config) {
    return MarkoPressConfigSchema.parse(config);
}
/**
 * Validate user configuration with detailed error messages
 * @param config - User configuration to validate
 * @returns Result with success status and data or errors
 */
export function validateConfigSafe(config) {
    const result = MarkoPressConfigSchema.safeParse(config);
    if (!result.success) {
        const errors = result.error.issues.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
        }));
        return {
            success: false,
            errors,
        };
    }
    return {
        success: true,
        data: result.data,
    };
}

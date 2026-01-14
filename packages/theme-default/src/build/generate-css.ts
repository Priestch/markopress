/**
 * CSS Variable Generator
 * Converts design tokens into CSS custom properties
 */

import type { DesignSystem, ColorTokens, TypographyTokens, SpacingTokens, EffectTokens, LayoutTokens } from '../design-systems/types.js';

/**
 * Generate CSS variables from design system
 * @param designSystem - Design system object
 * @param darkMode - Whether to generate dark mode variables
 * @returns CSS string with :root variables
 */
export function generateCSSVariables(designSystem: DesignSystem, darkMode: boolean = false): string {
  const lines: string[] = [];

  // Root selector
  lines.push(darkMode ? ':root.dark,' : ':root,');
  lines.push(darkMode ? 'html.dark {' : 'html {');

  // Colors
  generateColorVariables(lines, designSystem.colors);

  // Typography
  generateTypographyVariables(lines, designSystem.typography);

  // Spacing
  generateSpacingVariables(lines, designSystem.spacing);

  // Effects (shadows, border radius, transitions)
  generateEffectVariables(lines, designSystem.effects);

  // Layout (dimensions, z-index)
  generateLayoutVariables(lines, designSystem.layout);

  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate color CSS variables
 */
function generateColorVariables(lines: string[], colors: ColorTokens): void {
  // Primary colors
  lines.push(`  --color-primary-1: ${colors.primary['1']};`);
  lines.push(`  --color-primary-2: ${colors.primary['2']};`);
  lines.push(`  --color-primary-3: ${colors.primary['3']};`);
  lines.push(`  --color-primary-soft: ${colors.primary.soft};`);

  // Semantic colors (success, warning, danger, info)
  (['success', 'warning', 'danger', 'info'] as const).forEach((color) => {
    lines.push(`  --color-${color}-1: ${colors[color]['1']};`);
    lines.push(`  --color-${color}-2: ${colors[color]['2']};`);
    lines.push(`  --color-${color}-3: ${colors[color]['3']};`);
    lines.push(`  --color-${color}-soft: ${colors[color].soft};`);
  });

  // Gray scale
  lines.push(`  --color-gray-1: ${colors.gray['1']};`);
  lines.push(`  --color-gray-2: ${colors.gray['2']};`);
  lines.push(`  --color-gray-3: ${colors.gray['3']};`);
  lines.push(`  --color-gray-soft: ${colors.gray.soft};`);

  // Background colors
  lines.push(`  --bg-default: ${colors.bg.default};`);
  lines.push(`  --bg-alt: ${colors.bg.alt};`);
  lines.push(`  --bg-elevated: ${colors.bg.elevated};`);
  lines.push(`  --bg-soft: ${colors.bg.soft};`);

  // Text colors
  lines.push(`  --text-1: ${colors.text['1']};`);
  lines.push(`  --text-2: ${colors.text['2']};`);
  lines.push(`  --text-3: ${colors.text['3']};`);

  // Border colors
  lines.push(`  --border-default: ${colors.border.default};`);
  lines.push(`  --border-divider: ${colors.border.divider};`);
  lines.push(`  --border-gutter: ${colors.border.gutter};`);

  // Divider
  lines.push(`  --divider: ${colors.divider};`);

  // Soft backgrounds
  lines.push(`  --soft-brand: ${colors.soft.brand};`);
  lines.push(`  --soft-gray: ${colors.soft.gray};`);
}

/**
 * Generate typography CSS variables
 */
function generateTypographyVariables(lines: string[], typography: TypographyTokens): void {
  // Font families
  lines.push(`  --font-sans: ${typography.fontFamily.sans};`);
  lines.push(`  --font-mono: ${typography.fontFamily.mono};`);

  // Font sizes
  lines.push(`  --font-size-xs: ${typography.fontSize.xs};`);
  lines.push(`  --font-size-sm: ${typography.fontSize.sm};`);
  lines.push(`  --font-size-base: ${typography.fontSize.base};`);
  lines.push(`  --font-size-lg: ${typography.fontSize.lg};`);
  lines.push(`  --font-size-xl: ${typography.fontSize.xl};`);
  lines.push(`  --font-size-2xl: ${typography.fontSize['2xl']};`);
  lines.push(`  --font-size-3xl: ${typography.fontSize['3xl']};`);
  lines.push(`  --font-size-4xl: ${typography.fontSize['4xl']};`);

  // Font weights
  lines.push(`  --font-weight-normal: ${typography.fontWeight.normal};`);
  lines.push(`  --font-weight-medium: ${typography.fontWeight.medium};`);
  lines.push(`  --font-weight-semibold: ${typography.fontWeight.semibold};`);
  lines.push(`  --font-weight-bold: ${typography.fontWeight.bold};`);

  // Line heights
  lines.push(`  --line-height-tight: ${typography.lineHeight.tight};`);
  lines.push(`  --line-height-normal: ${typography.lineHeight.normal};`);
  lines.push(`  --line-height-relaxed: ${typography.lineHeight.relaxed};`);

  // Letter spacing (optional)
  if (typography.letterSpacing) {
    if (typography.letterSpacing.tight) {
      lines.push(`  --letter-spacing-tight: ${typography.letterSpacing.tight};`);
    }
    if (typography.letterSpacing.normal) {
      lines.push(`  --letter-spacing-normal: ${typography.letterSpacing.normal};`);
    }
    if (typography.letterSpacing.wide) {
      lines.push(`  --letter-spacing-wide: ${typography.letterSpacing.wide};`);
    }
  }
}

/**
 * Generate spacing CSS variables
 */
function generateSpacingVariables(lines: string[], spacing: SpacingTokens): void {
  lines.push(`  --spacing-xs: ${spacing.scale.xs};`);
  lines.push(`  --spacing-sm: ${spacing.scale.sm};`);
  lines.push(`  --spacing-md: ${spacing.scale.md};`);
  lines.push(`  --spacing-lg: ${spacing.scale.lg};`);
  lines.push(`  --spacing-xl: ${spacing.scale.xl};`);
  lines.push(`  --spacing-2xl: ${spacing.scale['2xl']};`);
  lines.push(`  --spacing-3xl: ${spacing.scale['3xl']};`);
  lines.push(`  --spacing-4xl: ${spacing.scale['4xl']};`);
}

/**
 * Generate effect CSS variables (shadows, border radius, transitions)
 */
function generateEffectVariables(lines: string[], effects: EffectTokens): void {
  // Shadows
  lines.push(`  --shadow-1: ${effects.shadows['1']};`);
  lines.push(`  --shadow-2: ${effects.shadows['2']};`);
  lines.push(`  --shadow-3: ${effects.shadows['3']};`);
  lines.push(`  --shadow-4: ${effects.shadows['4']};`);
  lines.push(`  --shadow-5: ${effects.shadows['5']};`);

  // Border radius
  lines.push(`  --radius-sm: ${effects.borderRadius.sm};`);
  lines.push(`  --radius-md: ${effects.borderRadius.md};`);
  lines.push(`  --radius-lg: ${effects.borderRadius.lg};`);

  // Transitions
  if (effects.transitions.base) {
    lines.push(`  --transition-base: ${effects.transitions.base};`);
  }
  if (effects.transitions.fast) {
    lines.push(`  --transition-fast: ${effects.transitions.fast};`);
  }
  if (effects.transitions.slow) {
    lines.push(`  --transition-slow: ${effects.transitions.slow};`);
  }
}

/**
 * Generate layout CSS variables (dimensions, z-index)
 */
function generateLayoutVariables(lines: string[], layout: LayoutTokens): void {
  // Dimensions
  lines.push(`  --layout-max-width: ${layout.maxWidth};`);
  lines.push(`  --navbar-height: ${layout.navbarHeight};`);
  lines.push(`  --sidebar-width: ${layout.sidebarWidth};`);
  if (layout.tocWidth) {
    lines.push(`  --toc-width: ${layout.tocWidth};`);
  }

  // Z-index
  lines.push(`  --z-footer: ${layout.zIndex.footer};`);
  lines.push(`  --z-local-nav: ${layout.zIndex.localNav};`);
  lines.push(`  --z-nav: ${layout.zIndex.nav};`);
  lines.push(`  --z-layout-top: ${layout.zIndex.layoutTop};`);
  lines.push(`  --z-backdrop: ${layout.zIndex.backdrop};`);
  lines.push(`  --z-sidebar: ${layout.zIndex.sidebar};`);
}

/**
 * Generate complete CSS theme file
 * @param designSystem - Design system object
 * @returns Complete CSS with light and dark mode
 */
export function generateThemeCSS(designSystem: DesignSystem): string {
  const lines: string[] = [];

  // Header comment
  lines.push(`/*`);
  lines.push(` * ${designSystem.name} Design System`);
  lines.push(` * Version: ${designSystem.version}`);
  if (designSystem.description) {
    lines.push(` * ${designSystem.description}`);
  }
  lines.push(` * Auto-generated from design tokens`);
  lines.push(` */`);
  lines.push('');

  // Light mode
  lines.push(generateCSSVariables(designSystem, false));
  lines.push('');

  // Dark mode (if override exists)
  const darkOverride = getDarkModeOverride(designSystem.name);
  if (darkOverride) {
    const darkSystem = { ...designSystem, ...darkOverride };
    lines.push(generateCSSVariables(darkSystem, true));
  }

  return lines.join('\n');
}

/**
 * Get dark mode override for a design system
 * (This would import from the design-systems/index in actual implementation)
 */
function getDarkModeOverride(name: string): any {
  // TODO: Import from design-systems/index
  // For now, return null to skip dark mode
  return null;
}

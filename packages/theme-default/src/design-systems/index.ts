/**
 * Design System Registry
 * Central registry for all design system presets
 */

export { vitepress, vitepressDark } from './vitepress.js';
export { docusaurus, docusaurusDark } from './docusaurus.js';
export { rspress, rspressDark } from './rspress.js';
export { defaultPreset, defaultDark } from './default.js';
export type { DesignSystem, ColorTokens, TypographyTokens, SpacingTokens, EffectTokens, LayoutTokens, ComponentTokens } from './types.js';

import { vitepress, vitepressDark } from './vitepress.js';
import { docusaurus, docusaurusDark } from './docusaurus.js';
import { rspress, rspressDark } from './rspress.js';
import { defaultPreset, defaultDark } from './default.js';
import type { DesignSystem } from './types.js';

/**
 * All available design systems
 */
export const designSystems = {
  default: defaultPreset,
  vitepress,
  docusaurus,
  rspress,
} as const;

/**
 * Dark mode overrides for each design system
 */
export const darkModeOverrides = {
  default: defaultDark,
  vitepress: vitepressDark,
  docusaurus: docusaurusDark,
  rspress: rspressDark,
} as const;

/**
 * Available design system names
 */
export type DesignSystemName = keyof typeof designSystems;

/**
 * Get a design system by name
 * @param name - Design system name
 * @returns Design system object
 */
export function getDesignSystem(name: DesignSystemName): DesignSystem {
  return designSystems[name];
}

/**
 * Get dark mode override for a design system
 * @param name - Design system name
 * @returns Partial design system with dark mode overrides
 */
export function getDarkModeOverride(name: DesignSystemName): Partial<DesignSystem> {
  return darkModeOverrides[name];
}

/**
 * List all available design system names
 * @returns Array of design system names
 */
export function listDesignSystems(): DesignSystemName[] {
  return Object.keys(designSystems) as DesignSystemName[];
}

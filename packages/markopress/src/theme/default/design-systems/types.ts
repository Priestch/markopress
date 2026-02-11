/**
 * MarkoPress Design System Types
 * Flexible theming architecture for switching between documentation site styles
 */

/**
 * Complete design system definition
 */
export interface DesignSystem {
  name: string;
  version: string;
  description?: string;

  // Color tokens
  colors: ColorTokens;

  // Typography
  typography: TypographyTokens;

  // Spacing
  spacing: SpacingTokens;

  // Effects
  effects: EffectTokens;

  // Layout
  layout: LayoutTokens;

  // Component-specific overrides
  components?: ComponentTokens;
}

/**
 * Color tokens
 */
export interface ColorTokens {
  // Semantic colors
  primary: ColorScale;
  success: ColorScale;
  warning: ColorScale;
  danger: ColorScale;
  info: ColorScale;

  // Gray scale
  gray: GrayScaleTokens;

  // Background colors
  bg: BackgroundTokens;

  // Text colors
  text: TextTokens;

  // Border colors
  border: BorderTokens;

  // Divider colors
  divider: string;

  // Soft backgrounds (for highlighting)
  soft: {
    brand: string;
    gray: string;
  };
}

/**
 * Color scale with 3 levels (light, normal, dark variants)
 */
export interface ColorScale {
  '1': string;  // Lightest (for dark mode text)
  '2': string;  // Light
  '3': string;  // Normal (base color)
  soft: string; // Soft background variant
}

/**
 * Gray scale tokens
 */
export interface GrayScaleTokens {
  '1': string;
  '2': string;
  '3': string;
  soft: string;
}

/**
 * Background color tokens
 */
export interface BackgroundTokens {
  default: string;    // Main background
  alt: string;        // Alternative background
  elevated: string;   // Elevated surfaces (cards, modals)
  soft: string;       // Soft background for sections
}

/**
 * Text color tokens
 */
export interface TextTokens {
  '1': string;  // Primary text
  '2': string;  // Muted text
  '3': string;  // Subtle text
  code?: string; // Inline code
}

/**
 * Border color tokens
 */
export interface BorderTokens {
  default: string;   // Interactive borders
  divider: string;   // Separator lines
  gutter: string;    // Component dividers
}

/**
 * Typography tokens
 */
export interface TypographyTokens {
  // Font families
  fontFamily: {
    sans: string;
    mono: string;
  };

  // Font sizes
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
  };

  // Font weights
  fontWeight: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };

  // Line heights
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };

  // Letter spacing (optional)
  letterSpacing?: {
    tight?: string;
    normal?: string;
    wide?: string;
  };
}

/**
 * Spacing tokens
 */
export interface SpacingTokens {
  scale: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
  };
}

/**
 * Effect tokens (shadows, radius, transitions)
 */
export interface EffectTokens {
  // Shadow scale
  shadows: {
    '1': string;
    '2': string;
    '3': string;
    '4': string;
    '5': string;
  };

  // Border radius
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    full?: string;
  };

  // Transitions
  transitions: {
    base?: string;
    fast?: string;
    slow?: string;
  };
}

/**
 * Layout tokens
 */
export interface LayoutTokens {
  // Dimensions
  maxWidth: string;
  navbarHeight: string;
  sidebarWidth: string;
  tocWidth?: string;

  // Z-index scale
  zIndex: {
    footer: number;
    localNav: number;
    nav: number;
    layoutTop: number;
    backdrop: number;
    sidebar: number;
  };
}

/**
 * Component-specific tokens (optional)
 */
export interface ComponentTokens {
  navbar?: {
    height?: string;
    padding?: string;
    background?: string;
    border?: string;
    borderWidth?: string;
    shadow?: string;
    logoHeight?: string;
    itemPadding?: string;
    itemGap?: string;
  };

  sidebar?: {
    width?: string;
    padding?: string;
    background?: string;
    border?: string;
    itemHeight?: string;
    itemPadding?: string;
    itemGap?: string;
    itemBorderRadius?: string;
    itemFontSize?: string;
    itemFontWeight?: number;
    activeBackground?: string;
    activeBorder?: string;
    hoverBackground?: string;
    categoryPadding?: string;
    categoryFontSize?: string;
    categoryFontWeight?: number;
    categoryTextTransform?: string;
  };

  content?: {
    maxWidth?: string;
    padding?: string;
    fontSize?: string;
    lineHeight?: number;
  };

  code?: {
    fontSize?: string;
    lineHeight?: number;
    background?: string;
    color?: string;
    borderRadius?: string;
    padding?: string;
    blockPadding?: string;
    blockBorderRadius?: string;
  };

  heading?: {
    h1FontSize?: string;
    h2FontSize?: string;
    h3FontSize?: string;
    h4FontSize?: string;
    h1FontWeight?: number;
    h2FontWeight?: number;
    h3FontWeight?: number;
    h1LineHeight?: number;
    h2LineHeight?: number;
    h3LineHeight?: number;
    marginTop?: string;
    marginBottom?: string;
  };

  [key: string]: any;
}

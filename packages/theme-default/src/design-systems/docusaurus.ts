/**
 * Docusaurus Design System Preset
 * Based on Infima CSS framework
 * Reference: https://docusaurus.io/docs/styling-layout
 */

import type { DesignSystem } from './types.js';

export const docusaurus: DesignSystem = {
  name: 'docusaurus',
  version: '1.0.0',
  description: 'Docusaurus design system (Infima framework - Blue-based)',

  colors: {
    // Primary brand color (Blue)
    primary: {
      '1': '#1e80c4',  // Primary text/link color
      '2': '#2970c9',  // Hover state
      '3': '#3e6cd4',  // Background color
      soft: 'rgba(30, 128, 196, 0.1)',
    },

    // Success (Green)
    success: {
      '1': '#00bfa5',
      '2': '#00d4a4',
      '3': '#00e4a5',
      soft: 'rgba(0, 191, 165, 0.1)',
    },

    // Warning (Orange/Yellow)
    warning: {
      '1': '#e66c00',
      '2': '#ff7b00',
      '3': '#ff8d00',
      soft: 'rgba(230, 108, 0, 0.1)',
    },

    // Danger (Red)
    danger: {
      '1': '#c41818',
      '2': '#dc1e1e',
      '3': '#e62525',
      soft: 'rgba(196, 24, 24, 0.1)',
    },

    // Info (Blue)
    info: {
      '1': '#1877f2',
      '2': '#2d88ff',
      '3': '#4c8dff',
      soft: 'rgba(24, 119, 242, 0.1)',
    },

    // Gray scale (Light mode)
    gray: {
      '1': '#d8d8d8',
      '2': '#e8e8e8',
      '3': '#f0f0f0',
      soft: 'rgba(168, 168, 168, 0.15)',
    },

    // Background colors (Light mode)
    bg: {
      default: '#ffffff',
      alt: '#fafafa',
      elevated: '#ffffff',
      soft: '#f5f5f5',
    },

    // Text colors (Light mode)
    text: {
      '1': '#1b1b1b',  // Primary text
      '2': '#5a5a5a',  // Muted text
      '3': '#8a8a8a',  // Subtle text
    },

    // Border colors (Light mode)
    border: {
      default: '#dcdcdc',
      divider: '#eaeaea',
      gutter: '#eaeaea',
    },

    // Divider
    divider: '#eaeaea',

    // Soft backgrounds
    soft: {
      brand: 'rgba(30, 128, 196, 0.1)',
      gray: 'rgba(168, 168, 168, 0.15)',
    },
  },

  typography: {
    fontFamily: {
      sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      mono: "'Roboto Mono', 'Courier New', 'Courier', monospace",
    },

    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },

    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },

    lineHeight: {
      tight: 1.25,
      normal: 1.6,
      relaxed: 1.75,
    },
  },

  spacing: {
    scale: {
      xs: '0.5rem',   // 8px
      sm: '0.75rem',  // 12px
      md: '1rem',     // 16px
      lg: '1.5rem',   // 24px
      xl: '2rem',     // 32px
      '2xl': '3rem',  // 48px
      '3xl': '4rem',  // 64px
      '4xl': '5rem',  // 80px
    },
  },

  effects: {
    shadows: {
      '1': '0 2px 4px rgba(0, 0, 0, 0.04)',
      '2': '0 4px 8px rgba(0, 0, 0, 0.08)',
      '3': '0 8px 16px rgba(0, 0, 0, 0.12)',
      '4': '0 12px 24px rgba(0, 0, 0, 0.16)',
      '5': '0 16px 32px rgba(0, 0, 0, 0.2)',
    },

    borderRadius: {
      sm: '4px',
      md: '8px',
      lg: '12px',
    },

    transitions: {
      base: '0.2s ease',
      fast: '0.1s ease',
      slow: '0.3s ease',
    },
  },

  layout: {
    maxWidth: '1400px',
    navbarHeight: '68px',        // Taller navbar
    sidebarWidth: '300px',       // Wider sidebar
    tocWidth: '260px',           // Wider TOC

    zIndex: {
      footer: 10,
      localNav: 20,
      nav: 30,
      layoutTop: 40,
      backdrop: 50,
      sidebar: 60,
    },
  },

  components: {
    navbar: {
      height: '68px',
      padding: '0 32px',
      background: '#ffffff',
      border: '#dcdcdc',
      borderWidth: '1px',
      shadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
      logoHeight: '32px',
      itemPadding: '10px 16px',
      itemGap: '8px',
    },

    sidebar: {
      width: '300px',
      padding: '24px 16px',
      background: '#ffffff',
      border: '#eaeaea',
      itemHeight: '36px',         // Spacious items
      itemPadding: '8px 16px',
      itemGap: '4px',
      itemBorderRadius: '8px',    // Rounded corners
      itemFontSize: '15px',
      itemFontWeight: 400,
      activeBackground: 'rgba(30, 128, 196, 0.12)',
      activeBorder: 'none',
      hoverBackground: 'rgba(168, 168, 168, 0.1)',
      categoryPadding: '16px 16px 8px',
      categoryFontSize: '13px',
      categoryFontWeight: 700,
      categoryTextTransform: 'none',
    },

    content: {
      maxWidth: '800px',
      padding: '40px 32px',
      fontSize: '17px',
      lineHeight: 1.8,
    },

    code: {
      fontSize: '0.9em',
      lineHeight: 1.6,
      background: 'rgba(168, 168, 168, 0.15)',
      color: '#1e80c4',
      borderRadius: '6px',
      padding: '3px 8px',
      blockPadding: '24px 28px',
      blockBorderRadius: '12px',
    },

    heading: {
      h1FontSize: '2.25rem',
      h2FontSize: '1.75rem',
      h3FontSize: '1.375rem',
      h4FontSize: '1.125rem',
      h1FontWeight: 700,
      h2FontWeight: 700,
      h3FontWeight: 600,
      h1LineHeight: 1.25,
      h2LineHeight: 1.35,
      h3LineHeight: 1.45,
      marginTop: '32px',
      marginBottom: '20px',
    },
  },
};

/**
 * Dark mode override for Docusaurus
 */
export const docusaurusDark: Partial<DesignSystem> = {
  colors: {
    // Primary brand color (Blue - dark mode)
    primary: {
      '1': '#4facfe',
      '2': '#00f2fe',
      '3': '#1e80c4',
      soft: 'rgba(79, 172, 254, 0.15)',
    },

    success: {
      '1': '#00ffdb',
      '2': '#00e4a5',
      '3': '#00c294',
      soft: 'rgba(0, 255, 219, 0.15)',
    },

    warning: {
      '1': '#ffb347',
      '2': '#ff9500',
      '3': '#cc7700',
      soft: 'rgba(255, 179, 71, 0.15)',
    },

    danger: {
      '1': '#ff6b6b',
      '2': '#ee5a5a',
      '3': '#c41818',
      soft: 'rgba(255, 107, 107, 0.15)',
    },

    info: {
      '1': '#74b9ff',
      '2': '#4facfe',
      '3': '#1877f2',
      soft: 'rgba(116, 185, 255, 0.15)',
    },

    // Gray scale (Dark mode)
    gray: {
      '1': '#5a5a5a',
      '2': '#4a4a4a',
      '3': '#3a3a3a',
      soft: 'rgba(138, 138, 138, 0.15)',
    },

    // Background colors (Dark mode)
    bg: {
      default: '#1b1b1d',
      alt: '#242526',
      elevated: '#2b2b2d',
      soft: '#242526',
    },

    // Text colors (Dark mode)
    text: {
      '1': '#f5f5f5',
      '2': '#c9c9c9',
      '3': '#8a8a8a',
    },

    // Border colors (Dark mode)
    border: {
      default: '#4a4a4a',
      divider: '#303030',
      gutter: '#303030',
    },

    // Divider (Dark mode)
    divider: '#303030',

    // Soft backgrounds (Dark mode)
    soft: {
      brand: 'rgba(79, 172, 254, 0.15)',
      gray: 'rgba(138, 138, 138, 0.15)',
    },
  },

  components: {
    navbar: {
      background: '#242526',
      border: '#4a4a4a',
    },

    sidebar: {
      background: '#1b1b1d',
    },

    code: {
      background: 'rgba(138, 138, 138, 0.15)',
      color: '#4facfe',
    },
  },
};

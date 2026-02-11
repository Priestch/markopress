/**
 * VitePress Design System Preset
 * Extracted from VitePress default theme
 * Reference: https://github.com/vuejs/vitepress
 */

import type { DesignSystem } from './types.js';

export const vitepress: DesignSystem = {
  name: 'vitepress',
  version: '1.0.0',
  description: 'VitePress default theme design system (Indigo-based)',

  colors: {
    // Primary brand color (Indigo)
    primary: {
      '1': '#3451b2',  // Primary text color
      '2': '#3a5ccc',  // Hover state
      '3': '#5672cd',  // Background color
      soft: 'rgba(100, 108, 255, 0.14)',  // Soft backgrounds
    },

    // Success (Green)
    success: {
      '1': '#18794e',
      '2': '#299764',
      '3': '#30a46c',
      soft: 'rgba(24, 121, 78, 0.14)',
    },

    // Warning (Yellow)
    warning: {
      '1': '#915930',
      '2': '#946300',
      '3': '#9f6a00',
      soft: 'rgba(145, 89, 48, 0.14)',
    },

    // Danger (Red)
    danger: {
      '1': '#b8272c',
      '2': '#d5393e',
      '3': '#e0575b',
      soft: 'rgba(184, 39, 44, 0.14)',
    },

    // Info (Purple)
    info: {
      '1': '#6f42c1',
      '2': '#7e4cc9',
      '3': '#8e5cd9',
      soft: 'rgba(111, 66, 193, 0.14)',
    },

    // Gray scale (Light mode)
    gray: {
      '1': '#dddde3',
      '2': '#e4e4e9',
      '3': '#ebebef',
      soft: 'rgba(142, 150, 170, 0.14)',
    },

    // Background colors (Light mode)
    bg: {
      default: '#ffffff',     // Main background
      alt: '#f6f6f7',         // Alternative background
      elevated: '#ffffff',    // Elevated surfaces
      soft: '#f6f6f7',        // Soft background
    },

    // Text colors (Light mode)
    text: {
      '1': '#3c3c43',  // Primary text
      '2': '#67676c',  // Muted text
      '3': '#929295',  // Subtle text
    },

    // Border colors (Light mode)
    border: {
      default: '#c2c2c4',  // Interactive borders
      divider: '#e2e2e3',  // Separator lines
      gutter: '#e2e2e3',   // Component dividers
    },

    // Divider
    divider: '#e2e2e3',

    // Soft backgrounds
    soft: {
      brand: 'rgba(100, 108, 255, 0.14)',
      gray: 'rgba(142, 150, 170, 0.14)',
    },
  },

  typography: {
    fontFamily: {
      sans: "'Inter', ui-sans-serif, system-ui, sans-serif",
      mono: "ui-monospace, 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace",
    },

    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.75rem', // 28px
      '4xl': '2rem',    // 32px
    },

    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },

    lineHeight: {
      tight: 1.25,
      normal: 1.5,
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
      '4xl': '6rem',  // 96px
    },
  },

  effects: {
    shadows: {
      '1': '0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
      '2': '0 3px 12px rgba(0, 0, 0, 0.07), 0 1px 4px rgba(0, 0, 0, 0.07)',
      '3': '0 12px 32px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.08)',
      '4': '0 14px 44px rgba(0, 0, 0, 0.12), 0 3px 9px rgba(0, 0, 0, 0.12)',
      '5': '0 18px 56px rgba(0, 0, 0, 0.16), 0 4px 12px rgba(0, 0, 0, 0.16)',
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
    maxWidth: '1440px',
    navbarHeight: '60px',        // Compact navbar
    sidebarWidth: '260px',       // Narrower sidebar
    tocWidth: '220px',           // Compact TOC

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
      height: '60px',
      padding: '0 24px',
      background: '#ffffff',
      border: '#c2c2c4',
      borderWidth: '1px',
      shadow: 'none',
      logoHeight: '24px',
      itemPadding: '8px 12px',
      itemGap: '4px',
    },

    sidebar: {
      width: '260px',
      padding: '32px 24px',
      background: '#ffffff',
      border: '#e2e2e3',
      itemHeight: '28px',         // Compact items
      itemPadding: '4px 8px',
      itemGap: '2px',
      itemBorderRadius: '4px',    // Sharp corners
      itemFontSize: '14px',
      itemFontWeight: 400,
      activeBackground: 'rgba(100, 108, 255, 0.1)',
      activeBorder: '2px solid #3451b2',
      hoverBackground: 'rgba(142, 150, 170, 0.08)',
      categoryPadding: '8px 8px 4px',
      categoryFontSize: '11px',
      categoryFontWeight: 600,
      categoryTextTransform: 'uppercase',
    },

    content: {
      maxWidth: '720px',
      padding: '32px 24px',
      fontSize: '16px',
      lineHeight: 1.7,
    },

    code: {
      fontSize: '0.875em',
      lineHeight: 1.7,
      background: 'rgba(142, 150, 170, 0.14',
      color: '#3451b2',
      borderRadius: '4px',
      padding: '2px 6px',
      blockPadding: '20px 24px',
      blockBorderRadius: '6px',
    },

    heading: {
      h1FontSize: '2rem',
      h2FontSize: '1.5rem',
      h3FontSize: '1.25rem',
      h4FontSize: '1.125rem',
      h1FontWeight: 700,
      h2FontWeight: 600,
      h3FontWeight: 600,
      h1LineHeight: 1.2,
      h2LineHeight: 1.3,
      h3LineHeight: 1.4,
      marginTop: '24px',
      marginBottom: '16px',
    },
  },
};

/**
 * Dark mode override for VitePress
 */
export const vitepressDark: Partial<DesignSystem> = {
  colors: {
    // Primary brand color (Indigo - dark mode)
    primary: {
      '1': '#a8b1ff',
      '2': '#5c73e7',
      '3': '#3e63dd',
      soft: 'rgba(100, 108, 255, 0.16)',
    },

    success: {
      '1': '#3dd68c',
      '2': '#30a46c',
      '3': '#298459',
      soft: 'rgba(61, 214, 108, 0.16)',
    },

    warning: {
      '1': '#f9b44e',
      '2': '#da8b17',
      '3': '#a46a0a',
      soft: 'rgba(249, 180, 78, 0.16)',
    },

    danger: {
      '1': '#f66f81',
      '2': '#f14158',
      '3': '#b62a3c',
      soft: 'rgba(246, 111, 129, 0.16)',
    },

    info: {
      '1': '#c8abfa',
      '2': '#a879e6',
      '3': '#8e5cd9',
      soft: 'rgba(200, 171, 250, 0.16)',
    },

    // Gray scale (Dark mode)
    gray: {
      '1': '#515c67',
      '2': '#414853',
      '3': '#32363f',
      soft: 'rgba(101, 117, 133, 0.16)',
    },

    // Background colors (Dark mode)
    bg: {
      default: '#1b1b1f',
      alt: '#161618',
      elevated: '#202127',
      soft: '#202127',
    },

    // Text colors (Dark mode)
    text: {
      '1': '#e2e2e3',
      '2': '#c0c0c4',
      '3': '#a1a1a6',
    },

    // Border colors (Dark mode)
    border: {
      default: '#3c3f44',
      divider: '#2e2e32',
      gutter: '#000000',
    },

    // Divider (Dark mode)
    divider: '#2e2e32',

    // Soft backgrounds (Dark mode)
    soft: {
      brand: 'rgba(100, 108, 255, 0.16)',
      gray: 'rgba(101, 117, 133, 0.16)',
    },
  },

  components: {
    navbar: {
      background: '#1b1b1f',
      border: '#3c3f44',
    },

    sidebar: {
      background: '#1b1b1f',
    },

    code: {
      background: 'rgba(101, 117, 133, 0.16)',
      color: '#a8b1ff',
    },
  },
};

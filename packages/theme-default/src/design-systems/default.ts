/**
 * Default Design System Preset
 * Plain, clean style matching the original MarkoPress theme
 * Based on the existing styles.css
 */

import type { DesignSystem } from './types.js';

export const defaultPreset: DesignSystem = {
  name: 'default',
  version: '2.0.0',
  description: 'MarkoPress default theme (VitePress-inspired with Indigo brand color)',

  colors: {
    // Primary brand color (Indigo)
    primary: {
      '1': '#3451b2',  // Dark indigo for dark mode text / active states
      '2': '#3a5ccc',  // Primary indigo (brand color)
      '3': '#5672cd',  // Light indigo
      soft: 'rgba(100, 108, 255, 0.14)',
    },

    // Success (Green)
    success: {
      '1': '#059669',
      '2': '#10b981',
      '3': '#34d399',
      soft: 'rgba(16, 185, 129, 0.1)',
    },

    // Warning (Yellow/Orange)
    warning: {
      '1': '#d97706',
      '2': '#f59e0b',
      '3': '#fbbf24',
      soft: 'rgba(245, 158, 11, 0.1)',
    },

    // Danger (Red)
    danger: {
      '1': '#dc2626',
      '2': '#ef4444',
      '3': '#f87171',
      soft: 'rgba(239, 68, 68, 0.1)',
    },

    // Info (Cyan)
    info: {
      '1': '#0891b2',
      '2': '#06b6d4',
      '3': '#22d3ee',
      soft: 'rgba(6, 182, 212, 0.1)',
    },

    // Gray scale (Light mode)
    gray: {
      '1': '#e5e7eb',
      '2': '#f3f4f6',
      '3': '#f9fafb',
      soft: 'rgba(107, 114, 128, 0.1)',
    },

    // Background colors (Light mode)
    bg: {
      default: '#ffffff',
      alt: '#f9fafb',
      elevated: '#ffffff',
      soft: '#f3f4f6',
    },

    // Text colors (Light mode)
    text: {
      '1': '#111827',
      '2': '#4b5563',
      '3': '#6b7280',
    },

    // Border colors (Light mode)
    border: {
      default: '#e5e7eb',
      divider: '#e5e7eb',
      gutter: '#e5e7eb',
    },

    // Divider
    divider: '#e5e7eb',

    // Soft backgrounds
    soft: {
      brand: 'rgba(59, 130, 246, 0.1)',
      gray: 'rgba(107, 114, 128, 0.1)',
    },
  },

  typography: {
    fontFamily: {
      sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      mono: "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
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
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  spacing: {
    scale: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      '2xl': '3rem',
      '3xl': '4rem',
      '4xl': '6rem',
    },
  },

  effects: {
    shadows: {
      '1': '0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
      '2': '0 3px 12px rgba(0, 0, 0, 0.07), 0 1px 4px rgba(0, 0, 0, 0.07)',
      '3': '0 12px 32px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.08)',
      '4': '0 20px 50px rgba(0, 0, 0, 0.12), 0 4px 10px rgba(0, 0, 0, 0.08)',
      '5': '0 25px 70px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1)',
    },

    borderRadius: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      full: '9999px',
    },

    transitions: {
      base: '250ms ease-in-out',
      fast: '150ms ease-in-out',
      slow: '350ms ease-in-out',
    },
  },

  layout: {
    maxWidth: '1440px',
    navbarHeight: '64px',
    sidebarWidth: '280px',
    tocWidth: '240px',

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
      height: '64px',
      padding: '0 1.5rem',
      background: '#ffffff',
      border: '#e5e7eb',
      borderWidth: '1px',
      shadow: 'none',
      logoHeight: '32px',
    },

    sidebar: {
      width: '280px',
      padding: '1.5rem',
      background: '#f9fafb',
      border: '#e5e7eb',
      activeBorder: '2px solid #3451b2',     // NEW: Active state indicator
      activeBackground: 'rgba(100, 108, 255, 0.1)',  // Updated to Indigo
    },

    content: {
      maxWidth: '720px',     // VitePress-proven optimal reading width
      padding: '32px 24px',
      fontSize: '16px',
      lineHeight: 1.7,       // Improved readability
    },

    code: {
      fontSize: '0.875em',
      lineHeight: 1.7,       // Improved readability
      background: '#f3f4f6',
      color: '#3a5ccc',     // Updated to Indigo
      borderRadius: '4px',
      padding: '0.25rem 0.5rem',
      blockPadding: '20px 24px',
      blockBorderRadius: '8px',
    },

    heading: {
      h1FontSize: '2.25rem',
      h2FontSize: '1.5rem',
      h3FontSize: '1.25rem',
      h4FontSize: '1.125rem',
      h1FontWeight: 700,
      h2FontWeight: 600,
      h3FontWeight: 600,
      h1LineHeight: 1.2,
      h2LineHeight: 1.3,
      h3LineHeight: 1.4,
      marginTop: '1.5rem',
      marginBottom: '1rem',
    },
  },
};

/**
 * Dark mode override for default preset
 */
export const defaultDark: Partial<DesignSystem> = {
  colors: {
    // Primary brand color (Indigo - dark mode)
    primary: {
      '1': '#a8b1ff',  // Light indigo for dark mode text
      '2': '#3a5ccc',  // Primary indigo
      '3': '#3451b2',  // Dark indigo
      soft: 'rgba(100, 108, 255, 0.16)',  // Increased opacity
    },

    success: {
      '1': '#34d399',
      '2': '#10b981',
      '3': '#059669',
      soft: 'rgba(52, 211, 153, 0.15)',
    },

    warning: {
      '1': '#fbbf24',
      '2': '#f59e0b',
      '3': '#d97706',
      soft: 'rgba(251, 191, 36, 0.15)',
    },

    danger: {
      '1': '#f87171',
      '2': '#ef4444',
      '3': '#dc2626',
      soft: 'rgba(248, 113, 113, 0.15)',
    },

    info: {
      '1': '#22d3ee',
      '2': '#06b6d4',
      '3': '#0891b2',
      soft: 'rgba(34, 211, 238, 0.15)',
    },

    // Gray scale (Dark mode)
    gray: {
      '1': '#374151',
      '2': '#1f2937',
      '3': '#111827',
      soft: 'rgba(107, 114, 128, 0.15)',
    },

    // Background colors (Dark mode - VitePress-inspired)
    bg: {
      default: '#1b1b1f',  // VitePress default dark
      alt: '#1f2937',
      elevated: '#2d2d30',
      soft: '#252529',
    },

    // Text colors (Dark mode)
    text: {
      '1': '#f9fafb',
      '2': '#d1d5db',
      '3': '#9ca3af',
    },

    // Border colors (Dark mode)
    border: {
      default: '#374151',
      divider: '#1f2937',
      gutter: '#1f2937',
    },

    // Divider (Dark mode)
    divider: '#1f2937',

    // Soft backgrounds (Dark mode)
    soft: {
      brand: 'rgba(96, 165, 250, 0.15)',
      gray: 'rgba(156, 162, 173, 0.15)',
    },
  },

  components: {
    navbar: {
      background: '#1b1b1f',
      border: '#2d2d30',
    },

    sidebar: {
      background: '#1b1b1f',
      activeBorder: '2px solid #a8b1ff',
      activeBackground: 'rgba(100, 108, 255, 0.16)',
    },

    code: {
      background: '#1f2937',
      color: '#a8b1ff',  // Light indigo for dark mode
    },
  },
};

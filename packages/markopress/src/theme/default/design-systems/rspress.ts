/**
 * RsPress Design System Preset
 * Modern documentation framework by ByteDance
 * Reference: https://rspress.dev
 */

import type { DesignSystem } from './types.js';

export const rspress: DesignSystem = {
  name: 'rspress',
  version: '1.0.0',
  description: 'RsPress design system (Purple/Pink accent - Modern tech style)',

  colors: {
    // Primary brand color (Purple/Pink gradient style)
    primary: {
      '1': '#7c3aed',  // Primary text/link color (purple)
      '2': '#8b5cf6',  // Hover state
      '3': '#a78bfa',  // Background color
      soft: 'rgba(124, 58, 237, 0.1)',
    },

    // Success (Green)
    success: {
      '1': '#059669',
      '2': '#10b981',
      '3': '#34d399',
      soft: 'rgba(5, 150, 105, 0.1)',
    },

    // Warning (Orange)
    warning: {
      '1': '#d97706',
      '2': '#f59e0b',
      '3': '#fbbf24',
      soft: 'rgba(217, 119, 6, 0.1)',
    },

    // Danger (Red)
    danger: {
      '1': '#dc2626',
      '2': '#ef4444',
      '3': '#f87171',
      soft: 'rgba(220, 38, 38, 0.1)',
    },

    // Info (Blue)
    info: {
      '1': '#2563eb',
      '2': '#3b82f6',
      '3': '#60a5fa',
      soft: 'rgba(37, 99, 235, 0.1)',
    },

    // Gray scale (Light mode - cooler grays)
    gray: {
      '1': '#e5e7eb',
      '2': '#f3f4f6',
      '3': '#f9fafb',
      soft: 'rgba(156, 163, 175, 0.1)',
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
      '1': '#111827',  // Primary text
      '2': '#6b7280',  // Muted text
      '3': '#9ca3af',  // Subtle text
    },

    // Border colors (Light mode)
    border: {
      default: '#e5e7eb',
      divider: '#f3f4f6',
      gutter: '#f3f4f6',
    },

    // Divider
    divider: '#f3f4f6',

    // Soft backgrounds
    soft: {
      brand: 'rgba(124, 58, 237, 0.1)',
      gray: 'rgba(156, 163, 175, 0.1)',
    },
  },

  typography: {
    fontFamily: {
      sans: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace",
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
      '4xl': '6rem',  // 96px
    },
  },

  effects: {
    shadows: {
      '1': '0 1px 3px rgba(0, 0, 0, 0.05)',
      '2': '0 4px 6px rgba(0, 0, 0, 0.07)',
      '3': '0 10px 15px rgba(0, 0, 0, 0.1)',
      '4': '0 20px 25px rgba(0, 0, 0, 0.15)',
      '5': '0 25px 50px rgba(0, 0, 0, 0.25)',
    },

    borderRadius: {
      sm: '6px',
      md: '10px',
      lg: '14px',
    },

    transitions: {
      base: '0.15s ease',
      fast: '0.1s ease',
      slow: '0.25s ease',
    },
  },

  layout: {
    maxWidth: '1280px',
    navbarHeight: '64px',
    sidebarWidth: '280px',
    tocWidth: '256px',

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
      padding: '0 28px',
      background: 'rgba(255, 255, 255, 0.8)',
      border: '#e5e7eb',
      borderWidth: '1px',
      shadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
      logoHeight: '28px',
      itemPadding: '12px 16px',
      itemGap: '6px',
    },

    sidebar: {
      width: '280px',
      padding: '28px 20px',
      background: '#ffffff',
      border: '#f3f4f6',
      itemHeight: '40px',         // Large touch targets
      itemPadding: '10px 16px',
      itemGap: '6px',
      itemBorderRadius: '6px',    // Modern rounded
      itemFontSize: '15px',
      itemFontWeight: 500,
      activeBackground: 'rgba(124, 58, 237, 0.12)',
      activeBorder: '3px solid #7c3aed',
      hoverBackground: 'rgba(156, 163, 175, 0.08)',
      categoryPadding: '12px 16px 8px',
      categoryFontSize: '12px',
      categoryFontWeight: 600,
      categoryTextTransform: 'uppercase',
    },

    content: {
      maxWidth: '760px',
      padding: '36px 28px',
      fontSize: '16px',
      lineHeight: 1.75,
    },

    code: {
      fontSize: '0.875em',
      lineHeight: 1.6,
      background: 'rgba(124, 58, 237, 0.08)',
      color: '#7c3aed',
      borderRadius: '5px',
      padding: '3px 7px',
      blockPadding: '22px 26px',
      blockBorderRadius: '8px',
    },

    heading: {
      h1FontSize: '2.125rem',
      h2FontSize: '1.625rem',
      h3FontSize: '1.3rem',
      h4FontSize: '1.125rem',
      h1FontWeight: 700,
      h2FontWeight: 600,
      h3FontWeight: 600,
      h1LineHeight: 1.25,
      h2LineHeight: 1.35,
      h3LineHeight: 1.4,
      marginTop: '28px',
      marginBottom: '18px',
    },
  },
};

/**
 * Dark mode override for RsPress
 */
export const rspressDark: Partial<DesignSystem> = {
  colors: {
    // Primary brand color (Purple - dark mode, more vibrant)
    primary: {
      '1': '#a78bfa',
      '2': '#c4b5fd',
      '3': '#7c3aed',
      soft: 'rgba(167, 139, 250, 0.15)',
    },

    success: {
      '1': '#6ee7b7',
      '2': '#34d399',
      '3': '#059669',
      soft: 'rgba(110, 231, 183, 0.15)',
    },

    warning: {
      '1': '#fcd34d',
      '2': '#fbbf24',
      '3': '#d97706',
      soft: 'rgba(252, 211, 77, 0.15)',
    },

    danger: {
      '1': '#fca5a5',
      '2': '#f87171',
      '3': '#dc2626',
      soft: 'rgba(252, 165, 165, 0.15)',
    },

    info: {
      '1': '#93c5fd',
      '2': '#60a5fa',
      '3': '#2563eb',
      soft: 'rgba(147, 197, 253, 0.15)',
    },

    // Gray scale (Dark mode)
    gray: {
      '1': '#4b5563',
      '2': '#374151',
      '3': '#1f2937',
      soft: 'rgba(107, 114, 128, 0.15)',
    },

    // Background colors (Dark mode)
    bg: {
      default: '#111827',
      alt: '#1f2937',
      elevated: '#1f2937',
      soft: '#1f2937',
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
      brand: 'rgba(167, 139, 250, 0.15)',
      gray: 'rgba(107, 114, 128, 0.15)',
    },
  },

  components: {
    navbar: {
      background: 'rgba(17, 24, 39, 0.8)',
      border: '#374151',
    },

    sidebar: {
      background: '#111827',
    },

    code: {
      background: 'rgba(167, 139, 250, 0.1)',
      color: '#a78bfa',
    },
  },
};

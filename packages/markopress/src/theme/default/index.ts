/**
 * MarkoPress Default Theme
 * Theme configuration and API
 */

export interface ThemeConfig {
  name?: string;
  description?: string;
  logo?: string;
  style?: 'default' | 'vitepress' | 'docusaurus';
  navbar?: NavbarItem[];
  sidebar?: SidebarConfig;
  footer?: FooterConfig;
  styles?: ThemeStyles;
  features?: ThemeFeatures;
}

export interface NavbarItem {
  text: string;
  link: string;
  target?: '_self' | '_blank';
}

export interface SidebarConfig {
  '/docs/*'?: SidebarGroup[];
  '/blog/*'?: SidebarGroup[];
  [pattern: string]: SidebarGroup[] | undefined;
}

export interface SidebarGroup {
  text?: string;
  items: SidebarItem[];
  collapsed?: boolean;
}

export interface SidebarItem {
  text: string;
  link: string;
  items?: SidebarItem[];
}

export interface FooterConfig {
  copyright?: string;
  links?: FooterLink[];
}

export interface FooterLink {
  text: string;
  link: string;
  target?: '_self' | '_blank';
}

export interface ThemeStyles {
  primaryColor?: string;
  borderRadius?: string;
  fontFamily?: string;
}

export interface ThemeFeatures {
  darkMode?: boolean;
  search?: boolean;
  editLink?: boolean;
  lastUpdated?: boolean;
  prevNext?: boolean;
  sidebar?: boolean;
}

export const defaultConfig: ThemeConfig = {
  name: 'MarkoPress',
  description: 'A general-purpose static site generator using Marko.js v6',
  style: 'default',
  navbar: [
    { text: 'Home', link: '/' },
    { text: 'Docs', link: '/docs/getting-started' },
    { text: 'Blog', link: '/blog' },
  ],
  sidebar: {
    '/docs/': [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/docs/getting-started' },
          { text: 'Configuration', link: '/docs/configuration' },
        ],
      },
    ],
  },
  footer: {
    copyright: '© {year} MarkoPress',
    links: [
      { text: 'GitHub', link: 'https://github.com/markopress/markopress' },
      { text: 'Twitter', link: 'https://twitter.com/markopress' },
    ],
  },
  features: {
    darkMode: true,
    search: false,
    editLink: false,
    lastUpdated: true,
    prevNext: true,
    sidebar: true,
  },
};

export function defineTheme(config: ThemeConfig): ThemeConfig {
  return { ...defaultConfig, ...config };
}

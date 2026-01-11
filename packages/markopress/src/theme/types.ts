/**
 * Theme system types
 */

/**
 * Theme slot configuration
 */
export interface SlotConfig {
  component?: string;
  props?: Record<string, unknown>;
}

/**
 * Layout definitions
 */
export interface Layouts {
  home?: string;
  page?: string;
  docs?: string;
  blog?: string;
  post?: string;
  tag?: string;
  category?: string;
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  name: string;
  layouts: Layouts;
  slots: Record<string, SlotConfig>;
  styles: string[];
}

/**
 * Resolved theme with overrides
 */
export interface ResolvedTheme extends ThemeConfig {
  rootDir: string;
  overrides?: Partial<Layouts>;
}

/**
 * Theme user options
 */
export interface ThemeOptions {
  name?: string;
  options?: Record<string, unknown>;
  navbar?: NavbarItem[];
  sidebar?: SidebarConfig;
  footer?: FooterConfig;
  logo?: string;
}

export interface NavbarItem {
  text: string;
  link: string;
  items?: NavbarItem[];
}

export interface SidebarConfig {
  [prefix: string]: SidebarItem[] | undefined;
}

export interface SidebarItem {
  text?: string;
  link?: string;
  items?: SidebarItem[];
  collapsed?: boolean;
}

export interface FooterConfig {
  message?: string;
  copyright?: string;
  links?: FooterLink[][];
}

export interface FooterLink {
  text: string;
  link: string;
}

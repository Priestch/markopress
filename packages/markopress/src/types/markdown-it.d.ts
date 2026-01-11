declare module 'markdown-it-attrs' {
  import type { PluginSimple } from 'markdown-it';
  const attrs: PluginSimple;
  export default attrs;
}

declare module 'markdown-it-emoji' {
  import type { PluginSimple } from 'markdown-it';
  export const bare: PluginSimple;
  export const full: PluginSimple;
  export const light: PluginSimple;
}

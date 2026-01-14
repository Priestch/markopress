declare module 'markdown-it-container' {
  import type MarkdownIt from 'markdown-it';

  interface ContainerFunction {
    (md: MarkdownIt, name: string): void;
  }

  const container: ContainerFunction;
  export = container;
}

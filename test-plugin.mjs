import { preserveTagsPlugin } from './packages/markopress/src/markdown/preserve-tags.ts';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: true });
md.use(preserveTagsPlugin, {
  onTagDetected: (tagName, lineNumber) => {
    console.log(`Detected: <${tagName}> at line ${lineNumber}`);
  }
});

const testMarkdown = `# Test

<alert-box type="warning">
  This is important!
</alert-box>

<button href="/test">Click</button>

<card>
  <card-header><h3>Title</h3></card-header>
  <card-body>Content</card-body>
</card>`;

console.log('Input:');
console.log(testMarkdown);
console.log('\nOutput:');
const result = md.render(testMarkdown);
console.log(result);

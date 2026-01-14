export async function GET(context, next) {
  context.title = "Custom Content Directories";
  context.description = "How to use custom content directories with MarkoPress";
  context.navbar = [{"text":"Home","link":"/"},{"text":"Guide","link":"/docs/intro"},{"text":"Blog","link":"/blog"}];
  context.sidebar = [{"text":"Configuration Guide","link":"/docs/configuration"},{"text":"Custom Content Directories","link":"/docs/custom-dir"},{"text":"Quick Start Guide","link":"/docs/getting-started"},{"text":"Introduction","link":"/docs/intro"},{"text":"Build Configuration","link":"/docs/advanced/build"},{"text":"Markdown Options","link":"/docs/advanced/markdown"},{"text":"Advanced Features Overview","link":"/docs/advanced/overview"},{"text":"Build API","link":"/docs/api/build"},{"text":"Markdown API","link":"/docs/api/markdown"},{"text":"Routes API","link":"/docs/api/routes"}];
}

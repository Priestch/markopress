export async function GET(context, next) {
  context.title = "Marko Component Showcase";
  context.description = "Beautiful, styled Marko components for your markdown";
  context.navbar = [{"text":"Home","link":"/"},{"text":"Guide","link":"/docs/intro"},{"text":"Blog","link":"/blog"}];
}

export async function GET(context, next) {
  context.title = "Blog";
  context.description = "Latest blog posts";
  context.navbar = [{"text":"Home","link":"/"},{"text":"Guide","link":"/docs/intro"},{"text":"Blog","link":"/blog"}];
}

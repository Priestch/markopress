export async function GET(context, next) {
  context.title = "Marko Tags Test";
  context.description = "Testing Marko tags in markdown";
  context.navbar = [{"text":"Home","link":"/"},{"text":"Guide","link":"/docs/intro"},{"text":"Blog","link":"/blog"}];
}

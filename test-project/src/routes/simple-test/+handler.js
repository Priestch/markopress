export async function GET(context, next) {
  context.title = "Simple Test";
  context.description = "";
  context.navbar = [{"text":"Home","link":"/"},{"text":"Guide","link":"/docs/intro"},{"text":"Blog","link":"/blog"}];
}

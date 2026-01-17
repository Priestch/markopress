export async function GET(context, next) {
  context.title = "Marko Tags - Nested Components";
  context.description = "Testing nested Marko components";
  context.navbar = [{"text":"Home","link":"/"},{"text":"Guide","link":"/docs/intro"},{"text":"Blog","link":"/blog"}];
}

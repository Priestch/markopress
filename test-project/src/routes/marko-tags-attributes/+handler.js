export async function GET(context, next) {
  context.title = "Marko Tags - Attributes Test";
  context.description = "Testing Marko tag attributes";
  context.navbar = [{"text":"Home","link":"/"},{"text":"Guide","link":"/docs/intro"},{"text":"Blog","link":"/blog"}];
}

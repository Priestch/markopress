export async function GET(context, next) {
  context.title = "Marko Tags - Basic Test";
  context.description = "Testing basic Marko tag preservation";
  context.navbar = [{"text":"Home","link":"/"},{"text":"Guide","link":"/docs/intro"},{"text":"Blog","link":"/blog"}];
}

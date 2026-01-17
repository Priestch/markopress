export async function GET(context, next) {
  context.title = "Marko Tags - Standard HTML Test";
  context.description = "Testing that standard HTML is not preserved";
  context.navbar = [{"text":"Home","link":"/"},{"text":"Guide","link":"/docs/intro"},{"text":"Blog","link":"/blog"}];
}

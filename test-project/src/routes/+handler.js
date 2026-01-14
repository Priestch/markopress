export async function GET(context, next) {
  context.title = "Welcome to Test Site";
  context.description = "Testing MarkoPress with custom content directory";
  context.navbar = [{"text":"Home","link":"/"},{"text":"Guide","link":"/docs/intro"},{"text":"Blog","link":"/blog"}];
}

export async function GET(context, next) {
  context.title = "Marko Tags - Markdown Inside";
  context.description = "Testing markdown formatting inside Marko tags";
  context.navbar = [{"text":"Home","link":"/"},{"text":"Guide","link":"/docs/intro"},{"text":"Blog","link":"/blog"}];
}

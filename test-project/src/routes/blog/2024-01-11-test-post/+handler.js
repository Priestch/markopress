export async function GET(context, next) {
  context.title = "Testing MarkoPress with Custom Directories";
  context.description = "How we tested MarkoPress using a custom content directory";
  context.navbar = [{"text":"Home","link":"/"},{"text":"Guide","link":"/docs/intro"},{"text":"Blog","link":"/blog"}];
  context.date = "Thu Jan 11 2024 08:00:00 GMT+0800 (China Standard Time)";
  context.author = "MarkoPress Team";
}

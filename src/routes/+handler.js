export async function GET(context, next) {
  context.title = "Welcome to MarkoPress";
  context.description = "A general-purpose static site generator using Marko.js v6";
}

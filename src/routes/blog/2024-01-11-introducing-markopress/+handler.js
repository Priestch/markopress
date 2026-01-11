export async function GET(context, next) {
  context.title = "Introducing MarkoPress";
  context.description = "A new static site generator powered by Marko.js v6";
  context.date = "Thu Jan 11 2024 08:00:00 GMT+0800 (China Standard Time)";
}

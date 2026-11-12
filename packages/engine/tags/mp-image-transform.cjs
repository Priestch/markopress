// Marko's public synchronous tag transform API. Async image work belongs to the
// virtual module loader, never to the compiler hook (which also runs in analysis).
const { importDefault } = require("@marko/compiler/babel-utils");
const path = require("node:path");

function literal(node) {
  if (!node) return { value: true };
  if (["StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(node.type)) return { value: node.value };
  if (node.type === "NullLiteral") return { value: null };
  if (node.type === "ArrayExpression") {
    const items = node.elements.map((item) => item && literal(item));
    if (items.every(Boolean)) return { value: items.map((item) => item.value) };
  }
  return undefined;
}

module.exports = function transform(tag, t) {
  const node = tag.node;
  // Preserve the existing server-only path for data-driven SSR images. Do not
  // evaluate bindings, imports, calls, spreads, or expressions during compilation.
  if (node.arguments?.length || node.var || node.body.body.length) return;
  const attrs = {};
  for (const attr of node.attributes) {
    if (attr.type !== "MarkoAttribute" || attr.modifier || attr.arguments) return;
    const result = literal(attr.value);
    if (!result) return;
    attrs[attr.name] = result.value;
  }
  if (typeof attrs.src !== "string" || !attrs.src.trim()) return;
  const request = "virtual:mp/image/" + Buffer.from(JSON.stringify(attrs)).toString("base64url");
  const file = tag.hub.file;
  const html = importDefault(file, request, "imageHtml");
  const renderer = importDefault(file, path.join(__dirname, "mp-image-html.marko"), "ImageHtml");
  node.name = renderer;
  node.attributes = [t.markoAttribute("html", html)];
};

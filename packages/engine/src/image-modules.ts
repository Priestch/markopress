// Shared async virtual-module pipeline for literal <mp-image> props. The tag
// transform only declares the dependency; both bundlers resolve it here, even
// when the image's branch is absent during SSR. Generated HTML is public data.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./paths.ts";
import { IMAGES_SETTINGS_FILE, resolveImageTagHtml } from "./images.ts";

export const IMAGE_MODULE_PREFIX = "virtual:mp/image/";

export async function renderImageModule(
  id: string,
  watchFile: (file: string) => void = () => {},
): Promise<string> {
  if (!id.startsWith(IMAGE_MODULE_PREFIX)) throw new Error("[mp-image] invalid image module");
  const attrs = JSON.parse(Buffer.from(id.slice(IMAGE_MODULE_PREFIX.length), "base64url").toString("utf8"));
  if (!attrs || typeof attrs !== "object" || Array.isArray(attrs) || typeof attrs.src !== "string") {
    throw new Error("[mp-image] invalid literal image props");
  }
  if (existsSync(IMAGES_SETTINGS_FILE)) watchFile(IMAGES_SETTINGS_FILE);
  // Match resolveImageTagHtml's public/ source semantics. Remote cache freshness
  // remains owned by images.ts; never read source app env/config from a client module.
  if (!/^(?:https?:)?\/\//i.test(attrs.src) && !attrs.src.startsWith("data:")) {
    const source = join(ROOT, "public", attrs.src.split(/[?#]/)[0].replace(/^\/+/, ""));
    watchFile(source);
  }
  const html = await resolveImageTagHtml(attrs);
  return `export default ${JSON.stringify(html)};\n`;
}

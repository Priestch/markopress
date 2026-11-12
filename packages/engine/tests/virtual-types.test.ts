import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { z } from "zod";
import { generateTypes } from "../src/content/typegen.ts";
import { generateVirtualTypes } from "../src/virtual-types.ts";

it("generates typed collection APIs, keeps metadata body-free, and cleans declarations on config removal", async () => {
  const root = mkdtempSync(join(tmpdir(), "mp-virtual-types-"));
  const pkgRoot = join(import.meta.dirname, "..");
  try {
    const nm = join(root, "node_modules");
    mkdirSync(join(nm, "@types"), { recursive: true });
    mkdirSync(join(nm, "@marko"), { recursive: true });
    symlinkSync(pkgRoot, join(nm, "markopress"));
    for (const name of ["zod", "@types/node", "@marko/runtime-tags"]) {
      symlinkSync(join(pkgRoot, "node_modules", name), join(nm, name));
    }
    const config = { collections: { changelog: { loader: { name: "test", load: async () => {} }, schema: z.object({ title: z.string() }) } } };
    writeFileSync(join(root, "config.ts"), `import { z } from "zod";\nexport const collections = { changelog: { schema: z.object({ title: z.string() }) } };`);
    await generateTypes({ config, importSpecifier: "./config", outPath: join(root, "content.d.ts") });
    const outPath = join(root, "virtual.d.ts");
    expect(await generateVirtualTypes(config, outPath)).toBe(true);
    expect(await generateVirtualTypes(config, outPath)).toBe(false);
    writeFileSync(join(root, "consumer.ts"), [
      'import { entries } from "virtual:mp/collection-content/changelog";',
      'import { entries as metadata } from "virtual:mp/collection/changelog";',
      'const title: string = entries[0].data.title;',
      'for (const seg of entries[0].segments) {',
      '  if (seg.type === "html") { const html: string = seg.html; }',
      '  else { const component: Marko.Template<any, any> = seg.component; }',
      '}',
      '// @ts-expect-error metadata has no segments',
      'metadata[0].segments;',
      '// @ts-expect-error schema is not any',
      'const wrong: number = entries[0].data.title;',
    ].join("\n"));
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, module: "esnext", moduleResolution: "bundler", target: "es2022", skipLibCheck: true, allowImportingTsExtensions: true, types: ["node"] },
      files: ["config.ts", "content.d.ts", "virtual.d.ts", "consumer.ts"],
    }));
    execFileSync(join(pkgRoot, "node_modules/.bin/tsc"), ["-p", root], { encoding: "utf8" });
    expect(await generateVirtualTypes({ collections: {} }, outPath)).toBe(true);
    expect(readFileSync(outPath, "utf8")).not.toContain("declare module");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

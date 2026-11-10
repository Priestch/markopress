// 资产归属层（images-owners.ts）单测：subtreeDirs 递归归属面（blockers #7）。
// import 前设 MARKOPRESS_ROOT 圈定 ROOT——images-owners 的 import 链拉 content.ts
// （模块顶层无副作用，仅 ROOT 常量定格）。
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

process.env.MARKOPRESS_ROOT = mkdtempSync(join(tmpdir(), "mp-owners-"));

const { subtreeDirs } = await import("../src/images-owners.ts");

const dir = mkdtempSync(join(tmpdir(), "mp-subtree-"));

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("subtreeDirs（资产归属递归面，blockers #7）", () => {
  it("含自身 + 任意深层子目录；点前缀目录与文件不进面", () => {
    mkdirSync(join(dir, "img", "deep"), { recursive: true });
    mkdirSync(join(dir, "guide"), { recursive: true });
    mkdirSync(join(dir, ".git", "objects"), { recursive: true });
    writeFileSync(join(dir, "a.png"), "x");
    writeFileSync(join(dir, "note.md"), "x");

    expect(subtreeDirs(dir).sort()).toEqual(
      [dir, join(dir, "guide"), join(dir, "img"), join(dir, "img", "deep")].sort(),
    );
  });

  it("不存在目录不炸（竞态删除）", () => {
    expect(subtreeDirs(join(dir, "gone"))).toEqual([join(dir, "gone")]);
  });
});

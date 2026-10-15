# Plan：站点收包为 VitePress 式自包含目录（`packages/site`）

> 状态：**已定案、暂缓执行**。触发条件：**markopack 发版到 npm**（届时 `link:../markopack/...` 换成版本化依赖，正好一起动）。
> 定案日期：2026-10-15。在此之前 root 继续兼任 spike app（CLAUDE.md「暂时」的含义即此）。

## 为什么是这个形态（定案理由，勿重新讨论）

用户期望的参照形态（VitePress 惯例）：站点是**自带 `package.json` 的自包含目录**，内容按 section 子目录组织（如 `blog/`、`cookbook/`），框架配置（`.vitepress/`）也在该目录内——对应到 markopress 即 `content.config.ts` + `content/` 同居一站。

1. **终态而非偏好**：框架 monorepo 的根永远被框架开发占用（`packages/*`、`docs/` 调研笔记、workspace 配置）。Vue/Vite/Astro 仓库的 dogfood 站点全是「子目录 + 自带 package.json」形态。
2. **模板即狗粮**：用户将来 `create-markopress` 拿到的项目形态 ≈ `package.json + content.config.ts + content/ + 主题`。把狗粮站收敛成这个形状，脚手架模板直接从这里拷。
3. **内容按 section 子目录更有验证力**：嵌套 slug、多 base 目录、子目录增删（watcher 收编）、未来的按目录分集合——全是 content 层该被狗粮压到的路径（现状平铺 3 篇只测了最浅路径）。

## 目标结构

```
markopress/                  # 只剩 workspace 编排 + 框架包 + 调研笔记
  packages/
    content/  markdown/      # 框架包（不动）
    site/                    # 狗粮站 = 未来脚手架模板
      package.json           # 站点自己的 deps：marko、zod、workspace:*（content/markdown）、
                             #   markopack 依赖（发版后从 link: 换成 ^版本）
      content.config.ts
      content.perf.config.ts # perf 夹具配置跟着站点走（或评估移出 site 到根级 perf/）
      content/
        index.md  get-started.md  …
        blog/  cookbook/  …       # section 子目录（新内容按此组织）
      src/                    # 浏览器入口 index.ts
      scripts/                # rspack-*.ts / content.ts / gen-routes.ts /
                             #   content-modules.ts / markopress-plugin.ts / perf-*.mjs
      vite.config.ts
  docs/                      # 调研笔记（不动，避免与站点内容撞名）
  package.json               # root scripts 用 --filter 代理，`pnpm dev` 等命令名不变
```

命名：站点目录叫 `packages/site`（不动 pnpm-workspace glob）；不叫 `docs/`（与仓库调研笔记撞名）。

## 迁移清单（执行时照此办）

1. **搬迁**：`scripts/rspack-*.ts`、`content.ts`、`gen-routes.ts`、`content-modules.ts`、`markopress-plugin.ts`、`perf-*.mjs`、`src/`、`content/`、`content-perf/`、`content*.config.ts`、`vite.config.ts` → `packages/site/`。ROOT 均由 `import.meta.url` 推导，随 scripts 移动自动正确，无需改。
2. **依赖搬家**：root package.json 的 app deps（marko、zod、@marko/run、markopack×2、@rspack/core、@marko/runtime-tags、vite）→ site package.json；markopack 依赖换发版后的版本号（迁移的触发条件本身）。root 只留 workspace 编排。
3. **root scripts 代理**：`"dev": "pnpm --filter @markopress/site dev"` 等，命令名保持不变（CLAUDE.md 与肌肉记忆都不用改）。
4. **路径修正**：markopack 依赖若迁移时尚未发版仍需 link:，相对路径加一层 `../`；`docs/perf-rspack-vs-vite.md` 里的路径引用加注新位置。
5. **文档同步**：CLAUDE.md（目录描述、命令注记、架构图的 scripts 前缀）、本文档标记完成。
6. **回归矩阵**（迁移完成判据）：双后端 smoke——md 编辑/新增/删除热生效（sed -i 与 mv 两种保存方式都要，见 fs.watch inode 坑）、E2E Playwright 水合 + full-reload、`pnpm build` 与 `pnpm build:vite` 各自产物完整、两包 vitest 全绿。有探针（`scripts/perf-dev-probe.mjs`），全套约 10 分钟。
7. **顺手项（可选）**：迁移时把 `docs/` 部分工作笔记 dogfood 进 `content/`，按 section 子目录组织，充实验证力。

## 明确不做 / 边界

- 不引入 `apps/` 层级（现阶段一个站点，packages/ 足够；将来有 example 站再说）。
- 站点内容目录名保持 `content/`（与 content layer 术语一致），不叫 `docs/`。
- 不借此机会改 content 层契约或 gen-routes 逻辑——纯搬家 + 依赖重组，行为零变化（回归矩阵就是证明手段）。

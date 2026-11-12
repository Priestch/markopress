# @markopress/theme-base

**内容样式契约的机械部分**——跨主题必须同步、与排版审美无关的内容 CSS（2026-10-28
主题设计定案：机械共享 / 审美归主题）。

## 归属划分

| 归本包（机械） | 归各主题（排版立场） |
|---|---|
| `.mp-image` 家族（资产管线产物几何） | `.mp-doc` 字体/间距/标题层级/链接 |
| `.mp-container` 家族 + 语义色板（GitHub 系固定色，含暗色） | `pre.shiki` 亮色块样式（padding/圆角） |
| shiki 双主题切换（`--shiki-dark*` 变量映射 + 暗色底） | 令牌声明（`--mp-*`，各主题自己的基调） |

## 使用

主题在正文外渲染一次 `<mp-content-styles/>`（位置无关——`<style>` 编译期提取）。
发现机制：主题包 dependencies 里声明 `@markopress/theme-base` ⇒ taglib 依赖探测
（从主题包就近 package.json 出发）解析 `<mp-content-styles>`。

## 硬纪律

1. 除 `.mp-container` 语义色板外**零自带色值**——只吃 `--mp-*` 令牌（主题声明），
   暗色/预设自动适配。
2. 暗色规则的选择器特异性（`html[data-theme]` 属性选择器）保证压过主题的亮色规则，
   与文件加载顺序无关——新增规则必须维持这个性质。
3. 无框架依赖、无 runtime 依赖（devDep `@marko/runtime-tags` 除外——编译产物需要）。
4. 改这里 = 改所有主题的契约行为，动前三思 + 双主题回归。
5. `<mp-head-entries/>`（站点级 head 注入：config 顶层 `head:` → site.json.head
   → mp-layout 传参 → 主题 `<head>` 渲染）是**裸 HTML 构造**，不走 Marko 编译——
   内联 script 必须字面进首帧（走 Marko 编译会进 bundle 延迟执行）。
6. markopack 把主题 CSS 注在 head **末尾**：站点自定义 CSS（public/ 文件 +
   head link 条目）需抬特异性（如 `html` 前缀选择器）才能稳定覆盖主题样式。

## 验收

改完跑 docs 站（theme-docs）+ blog spike（theme-blog，`MP_CONTENT_CONFIG=.markopress/blog.config.ts`）
双站手测：容器四色、图片几何、shiki 亮暗切换。

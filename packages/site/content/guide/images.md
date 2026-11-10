---
title: 图片（资产管线）
description: co-located 图片自动变体、srcset 与 blur 占位——md 里一个 <mp-image> 搞定。
---

## 用法

图片与 md 同目录（或 public/），正文块级写 `<mp-image>`：

````md
<mp-image src="images-sample.png" alt="样图"/>
````

属性：`src`（必填）/ `alt` / `layout`（responsive 缺省 | fixed | fluid）/ `width` 或
`height`（显示约束，等比推导）/ `quality`（1-100，缺省 80）/ `sizes`（直传覆盖）/
`placeholder`（blur 缺省 | none）/ `fetchpriority`。

## 演示

下面这张图来自同目录的 `images-sample.png`（1280×640）——构建期 sharp 生成
webp 响应梯 + blur 占位，容器 aspect-ratio 预留空间（零 CLS）：

<mp-image src="images-sample.png" alt="markopress 资产管线样图"/>

固定宽度（`layout="fixed" width=480`，DPR 梯自动含 2x）：

<mp-image src="images-sample.png" alt="固定宽度样图" layout="fixed" width=480/>

低质量试验（`quality=40`，对比体积）：

<mp-image src="images-sample.png" alt="低质量样图" quality=40 width=640/>

## 远程图（v2）

`config.images.domains` 列名的远程源会被 fetch 进管线（HTTP 缓存语义 + 条件重验），
与本地同款变体；未列名的域直通原始 URL（不 fetch 不优化）：

![Astro images 指南 OG 图（docs.astro.build，已授权域）](https://docs.astro.build/open-graph/en/guides/images.webp)

<mp-image src="https://docs.astro.build/open-graph/en/guides/images.webp" alt="同图的 tag 形态（主色占位）" placeholder="color"/>

<mp-image src="https://example.com/not-authorized.png" alt="未授权域——直通原始 URL"/>

## 多格式与密度（v2）

`formats` 含 `avif` 时输出 `<picture>`（source 按格式优先序 + 原图 fallback）——本站
config 已开 `["avif", "webp"]`，上面所有图都是 picture 形态。`densities` 控制 DPR 梯：

<mp-image src="images-sample.png" alt="三倍密度梯" layout="fixed" width=480 densities="1,2,3"/>

data URI 原样透传（不进管线）；fenced code 里的写法不会被提取。


---
title: 在 Markdown 中使用组件
---

## 用法

组件放在 `src/components/`（一个组件一个 `.marko` 文件，文件名即 tag 名），
markdown 正文块级直接使用；属性随标签透传（未引号值按表达式，字符串要引号）：

````md
<counter start=5/>
````

一次性演示不用建文件——` ```marko ` 围栏直接写模板片段（可含状态与事件）：

````md
```marko
<let/n=0>
<button onClick() { n++ }>点了 ${n} 次</button>
```
````

## 演示

来自 `src/components/` 的组件（初始值 5 由属性传入）——点它：

<counter start=5/>

内联片段——也点它：

```marko
<let/n=0>
<button class="mp-inline-demo" onClick() { n++ }>inline clicked ${n} times</button>
```

组件在 build 期随页面服务端渲染，浏览器端水合恢复交互（Marko resumability，
零水合样板代码）。

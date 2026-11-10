# mp-image v2 设计 —— 向 Astro Image / gatsby-plugin-image 靠拢

状态：已实现（2026-11-11 设计 + 同日落地；三路验收全过——rspack build / vite build / dev）。范围 = T1+T2（用户已拍板）；md `![]()` 接管 = **配置 opt-in 默认关**（用户已拍板，与 Astro 默认接管相反）；页面侧 API = **Marko 组件**（用户已拍板）。参照系：
Astro images guide（v7）+ gatsby-plugin-image reference（两份已读，行为以文档为准）。

## 1. 现状（v1）与 gap

v1（`engine/src/images.ts`）：md 块级 `<mp-image src/alt/layout/width|height/quality/sizes/placeholder/fetchpriority>`
→ 预提取占位符 → sharp webp 宽度梯 [320..1920] + blur 占位 + 原图拷贝 →
`public/_markopress/image/<源内容 sha1 前8>/` 内容寻址；gif/svg 直通；资产 digest 折进 entry
有效 digest；resolveCache 按源内容 digest 键控。纯静态 HTML，零 JS。

| 能力 | Astro | gatsby | markopress v1 | v2 |
| --- | --- | --- | --- | --- |
| 远程图优化 | ✅ 授权域名 | ✅（源插件管） | ❌ 直通 `<img>` | ✅ |
| md `![]()` 接管 | ✅ 默认开 | ✅ | ❌ 仅 `<mp-image>` tag | ✅ opt-in |
| 授权域（SSRF 防线） | `image.domains`/`remotePatterns` | — | — | ✅ 同形 |
| 页面/组件侧 API | `<Image/>`/`<Picture/>` | `<GatsbyImage/>` | ❌ | ✅ `<mp-image>` 组件 |
| 多格式 `<picture>`（AVIF） | `<Picture formats>` | `formats:["avif","webp"]` | ❌ 单 webp | ✅ |
| densities（fixed [1,2]） | `densities` | `outputPixelDensities` | 部分（fixed 恒 1x/2x） | ✅ 可配 |
| 布局三态 | constrained/fixed/full-width | constrained/fixed/fullWidth | responsive/fixed/fluid | 不动（语义已对齐） |
| dominantColor 占位 | — | ✅ 默认 | ❌ 仅 blur | ✅ 可选 |
| 远程缓存 | HTTP 语义 + 条件重验 | — | — | ✅ 同形 + 失败降级 |

**明确不做**（YAGNI，两家有我们不抄）：art direction（`withArtDirection`）、traced SVG
占位、JS 淡入/交错行为（零 JS 是红线）、frontmatter `image()` schema helper（继续 v1
门后）、transformOptions 全家（grayscale/duotone/rotate/trim）、SVG 内联组件化、
CDN image service 插件面。布局命名不改（三态语义已与两家对齐，改名纯 churn）。

## 2. 配置面（config.ts 顶层 `images` 键）

```ts
export default defineMarkoPressConfig({
  // ...
  images: {
    // 远程图处理授权（默认 [] = 一切远程图直通，无优化）。SSRF 防线：只有列名的
    // 源才 fetch；domains = 精确 host 列表；remotePatterns = { protocol?, hostname }
    // （hostname 支持通配，形状对齐 Astro，v1 不做 pathname/port）
    domains: ["strapi.paodingai.com"],
    remotePatterns: [{ protocol: "https", hostname: "*.example.com" }],
    // md 正文 ![]() 接管（默认 false —— 既有集合零行为变化）。
    // true = 接管、属性走管线常量；对象形 = 接管 + 站点级默认属性并入 attrs 作缺省
    //（pdflux 反馈 #10：gatsby-remark-images 全局配置一次的机制对位——md 保持普通
    // ![]() 写法，不逐图写 tag；md 语法自带的 src/alt/title 与显式 <mp-image> tag 永远优先）
    markdown: {
      width: 650,                        // 显示宽（fluid maxWidth 同位）
      quality: 100,
      densities: [0.25, 0.5, 1, 1.5, 2], // 或 attr 形态字符串 "0.25,0.5,1,1.5,2"
      link: true,                        // #11：产物包 <a href=原图 target=_blank rel=noopener>
      // height / layout / placeholder / sizes / formats 同理可选
    },
    // 输出格式梯（默认 ["webp"] = v1 形状；含 "avif" 即 <picture> 多格式）
    formats: ["avif", "webp"],
  },
});
```

- `images` 子树进 config digest 语义不变：config.ts 任何变更走既有 resetSynced 全量重建，
  无新失效通道。默认属性并入 attrs ⇒ resolveCache 键随配置换键，不命中旧产物。
- per-tag 覆盖：`<mp-image formats="avif,webp" quality=70 …/>`（md tag 与组件同一属性面 +
  组件多一个 `class` 透传）。接管默认三态：站点默认（对象形）→ 管线常量
  （layout=responsive / quality=80 / placeholder=blur）→ per-tag 显式属性。
- `link` 属性（#11，2026-11-11）：`<mp-image link="true"/>` / 接管默认 `link: true` 时，
  产物在容器 div 内包 `<a class="mp-image-link" href={原图} style="display:block"
  target="_blank" rel="noopener">`（gatsby-remark-images 缺省行为——原图由管线拷贝到
  public/_markopress/image/<sha>/ 原名文件，URL 现成）；`link="false"` 显式关闭。
- mp-* 命名空间治理不变：`mp-image` 是框架 tag（engine taglib），用户组件目录禁 mp-*
  前缀的规则不冲突。

## 3. 远程图管线（T1 核心）

**授权判定**（fetch 前，fail-soft）：`src` 以 `https?://` 开头 → 解析 URL →
host 命中 `domains` 或 `remotePatterns` → 授权；未授权 = **直通原始 URL 的 `<img>`**
（Astro 同语义：不优化但照常显示；无宽高因此无 srcset）。`data:` 依旧拒绝。
私网 IP 段即使域名解析命中也不额外拦截（构建工具、管理员自配，接受 DNS rebinding
残留风险，注释记录）。

**缓存（`.markopress/cache/images/`，gitignore 生成子目录）**，键 = sha1(规范化 URL)：

```
.markopress/cache/images/<sha1>/
  ├─ meta.json   { url, etag?, lastModified?, cacheControl?, fetchedAt, contentType }
  └─ source.<ext>  原始字节
```

策略（Astro 5.1 模型 + 一处务实偏差）：

1. 新鲜度按 HTTP 语义：`Cache-Control: max-age` 内 = 直接用缓存，零请求。
2. 过期且有 etag/last-modified → 条件请求（`If-None-Match`/`If-Modified-Since`）：
   304 = 复用缓存；200 = 替换字节与 meta。
3. 过期且无验证器 → 重拉。**偏差点**：响应完全无 Cache-Control 时按 24h 启发式新鲜度
   （Strapi uploads 默认不带缓存头，严格 HTTP 会让每次构建全量打 CMS——启发式是构建工具
   的合理裁量，文档记录）。
4. **失败降级**：重验/重拉网络失败且本地有缓存 → warn + 用陈旧副本（CMS 抖动不炸构建）；
   无缓存可降 → build 期 throw（CI 正确性优先），dev 期 warn + 渲染占位段（不挂 server）。
5. 拉取超时 30s（AbortSignal），复用 strapi loader 的重试形状（3 次，5xx/网络错误重试）。

**产物**：命中授权后与本地图同管线——原图字节进 sharp（变体 + 原图拷贝都内容寻址落
`public/_markopress/image/<sha1-8>/`，sha 换成**拉取字节**的 sha，URL 本身不进产物路径）。
远程图源字节 digest 折进 entry 有效 digest（md 路径）：上游换图 → sha 变 → 变体重生成 +
模块重渲染，与 v1 本地资产同语义。`assetOwners` 不适用（无文件系统事件，重验在渲染/
消费时按新鲜度触发）。

## 4. md `![]()` 接管（opt-in，默认关）

- **开关**：`images.markdown: true` 才启用；默认 false = 既有集合输出逐字节不变（用户
  拍板，与 Astro 默认开相反——理由：markopress 的 `<mp-image>` 已是显式优化入口，接管是
  行为变化，让站点自己选时机）。对象形 = 接管 + 站点级默认属性（§2，pdflux 反馈 #10）。
- **接管范围**：**独立段落**的图片语法（`![alt](src "title")` 前后是空行/文档边界）。
  行内嵌在句子中的图不接管（responsive 包裹元素会打断行内排版——Astro 全量接管是它的
  `<Image>` 无包裹策略撑的，我们有布局包裹，收缩到块级是语义正确的选择）。fenced code
  安全沿用 v1 的扫描防护。
- **实现位置**：images.ts 预提取阶段（现有 `<mp-image …/>` 块扫描的同一 pass）——正则
  命中后转成与 tag 路径相同的占位符机制，属性 = { src 相对 md 文件解析, alt, title,
  layout: "responsive" } + 站点默认（对象形时）。相对/绝对路径规则同 v1：相对 = 集合
  内容目录解析；`/` 开头根路径 = 站点静态资产直通不处理；远程 = §3 授权判定。
  **段落级回填**（2026-11-11 补）：remark 会把独立图片段包进 `<p>`，而产物是块级
  `<div>`——div 嵌 p 是非法 HTML（浏览器解析劈开 p、遗留空段双份边距），独占段落时
  连 `<p>` 一起替换（gatsby-remark-images 在 mdast 层同款行为）。
- **与 `<mp-image>` tag 的关系**：tag 仍是全属性面的显式入口；接管只影响裸语法。md 里
  写 tag 永远优先（预处理先于 markdown 编译，二者不冲突）。

## 5. 页面侧 `<mp-image>` Marko 组件（用户拍板的消费 API）

用途：strapi 集合 `data.medias`（URL 数组）在用户页/组件里的消费，如 pdflux `/log`：

```marko
import { entries } from "virtual:mp/collection/changelog"
<for|entry| of=entries>
  <h2>${entry.data.title}</h2>
  <for|media| of=entry.data.medias>
    <mp-image src=media.url alt=media.alt layout="responsive"/>
  </for>
</for>
```

- **落位**：`packages/engine/tags/mp-image.marko`（engine 已有 taglib 先例
  `tags/mp-search.marko` + `marko.json` tags-dir）。taglib 发现 = app 根就近——**用户页
  （pages/）、生成物、`.markopress/components` 可用；主题包内不可用**（跨包 taglib 探测
  盲区，与 mp-search 槽位同一条已知边界，主题要图走自己的资产）。
- **异步机制**（实测已验证）：sharp 是异步 API，Marko 渲染是同步流——`<await>` 承接，
  **不带 `@placeholder>``` ⇒ 服务端持有该段直到 resolve 才写流。SSG 爬取等流结束 ⇒
  最终 HTML 无占位残渣、无替换脚本（dogfood 构建产物实证）；dev 首渲染阻塞一次
  （resolveCache + 磁盘变体让后续即时）。`<@catch>` 兜 dev 期错误可视化。`$!{html}` 包在
  `<div style="display:contents">` 里（硬约束 2 同款 concise 陷阱规避；display:contents
  使包裹盒不参与布局）。实际实现：
  `server import { resolveImageTagHtml } from "../src/images.ts"`，`<await|html|=resolveImageTagHtml(input)>`。
- **零 JS 约束的守住（实测）**：`server import`（cheatsheet 规则 10）让浏览器编译产物
  **零 import 零引用**——@marko/compiler 5.42 双平台探针编译 + 狗粮客户端 bundle 无
  sharp/内容层引用双重实证。组件形态 ≠ 组件运行时，产物仍是构建期静态 HTML。
- **叶子层纪律（实现期最大教训，dogfood 实测踩中）**：组件经 `server import` 进 server
  bundle 编译图，这条边**只能指向叶子模块**。初版 images.ts 内含 `ensureSynced →
  content.ts`，构建炸穿：29 个引擎模块进图（cli.ts 顶层 await 在 CJS 语境解析炸、
  markopack 单文件 dist 的 sirv `totalist/sync` ESM 解析炸）。修正架构：
  - `src/images.ts` = **叶子管线**（sharp + paths + plugins 纯类型；无 content.ts 边），
    组件与 md 管线共用；
  - `src/images-owners.ts` = 归属三件套（resolveEntryDir / entryAssetDigest /
    assetOwners，ensureSynced 依赖）——只在构建进程侧被 content-modules / rspack-dev /
    markopress-plugin 引用，不进 bundle；
  - **设置不经 ensureSynced**：setup 期把归一化 settings 写
    `.markopress/images-settings.json`（write-if-changed），images.ts 渲染期 mtime 缓存
    读回（Set 从数组还原）；config 变更 → resetSynced → setup 重写 → 下一渲染生效；
  - **sharp 外部化**：rspack server 侧 `externals: { sharp: node-commonjs <绝对路径> }`
    （原生绑定不进 bundle；SSG 的 server bundle 不随产物分发，绝对路径无泄漏面）。
    vite 对照路径无需处理（vite SSR 默认 externalize node_modules）。
- **并发去重**：resolveCache 存 promise（同键并发共享一次 sharp 工作）+ 远程 fetch 的
  in-flight/60s 新鲜度 memo（同 URL 密集渲染共享一次探测，失败即除名——恢复后免重启）。
- **落盘顺序安全**：组件路径的 sharp 产物在 SSG 爬取渲染期写 `public/`，晚于编译、早于
  adapter buildEnd 拷贝 public。dev 侧 markopack publicSirv 每请求惰性初始化，晚落盘可见。
- **digest 语义**：组件路径不进 store/entry digest（用户页渲染期解析，resolveCache 键控
  足够）；远程新鲜度按 §3 在消费时判定。
- **失败分流（MARKOPRESS_PHASE 环境变量）**：rspack-dev / vite config 钩子置 `dev`、
  rspack-build / vite build 置 `build`。dev = warn + 直通降级（server 不死）；build = 错误
  硬炸（CI 正确性优先）。单测覆盖两态。

## 6. T2：多格式 `<picture>`、densities、dominantColor

- **formats**：`formats: ["webp"]`（默认）= v1 单格式 `<img srcset>`；`["avif","webp"]`
  ⇒ `<picture><source type="image/avif" srcset=…><source type="image/webp" srcset=…>` +
  **原图格式 `<img>` fallback**（原图拷贝 v1 已有）。格式进变体文件名（quality 已嵌名，
  防覆盖同款理由）。AVIF 编码慢（≈ webp 5-10×）⇒ 默认关，站点/per-tag 显式开。
  排列顺序 = 配置数组顺序（前 = 优先）。
- **densities**：fixed 布局默认 [1,2]（v1 现状不变），可 `densities=[1,2,3]`；
  带显式 width 的 responsive/constrained 可用乘法梯 [0.25,0.5,1,2]×width（gatsby
  `outputPixelDensities` 同式），上限 = 源宽。纯梯子模式（无 width）继续 WIDTH_LADDER。
  **srcset 恒含源宽档**（2026-11-11，#12）：密度梯之外无条件补 sourceWidth 一档
  （gatsby fluid 的 presentationWidth 同款——源宽 > 梯最大时高 DPR 拿原图而非最近
  变体；密度已覆盖源宽时 Set 去重无副作用）。
- **placeholder: "color"**：sharp `.stats().dominant` 主色（gatsby 默认占位）——
  `placeholder=blur|color|none`，默认仍 blur（v1 不变）。color = 包裹元素背景色内联，
  零额外文件。

## 7. 失效/缓存总账

| 路径 | 触发 | 失效通道 |
| --- | --- | --- |
| md `<mp-image>` / 接管图 | md 编辑 | 既有：digest 折叠 + syncFile + 模块重写 |
| md 远程图字节变化 | 重验 200 | 源 sha 变 → entry 有效 digest 变 → 模块重渲染 |
| 组件 `<mp-image>` | 页面渲染 | resolveCache（内存）+ 磁盘变体内容寻址（跨构建复用） |
| 远程原图缓存 | 消费时新鲜度判定 | §3 条件重验；陈旧降级 |
| `images` 配置变更 | config.ts 编辑 | resetSynced 全量重建（既有，无新通道） |

## 8. 测试与验收（2026-11-11 落地）

- 单测（`engine/tests/images.test.ts`，23 个）：授权判定（domains 精确/子域排除/
  remotePatterns 通配/协议过滤/坏 URL）、缓存状态机（冷拉写缓存 / max-age 新鲜零请求 /
  etag 304 复用续期 / 200 字节替换 / 无验证器过期重拉 / 重验失败陈旧降级 / 无缓存失败
  throw / content-type 明确非图即拒——URL 扩展名只在缺省/octet-stream 时兜底）、
  md 接管（默认关 / 块级提取+title / 行内与 fenced 安全 / 远程也提取）、回填三态
  （本地产物 / tag 远程直通 / md 缺失直通）、build 期硬炸 vs dev 软降级、组件入口
  （设置文件 Set 还原 / 未授权直通 / 缺 src throw / 无设置文件回退 v1 默认）、
  placeholder=color、单 webp = v1 形状 vs avif = picture。
- dogfood 已验收（rspack build 10/10 + vite build 10/10 + dev curl 三路）：`<picture>`
  avif/webp 双 source、远程授权 fetch（docs.astro.build OG 图）+ sha 命名变体、未授权
  直通 `<img>`、dominantColor 占位、fixed 1x/2x 梯、showcase 用户页组件渲染
  （display:contents + mp-image 包裹 + blur 占位直落 SSG HTML）、客户端 bundle 无
  sharp/内容层引用。
- 试金石（未跑）：pai-websites pdflux `/log`（dev.proxy 反代 Strapi，medias 走组件、
  正文图走接管、formats avif）——真实 CMS 字节下的全链路。

## 9. 边界与已知不做

- 行内 md 图不接管（§4）；`art direction` / `withArtDirection`、traced SVG、JS
  行为、`image()` schema helper、transformOptions、CDN service 面——不做（§1）。
- 主题包内不能用 `<mp-image>`（taglib 发现边界，§5）。
- AVIF + 远程 + densities 组合正交可用，但 AVIF×5000 页级规模未测（perf 夹具无图，
  不代表真实博客；先狗粮 + 试金石攒数据）。
- v1 → v2 行为变化面（仅一处，属修复）：`<mp-image>` tag 的未授权远程 src 原来回填
  原始标签（浏览器不认识 → 不可见），v2 起直通 `<img src=原URL>`（Astro 同语义）。

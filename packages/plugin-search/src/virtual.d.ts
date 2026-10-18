// 虚拟模块的类型声明（markopress 的 plugin-data 机制；值由 setData 落盘产物提供）。
// 形状是本插件内部契约（服务端 src/index.ts 写入端与 tags/mp-search.marko 读取端）。
declare module "virtual:mp/plugin/search" {
  const data: { index: object }; // MiniSearch.toJSON() 产物
  export default data;
}

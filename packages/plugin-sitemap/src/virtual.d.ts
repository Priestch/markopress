// 虚拟模块的类型声明（markopress 的 plugin-data 机制；值由 setData 落盘产物提供）
declare module "virtual:mp/plugin/*" {
  const data: unknown;
  export default data;
}

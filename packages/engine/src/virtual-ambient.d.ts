// 引擎源码消费的站点侧虚拟模块的编译期类型垫片（rspack 双后端在消费者构建期
// 解析到 .markopress/plugin-data/ 落盘文件——运行时不需要本文件，只有 tsc 需要）。
// 站点侧的完整类型面由生成器按站点数据写 .markopress/virtual.d.ts（virtual-types.ts），
// 引擎内部无法引用那一份（跨 app 上下文），故此处只声明引擎实际用到的最宽形状。
declare module "virtual:mp/plugin/*" {
  const value: unknown;
  export default value;
}

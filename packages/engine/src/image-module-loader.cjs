// Rspack async module loader; keep per-module dependencies so watch rebuilds
// invalidate the generated HTML when source bytes or image settings change.
const { pathToFileURL } = require("node:url");
module.exports = function imageModuleLoader() {
  const callback = this.async();
  import(pathToFileURL(this.resourcePath).href).then(({ IMAGE_MODULE_PREFIX, renderImageModule }) =>
    renderImageModule(IMAGE_MODULE_PREFIX + this.resourceQuery.slice(1), (file) => this.addDependency(file)),
  ).then((source) => callback(null, source), callback);
};

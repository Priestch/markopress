function tocPlugin(options = {}) {
  const { minDepth = 2, maxDepth = 3, module: targetModule } = options;
  const pluginConfig = {
    name: "@markopress/plugin-feature-toc",
    async enhanceModules(modules) {
      modules.forEach((module) => {
        const extractToc = module.getEnhancement("extractToc");
        if (extractToc !== true) {
          return;
        }
        const tocMap = /* @__PURE__ */ new Map();
        module.files.forEach((file) => {
          const toc = buildTocFromHeaders(
            file.processed.headers,
            minDepth,
            maxDepth
          );
          tocMap.set(file.urlPath, toc);
        });
        module.enhance("toc", tocMap);
      });
    }
  };
  if (targetModule) {
    pluginConfig.modules = Array.isArray(targetModule) ? targetModule : [targetModule];
  }
  return pluginConfig;
}
function buildTocFromHeaders(headers, minDepth, maxDepth) {
  if (!headers || headers.length === 0) {
    return [];
  }
  const result = [];
  for (const header of headers) {
    if (header.level >= minDepth && header.level <= maxDepth) {
      const item = {
        slug: header.slug || header.id,
        title: header.title,
        level: header.level
      };
      if (header.children && header.children.length > 0) {
        const childItems = buildTocFromHeaders(header.children, minDepth, maxDepth);
        if (childItems.length > 0) {
          item.children = childItems;
        }
      }
      result.push(item);
    } else {
      if (header.children && header.children.length > 0) {
        const childItems = buildTocFromHeaders(header.children, minDepth, maxDepth);
        result.push(...childItems);
      }
    }
  }
  return result;
}
export {
  tocPlugin as default
};

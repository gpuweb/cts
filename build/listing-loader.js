const path = require('path');
const { Compilation } = require('webpack');

require('../src/common/tools/setup-ts-in-node');

const { crawl } = require('../src/common/tools/crawl.ts');
const { assert } = require('../src/common/framework/util/util.ts');

// See https://webpack.js.org/api/loaders/.
// Module loader that replaces an import with a module that contains the generated
// listing for a test suite. Assumes the listing is at /path/to/{suite}/listing.ts.
module.exports = function loader(source) {
  const callback = this.async();
  assert(this.resourcePath.endsWith('listing.ts'));
  const suite = path.basename(path.dirname(this.resourcePath));

  crawl(suite).then((listing) => {
    const code = ` // AUTO-GENERATED. See ${__filename}.
    export const listing = Promise.resolve(${JSON.stringify(listing, undefined, 2)});`;
    callback(null, code);
  }).catch(err => callback(err));
}

// Webpack emits modules with additional chunks like the Webpack runtime, a chunk
// to add generated modules to Webpack's module registry, etc. We don't need any
// of that because we intend to do `(await import(path/to/listing.ts)).listing`.
// Strip all of the other chunks away.
module.exports.ListingLoaderPlugin = class {
  apply(compiler) {
    compiler.hooks.compilation.tap('ListingPlugin', (compilation) => {
      compilation.hooks.processAssets.tap({
        name: 'ListingPlugin',
        stage: Compilation.PROCESS_ASSETS_STAGE_PRE_PROCESS,
      }, (assets) => {
        for (const module of compilation.modules.values()) {
          const id = compilation.chunkGraph.getModuleId(module);
          if (id.endsWith('listing.ts')) {
            const chunks = compilation.chunkGraph.getModuleChunks(module);

            assert(chunks.length === 1);
            const chunk = chunks[0];

            const files = Array.from(chunk.files);

            assert(files.length === 1);
            const file = files[0];

            assets[file] = module._source;
          }
        }
      });
    });
  }
};

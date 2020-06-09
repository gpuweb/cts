const path = require('path');
const resolve = require('resolve')

exports.interfaceVersion = 2

const dotJS = /\.js$/;
exports.resolve = function (source, file, config) {
  if (resolve.isCore(source)) return { found: true, path: null }

  source = source.replace(dotJS, '.ts');
  try {
    return {
      found: true, path: resolve.sync(source, {
        extensions: [],
        basedir: path.dirname(path.resolve(file)),
        ...config,
      })
    }
  } catch (err) {
    return { found: false }
  }
}

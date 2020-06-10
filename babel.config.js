module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['@babel/preset-typescript'],
    plugins: [
      '@babel/plugin-proposal-class-properties',
      'const-enum',
      [
        'add-header-comment',
        {
          header: ['AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts'],
        },
      ],
    ],
    compact: false,
    retainLines: true, // Keeps code *and comments* on ~the same line as in the source
    shouldPrintComment: val => !/eslint|prettier-ignore/.test(val),
  };
};

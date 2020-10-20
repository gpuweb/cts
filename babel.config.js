module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['@babel/preset-typescript'],
    plugins: [
      // Must come before @babel/plugin-transform-modules-amd
      '@babel/plugin-proposal-dynamic-import',
      ['@babel/plugin-transform-modules-amd', {
        // Omit __esModule
        strict: true,
        noInterop: true,
      }],

      '@babel/plugin-proposal-class-properties',
      '@babel/plugin-proposal-logical-assignment-operators',
      '@babel/plugin-proposal-nullish-coalescing-operator',
      '@babel/plugin-proposal-optional-chaining',
      'const-enum',
      [
        'add-header-comment',
        {
          header: ['AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts'],
        },
      ],
    ],
    compact: false,
    // Keeps comments from getting hoisted to the end of the previous line of code.
    // (Also keeps lines close to their original line numbers - but for WPT we
    // reformat with prettier anyway.)
    retainLines: true,
    shouldPrintComment: val => !/eslint|prettier-ignore/.test(val),
  };
};

const path = require('path');
const { ListingLoaderPlugin } = require('./listing-loader');

const commonConfig = {
  mode: 'development',
  context: path.resolve(__dirname, '../'),
  output: {
    // The service worker needs to be at the root scope or it can't intercept
    // all network requests.
    filename: '[name].js',
    publicPath: '/',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  optimization: {
    minimize: false, // Don't unecessarily mangle the source.
  },
};

module.exports = [{
  ...commonConfig,
  devtool: 'source-map',
  target: ['webworker', 'es2020'],
  entry: {
    'service-worker': './service-worker/index.ts',
    typescript: ['typescript'],
  },
  module: {
    rules: [
      {
        test: /\.ts?$/,
        loader: 'ts-loader',
        exclude: /node_modules|listing\.ts$/
      },
      {
        test: /\.json$/i,
        loader: 'json5-loader',
        options: {
          esModule: false,
        },
        type: 'javascript/auto',
      },
    ],
  },
  devServer: {
    contentBase: path.resolve(__dirname, '../'),
    compress: true,
    overlay: true,
  },
}, {
  ...commonConfig,
  devtool: false,
  target: ['web', 'es2020'],
  entry: {
    'src/webgpu/listing': './src/webgpu/listing.ts',
  },
  module: {
    rules: [
      {
        test: /listing\.ts$/,
        loader: path.resolve(__dirname, 'listing-loader'),
      },
    ],
  },
  plugins: [new ListingLoaderPlugin()],
}]

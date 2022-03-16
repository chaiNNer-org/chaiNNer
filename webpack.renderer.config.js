// eslint-disable-next-line import/no-extraneous-dependencies
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const rules = require('./webpack.rules');

const isDevelopment = process.env.NODE_ENV !== 'production';

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

module.exports = {
  // Put your normal webpack config below here
  module: {
    rules,
  },
  mode: isDevelopment ? 'development' : 'production',
  devServer: {
    hot: true,
  },
  plugins: [isDevelopment && new ReactRefreshWebpackPlugin()].filter(Boolean),
};

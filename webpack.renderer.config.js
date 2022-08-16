// eslint-disable-next-line import/no-extraneous-dependencies
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const rules = require('./webpack.rules');

const isDevelopment = process.env.NODE_ENV !== 'production';

rules.push(
    {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
    },
    {
        test: /\.s[ac]ss$/i,
        use: ['style-loader', 'css-loader', 'sass-loader'],
    }
);

/** @type {import("webpack").Configuration} */
module.exports = {
    // Put your normal webpack config below here
    module: {
        rules,
    },
    mode: isDevelopment ? 'development' : 'production',
    devServer: {
        hot: isDevelopment,
    },
    plugins: [isDevelopment && new ReactRefreshWebpackPlugin()].filter(Boolean),
    resolve: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
};

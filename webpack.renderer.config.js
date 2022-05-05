// eslint-disable-next-line import/no-extraneous-dependencies
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const rules = require('./webpack.rules');

const isDevelopment = process.env.NODE_ENV !== 'production';

// console.log(`\nbuilding in ${isDevelopment ? 'development' : 'production'} mode`);

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
        hot: isDevelopment,
    },
    plugins: [isDevelopment && new ReactRefreshWebpackPlugin()].filter(Boolean),
    resolve: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
};

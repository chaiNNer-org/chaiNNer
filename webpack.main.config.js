// eslint-disable-next-line import/no-extraneous-dependencies
const CopyPlugin = require('copy-webpack-plugin');

/** @type {import("webpack").Configuration} */
module.exports = {
    /**
     * This is the main entry point for your application, it's the first file
     * that runs in the main process.
     */
    entry: {
        main: './src/main/main.ts',
    },
    // Put your normal webpack config below here
    module: {
        // eslint-disable-next-line global-require
        rules: require('./webpack.rules'),
    },
    plugins: [
        new CopyPlugin({
            patterns: [{ from: 'node_modules/rregex/lib/rregex.wasm' }],
        }),
    ],
    resolve: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
};

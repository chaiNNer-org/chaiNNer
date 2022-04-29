const isDevelopment = process.env.NODE_ENV !== 'production';

console.log(`\nbuilding in ${isDevelopment ? 'development' : 'production'} mode`);

module.exports = [
  // ... existing loader config ...
  {
    test: /\.[jt]sx?$/,
    exclude: /node_modules/,
    use: {
      loader: require.resolve('babel-loader'),
      options: {
        exclude: /node_modules/,
        presets: ['@babel/preset-typescript', '@babel/preset-react'],
        plugins: [
          ...[isDevelopment && require.resolve('react-refresh/babel')].filter(Boolean),
          [
            '@babel/plugin-transform-react-jsx',
            {
              runtime: 'automatic',
            },
          ],
        ],
      },
    },
  },
  {
    test: /\.(jpe?g|png|gif|svg)$/i,
    use: [
      {
        loader: 'file-loader',
        options: {
          query: {
            name: 'assets/[name].[ext]',
          },
        },
      },
      {
        loader: 'image-webpack-loader',
        options: {
          query: {
            mozjpeg: {
              progressive: true,
            },
            gifsicle: {
              interlaced: true,
            },
            optipng: {
              optimizationLevel: 7,
            },
          },
        },
      },
    ],
  },
  // ... existing loader config ...
];

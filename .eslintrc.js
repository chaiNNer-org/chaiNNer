module.exports = {
  extends: [
    'airbnb',
    'plugin:react/jsx-runtime',
  ],
  globals: {
    MAIN_WINDOW_WEBPACK_ENTRY: true,
    SPLASH_SCREEN_WEBPACK_ENTRY: true,
  },
  env: {
    browser: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
  rules: {
    'react/jsx-sort-props': ['error', {}],
    'react/jsx-max-props-per-line': ['error', { maximum: 1, when: 'always' }],
    'import/extensions': 'off',
    'react/prop-types': 'off',
  },
};

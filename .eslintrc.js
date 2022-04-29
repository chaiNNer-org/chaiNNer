module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['airbnb', 'plugin:react/jsx-runtime', 'plugin:prettier/recommended'],
  plugins: ['prettier', '@typescript-eslint', 'prefer-arrow-functions'],
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
    'no-use-before-define': 'off',
    'react/jsx-sort-props': [
      'error',
      {
        callbacksLast: true,
        shorthandFirst: true,
      },
    ],
    'react/jsx-max-props-per-line': ['error', { maximum: 1, when: 'always' }],
    'react/jsx-filename-extension': ['error', { extensions: ['.jsx', '.tsx'] }],
    'import/extensions': 'off',
    'react/prop-types': 'off',
    'prefer-arrow-functions/prefer-arrow-functions': [
      'warn',
      {
        classPropertiesAllowed: false,
        disallowPrototype: false,
        returnStyle: 'unchanged',
        singleReturnOnly: false,
      },
    ],
  },
  settings: {
    'import/core-modules': ['electron'],
    'import/resolver': {
      typescript: {}, // this loads <rootdir>/tsconfig.json to eslint
    },
  },
};

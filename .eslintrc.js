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
        'sort-imports': ['error', { ignoreDeclarationSort: true }],
    },
    settings: {
        'import/core-modules': ['electron'],
        'import/resolver': {
            typescript: {}, // this loads <rootdir>/tsconfig.json to eslint
        },
    },

    overrides: [
        {
            files: ['src/**/*.ts', 'src/**/*.tsx'],
            extends: [
                'airbnb',
                'airbnb-typescript',
                'plugin:react/jsx-runtime',
                'plugin:@typescript-eslint/recommended',
                'plugin:@typescript-eslint/recommended-requiring-type-checking',
                'plugin:prettier/recommended',
            ],
            plugins: [
                'prettier',
                '@typescript-eslint',
                'prefer-arrow-functions',
                'eslint-comments',
            ],
            parserOptions: {
                project: './tsconfig.json',
            },
            rules: {
                'no-restricted-syntax': 'off',
                'react/require-default-props': 'off',
                '@typescript-eslint/no-non-null-assertion': 'off',
                '@typescript-eslint/no-floating-promises': ['error', { ignoreIIFE: true }],
                '@typescript-eslint/no-unnecessary-condition': 'warn',
                'eslint-comments/no-unused-enable': 'warn',
                'eslint-comments/no-unused-disable': 'warn',
                'import/prefer-default-export': 'off',
                'react/jsx-sort-props': [
                    'error',
                    {
                        callbacksLast: true,
                        shorthandFirst: true,
                    },
                ],
                'sort-imports': ['error', { ignoreDeclarationSort: true }],
                'import/order': [
                    'error',
                    {
                        groups: [
                            ['builtin', 'external'],
                            'internal',
                            'parent',
                            'sibling',
                            'index',
                            'object',
                            'type',
                        ],
                        alphabetize: { order: 'asc', caseInsensitive: true },
                    },
                ],
            },
        },
    ],
};

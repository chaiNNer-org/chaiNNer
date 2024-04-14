module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    extends: ['airbnb', 'plugin:react/jsx-runtime', 'plugin:prettier/recommended'],
    plugins: [
        'prettier',
        '@typescript-eslint',
        'prefer-arrow-functions',
        'eslint-plugin-react-memo',
        'unused-imports',
    ],
    globals: {
        MAIN_WINDOW_WEBPACK_ENTRY: true,
    },
    env: {
        browser: true,
        node: true,
    },
    parserOptions: {
        ecmaVersion: 2020,
    },
    rules: {
        'max-classes-per-file': 'off',
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
        'react/function-component-definition': 'off',
        'react-memo/require-memo': ['error', { strict: true }],
        'unused-imports/no-unused-imports': 'error',
    },
    settings: {
        'import/core-modules': ['electron'],
        'import/resolver': {
            typescript: {}, // this loads <rootdir>/tsconfig.json to eslint
        },
        'import/ignore': [/\.(?:css|scss|sass)$/i],
    },

    overrides: [
        {
            files: ['src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts', 'tests/**/*.tsx'],
            extends: [
                'airbnb',
                'airbnb-typescript',
                'plugin:react/jsx-runtime',
                'plugin:@typescript-eslint/recommended',
                'plugin:@typescript-eslint/recommended-requiring-type-checking',
                'plugin:prettier/recommended',
                'plugin:regexp/recommended',
            ],
            plugins: [
                'prettier',
                '@typescript-eslint',
                'prefer-arrow-functions',
                'eslint-comments',
                'eslint-plugin-react-memo',
                'react-hooks',
                'unused-imports',
                'regexp',
            ],
            parserOptions: {
                project: './tsconfig.json',
            },
            rules: {
                'consistent-return': 'off',
                'max-classes-per-file': 'off',
                'no-restricted-syntax': 'off',
                'react/require-default-props': 'off',
                '@typescript-eslint/no-non-null-assertion': 'off',
                '@typescript-eslint/no-floating-promises': ['error', { ignoreIIFE: true }],
                '@typescript-eslint/no-unnecessary-condition': 'warn',
                'eslint-comments/no-unused-enable': 'warn',
                'eslint-comments/no-unused-disable': 'warn',
                'import/prefer-default-export': 'off',
                'import/no-default-export': 'error',
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
                'react/function-component-definition': 'off',
                'react/hook-use-state': 'warn',
                'react-memo/require-memo': ['error', { strict: true }],
                'react-hooks/rules-of-hooks': 'error',
                'react-hooks/exhaustive-deps': ['warn', { additionalHooks: '(useAsyncEffect)' }],
                'unused-imports/no-unused-imports': 'error',
                'regexp/prefer-d': ['warn', { insideCharacterClass: 'ignore' }],
            },
        },
    ],

    ignorePatterns: ['**/antlr4/*.js'],
};

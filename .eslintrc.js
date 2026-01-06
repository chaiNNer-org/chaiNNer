module.exports = {
    root: true,
    parser: 'vue-eslint-parser',
    extends: ['plugin:vue/vue3-recommended', 'plugin:prettier/recommended'],
    plugins: [
        'prettier',
        '@typescript-eslint',
        'prefer-arrow-functions',
        'unused-imports',
        'i18next',
        'i18n-validator',
    ],
    parserOptions: {
        parser: '@typescript-eslint/parser',
        ecmaVersion: 2020,
        sourceType: 'module',
    },
    globals: {
        MAIN_WINDOW_VITE_DEV_SERVER_URL: true,
        MAIN_WINDOW_VITE_NAME: true,
        VitePluginConfig: true,
        VitePluginRuntimeKeys: true,
    },
    env: {
        browser: true,
        node: true,
    },
    rules: {
        'max-classes-per-file': 'off',
        'no-use-before-define': 'off',
        'import/extensions': 'off',
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
        'unused-imports/no-unused-imports': 'error',
        'vue/multi-word-component-names': 'off',
        'vue/max-attributes-per-line': ['error', { singleline: 1, multiline: 1 }],
    },
    settings: {
        'import/core-modules': ['electron'],
        'import/resolver': {
            typescript: {}, // this loads <rootdir>/tsconfig.json to eslint
        },
        'import/ignore': [/\.(?:css|scss|sass)$/i],
        i18next: {
            locales: ['en', 'es', 'de'],
            defaultLocale: 'en',
        },
        'i18n-validator': {
            locales: ['en', 'es', 'de'],
            defaultLocale: 'en',
        },
    },

    overrides: [
        {
            files: ['src/**/*.ts', 'src/**/*.vue', 'tests/**/*.ts', 'tests/**/*.vue'],
            extends: [
                'plugin:vue/vue3-recommended',
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
                'unused-imports',
                'regexp',
                'i18next',
                'i18n-validator',
            ],
            parser: 'vue-eslint-parser',
            parserOptions: {
                parser: '@typescript-eslint/parser',
                project: './tsconfig.json',
                extraFileExtensions: ['.vue'],
            },
            rules: {
                'consistent-return': 'off',
                'max-classes-per-file': 'off',
                'no-restricted-syntax': 'off',
                '@typescript-eslint/no-non-null-assertion': 'off',
                '@typescript-eslint/no-floating-promises': ['error', { ignoreIIFE: true }],
                '@typescript-eslint/no-unnecessary-condition': 'warn',
                'eslint-comments/no-unused-enable': 'warn',
                'eslint-comments/no-unused-disable': 'warn',
                'import/prefer-default-export': 'off',
                'import/no-default-export': 'error',
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
                'unused-imports/no-unused-imports': 'error',
                'regexp/prefer-d': ['warn', { insideCharacterClass: 'ignore' }],
                'vue/multi-word-component-names': 'off',
                'vue/max-attributes-per-line': ['error', { singleline: 1, multiline: 1 }],
                // i18n rules
                'i18next/no-literal-string': 'warn',
                'i18n-validator/json-key-exists': [
                    'error',
                    {
                        locales: ['en', 'es', 'de'],
                        jsonBaseURIs: [{ baseURI: './src/common/locales/' }],
                    },
                ],
            },
        },
        {
            files: ['src/common/**/*.ts', 'src/renderer/**/*.ts', 'src/renderer/**/*.vue'],
            env: {
                browser: true,
                node: false,
            },
            rules: {
                'no-restricted-globals': [
                    'error',
                    'process',
                    'global',
                    '__dirname',
                    '__filename',
                    'require',
                    'module',
                    'exports',
                    'setImmediate',
                ],
                'import/no-nodejs-modules': ['error', { allow: ['path'] }],
            },
        },
    ],

    ignorePatterns: ['**/antlr4/*.js', '/venv/**/*', '/node_modules/**', '/dist/**', '/out/**/*'],
};

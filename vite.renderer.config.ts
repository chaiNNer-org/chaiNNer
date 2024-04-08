import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { pluginExposeRenderer } from './vite.base.config';
import type { ConfigEnv, UserConfig } from 'vite';

const isDevelopment = process.env.NODE_ENV !== 'production';

// https://vitejs.dev/config
export default defineConfig((env) => {
    const forgeEnv = env as ConfigEnv<'renderer'>;
    const { root, mode, forgeConfigSelf } = forgeEnv;
    const name = forgeConfigSelf.name ?? '';

    return {
        root,
        mode,
        base: './',
        build: {
            outDir: `.vite/renderer/${name}`,
        },
        plugins: [
            pluginExposeRenderer(name),
            react({
                babel: {
                    presets: [],
                    // Your plugins run before any built-in transform (eg: Fast Refresh)
                    plugins: [
                        ...(isDevelopment
                            ? [
                                  [
                                      'i18next-extract',
                                      {
                                          outputPath: './src/common/locales/{{locale}}/{{ns}}.json',
                                          keyAsDefaultValueForDerivedKeys: true,
                                          discardOldKeys: true,
                                      },
                                  ],
                              ]
                            : []),
                    ],
                    // Use .babelrc files
                    babelrc: true,
                    // Use babel.config.js files
                    configFile: true,
                },
            }),
        ],
        resolve: {
            preserveSymlinks: true,
            alias: {
                process: 'process/browser',
                buffer: 'buffer',
                crypto: 'crypto-browserify',
                stream: 'stream-browserify',
                assert: 'assert',
                http: 'stream-http',
                https: 'https-browserify',
                os: 'os-browserify',
                url: 'url',
                util: 'util',
                path: 'path-browserify',
            },
        },
        clearScreen: false,
    } as UserConfig;
});

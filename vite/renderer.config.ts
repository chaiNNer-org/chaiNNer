// eslint-disable-next-line import/no-extraneous-dependencies
import vue from '@vitejs/plugin-vue';
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'vite';
import { pluginExposeRenderer } from './base.config';
import type { ConfigEnv, UserConfig } from 'vite';
import './forge-types';

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
            emptyOutDir: false,
            outDir: `.vite/renderer/${name}`,
            rollupOptions: {
                output: {
                    entryFileNames: `[name].js`,
                    chunkFileNames: `[name].js`,
                    assetFileNames: `[name].[ext]`,
                },
            },
        },
        plugins: [pluginExposeRenderer(name), vue()],
        resolve: {
            preserveSymlinks: true,
            alias: {
                path: '@chainner/node-path',
                'electron/common': 'electron',
                'electron/renderer': 'electron',
                'electron-log/renderer': 'electron-log',
            },
        },
        clearScreen: false,
        server: {
            watch: {
                ignored: [],
            },
        },
    } as UserConfig;
});

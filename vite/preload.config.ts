// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig, mergeConfig } from 'vite';
import { external, getBuildConfig, pluginHotRestart } from './base.config';
import type { ConfigEnv, UserConfig } from 'vite';
import './forge-types';

// https://vitejs.dev/config
export default defineConfig((env) => {
    const forgeEnv = env as ConfigEnv<'build'>;
    const { forgeConfigSelf } = forgeEnv;
    const config: UserConfig = {
        build: {
            emptyOutDir: false,
            rollupOptions: {
                external,
                // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
                input: forgeConfigSelf.entry!,
                output: {
                    format: 'cjs',
                    // It should not be split chunks.
                    inlineDynamicImports: true,
                    entryFileNames: '[name].js',
                    chunkFileNames: '[name].js',
                    assetFileNames: '[name].[ext]',
                },
            },
        },
        resolve: {
            alias: {
                'electron/main': 'electron',
                'electron/common': 'electron',
                'electron/renderer': 'electron',
                'electron-log/main': 'electron-log',
                'electron-log/renderer': 'electron-log',
            },
        },
        plugins: [pluginHotRestart('reload')],
    };

    return mergeConfig(getBuildConfig(forgeEnv), config);
});

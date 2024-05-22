/* eslint-disable import/no-extraneous-dependencies */
import os from 'os';
import ignore from 'rollup-plugin-ignore';
import { defineConfig, mergeConfig } from 'vite';
import { external, getBuildConfig, getBuildDefine, pluginHotRestart } from './base.config';
import type { ConfigEnv, UserConfig } from 'vite';
import './forge-types';

const restart = process.env.HOT_RESTART !== undefined;

// https://vitejs.dev/config
export default defineConfig((env) => {
    const forgeEnv = env as ConfigEnv<'build'>;
    const { forgeConfigSelf } = forgeEnv;
    const define = getBuildDefine(forgeEnv);
    const config: UserConfig = {
        build: {
            emptyOutDir: false,
            lib: {
                entry: forgeConfigSelf.entry!,
                fileName: () => '[name].js',
                formats: ['cjs'],
            },
            rollupOptions: {
                external,
                output: {
                    entryFileNames: `[name].js`,
                    chunkFileNames: `[name].js`,
                    assetFileNames: `[name].[ext]`,
                },
            },
        },
        plugins: [
            ...(restart ? [pluginHotRestart('restart')] : []),
            ...(os.platform() === 'darwin' ? [ignore(['fsevents'])] : []),
        ],
        define,
        resolve: {
            // Load the Node.js entry.
            mainFields: ['module', 'jsnext:main', 'jsnext'],
            alias: {
                'electron/main': 'electron',
                'electron/common': 'electron',
                'electron-log/main': 'electron-log',
            },
            conditions: ['node', 'default'],
        },
        server: {
            watch: {
                ignored: ['**/translation.json'],
            },
        },
    };

    return mergeConfig(getBuildConfig(forgeEnv), config);
});

/* eslint-disable import/no-extraneous-dependencies */
import { defineConfig, mergeConfig } from 'vite';
import { external, getBuildConfig, getBuildDefine, pluginHotRestart } from './base.config';
import type { ConfigEnv, UserConfig } from 'vite';
import './forge-types';

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
            },
        },
        plugins: [pluginHotRestart('restart')],
        define,
        resolve: {
            // Load the Node.js entry.
            mainFields: ['module', 'jsnext:main', 'jsnext'],
            alias: {
                'electron/main': 'electron',
                'electron/common': 'electron',
                'electron-log/main': 'electron-log',
            },
        },
        server: {
            watch: {
                ignored: ['**/translation.json'],
            },
        },
    };

    return mergeConfig(getBuildConfig(forgeEnv), config);
});

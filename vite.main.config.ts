/* eslint-disable import/no-extraneous-dependencies */
import { defineConfig, mergeConfig } from 'vite';
import checker from 'vite-plugin-checker';
import { external, getBuildConfig, getBuildDefine, pluginHotRestart } from './vite.base.config';
import type { ConfigEnv, UserConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig((env) => {
    const forgeEnv = env as ConfigEnv<'build'>;
    const { forgeConfigSelf } = forgeEnv;
    const define = getBuildDefine(forgeEnv);
    const config: UserConfig = {
        build: {
            lib: {
                entry: forgeConfigSelf.entry!,
                fileName: () => '[name].js',
                formats: ['cjs'],
            },
            rollupOptions: {
                external,
            },
        },
        plugins: [pluginHotRestart('restart'), checker({ typescript: true })],
        define,
        resolve: {
            // Load the Node.js entry.
            mainFields: ['module', 'jsnext:main', 'jsnext'],
        },
        server: {
            watch: {
                ignored: ['**/translation.json'],
            },
        },
    };

    return mergeConfig(getBuildConfig(forgeEnv), config);
});

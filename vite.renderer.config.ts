/* eslint-disable import/no-extraneous-dependencies */
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { pluginExposeRenderer } from './vite.base.config';
import type { ConfigEnv, UserConfig } from 'vite';
import './forge.env.d';

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
        plugins: [pluginExposeRenderer(name), react()],
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
        server: {
            watch: {
                ignored: ['**/translation.json'],
            },
        },
    } as UserConfig;
});

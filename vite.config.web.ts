/* eslint-disable import/no-extraneous-dependencies */
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

// Standalone Vite config for running the frontend without Electron
export default defineConfig({
    root: './',
    base: './',
    plugins: [react()],
    resolve: {
        preserveSymlinks: true,
        alias: {
            path: '@chainner/node-path',
            // For web mode, we can't use electron modules
            'electron/common': '/src/renderer/mocks/electron-common.ts',
            'electron/renderer': '/src/renderer/mocks/electron-renderer.ts',
            'electron-log/renderer': '/src/renderer/mocks/electron-log.ts',
        },
    },
    server: {
        port: 5173,
        strictPort: false,
    },
    build: {
        outDir: 'dist-web',
        emptyOutDir: true,
    },
});

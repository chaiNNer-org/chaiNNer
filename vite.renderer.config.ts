import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
    // build: {
    //     //     rollupOptions: {
    //     //         external: ['url', 'path', 'fs', 'fs/promises'],
    //     //     },
    //     // },
    //     rollupOptions: {
    //         external: [
    //             'node:util',
    //             'node:buffer',
    //             'node:stream',
    //             'node:net',
    //             'node:url',
    //             'node:fs',
    //             'node:path',
    //             'util',
    //             'buffer',
    //             'stream',
    //             'net',
    //             'url',
    //             'fs',
    //             'path',
    //             'perf_hooks',
    //         ],
    //         output: {
    //             globals: {
    //                 'node:stream': 'stream',
    //                 'node:buffer': 'buffer',
    //                 'node:util': 'util',
    //                 'node:net': 'net',
    //                 'node:url': 'url',
    //                 perf_hooks: 'perf_hooks',
    //             },
    //             inlineDynamicImports: true,
    //         },
    //     },
    // },
});

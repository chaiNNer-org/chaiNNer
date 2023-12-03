import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
    build: {
        rollupOptions: {
            external: ['url', 'path', 'fs', 'fs/promises'],
        },
    },
});

import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    publicDir: 'public',
    build: {
        target: 'es2022',
        rollupOptions: {
            output: {
                manualChunks(id) {
                    const normalized = id.replace(/\\/g, '/');

                    if (normalized.includes('node_modules/three')) {
                        return 'three';
                    }

                    if (normalized.includes('/src/audio_system/')) {
                        return 'audio';
                    }

                    return undefined;
                }
            }
        }
    }
});

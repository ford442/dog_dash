import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    // Relative base so dynamic-import preloads resolve via import.meta.url
    // (absolute /assets/* 404s when the build is served from a subpath).
    base: './',
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

                    // Post-title meta UI (dynamically imported). Keep bestiary_data eager.
                    if (
                        normalized.includes('/src/hub_screen') ||
                        normalized.includes('/src/main/hub_integration') ||
                        normalized.includes('/src/crafting_system') ||
                        (normalized.includes('/src/bestiary') && !normalized.includes('bestiary_data'))
                    ) {
                        return 'meta-ui';
                    }

                    if (normalized.includes('/src/journey_map')) {
                        return 'journey-map';
                    }

                    // Victory implementation only — victory_state enum stays in entry.
                    if (
                        normalized.includes('/src/victory_system/') &&
                        !normalized.includes('/victory_state')
                    ) {
                        return 'victory';
                    }

                    // Tutorial implementation — persistence helpers stay in entry.
                    if (
                        normalized.includes('/src/tutorial_system/') &&
                        !normalized.includes('/persistence')
                    ) {
                        return 'tutorial';
                    }

                    return undefined;
                }
            }
        }
    }
});

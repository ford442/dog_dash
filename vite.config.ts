import { defineConfig } from 'vite';

/** Level-specific / late-loaded gameplay modules grouped for async chunks. */
const LEVEL_HEAVY_MODULES = [
    'waterfall',
    'industrial_background',
    'industrial_geometry',
    'biological_background',
    'cosmic_dust',
    'boss_system',
    'black_hole',
    'meteor_shower',
    'planetary_horizon',
    'reentry',
    'chroma_shift',
    'storm_geodes',
    'ghost_debris',
    'void_jellyfish',
    'aquatic_life',
    'starlight_koi',
    'bubble_coral',
    'slingable_objects',
    'toy_rockets',
    'geological/liquid_metal'
] as const;

function isLevelHeavyModule(id: string): boolean {
    const normalized = id.replace(/\\/g, '/');
    return LEVEL_HEAVY_MODULES.some((name) => normalized.includes(`/src/${name}`));
}

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

                    if (isLevelHeavyModule(normalized)) {
                        return 'level-heavy';
                    }

                    return undefined;
                }
            }
        }
    }
});

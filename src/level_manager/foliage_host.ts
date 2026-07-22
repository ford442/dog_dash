import type * as THREE from 'three';
import type { LevelConfig } from '../level_config';
import type { IndustrialGeometryManager } from '../industrial_geometry';
import type { PinwheelFloraManager } from '../pinwheel_flora';
import type { WindChimeManager } from '../wind_chimes';
import type { SolarSailFernManager } from '../solar_sail_ferns';
import type { GeologicalSpawners, GeologicalCounts } from './types';
import type { ChromaShiftSystem } from '../chroma_shift';
import type { CrystalChimeManager } from '../crystal_chimes';

/** Surface needed by foliage populate/stream helpers. */
export interface LevelFoliageHost {
    scene: THREE.Scene;
    config: { [key: number]: LevelConfig };
    currentLevel: number;
    levelObjects: THREE.Object3D[];
    lastPopulatedEndX: number;
    objectDensityMultiplier: number;
    industrialGeometryManager: IndustrialGeometryManager;
    pinwheelManager: PinwheelFloraManager;
    windChimeManager: WindChimeManager;
    solarSailFernManager: SolarSailFernManager;
    chromaShiftSystem: ChromaShiftSystem;
    crystalChimeManager: CrystalChimeManager;
    spawners: GeologicalSpawners;
    geologicalCounts: GeologicalCounts;
    readonly GEOLOGICAL_SPAWN_CAPS: {
        cloud: number;
        voidRootBall: number;
        vacuumKelp: number;
        iceNeedle: number;
        liquidMetal: number;
        magmaHeart: number;
        gravityAnchor: number;
        geode: number;
    };
}

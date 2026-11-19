/**
 * The two authored Lost Sectors (plan §III): secret chapters the buoy map
 * fragments point at. Each one reuses shipped systems in a new sentence and
 * runs as a single chapter spanning x 0 → `distance` (see layout.ts).
 *
 * `tools/check_level_env_registry.cjs` scans this file next to
 * `level_config.ts`, so every env flag here must resolve to a manifest entry.
 * `tests/unit/lost_sector.test.ts` keeps both under their biome's campaign
 * decoration worst case.
 */
import type { Biome } from '../env_system_descriptors';
import type { LevelConfig } from '../level_config';
import type { LostSectorId } from './constants';

export type LostSectorDefinition = {
    id: LostSectorId;
    icon: string;
    title: string;
    /** One kid-readable line for the hub card. */
    blurb: string;
    biome: Biome;
    /** Campaign chapter whose music bed and ambient-creature table the sector borrows. */
    twinChapter: number;
    config: LevelConfig;
};

/**
 * Architect Garden — crystalline, scan-heavy. Grav-lens chains thread a
 * meadow of singing geodes; two high-tier monoliths decode extra Architect
 * lore. No boss: the garden is a quiet reward room.
 */
const ARCHITECT_GARDEN: LevelConfig = {
    name: 'Architect Garden',
    distance: 2000,
    objective: {
        type: 'scan',
        target: 10,
        description: 'Scan 10 wonders in the Architect Garden'
    },
    chimeDensity: 10,
    stormGeodeDensity: 20,
    foliageDensity: {
        fern: 4,
        rose: 0,
        lotus: 12,
        glowingFlower: 28,
        tree: 2,
        floweringTree: 6,
        shrub: 4,
        vine: 6,
        orb: 30,
        mushroom: 4,
        voidRootBall: 0,
        vacuumKelp: 0,
        iceNeedle: 8,
        liquidMetal: 0,
        magmaHeart: 3
    },
    speed: 9,
    bgColor: 0x0b0a1f,
    skyColors: { top: 0x120a33, bottom: 0x1d2a55 },
    levelType: 'open',
    fogDensity: 0.012,
    squidSpawnRate: 0,
    crystalTarsierRate: 0.0012,
    geodeTitanRate: 0.0006,
    lunarLemurRate: 0.4,
    stellarSealPupRate: 0.12,
    pinwheelDensity: 0.06,
    windChimeDensity: 0.8,
    koiSchoolDensity: 3,
    enemyTintColor: 0x9be7ff,
    environments: {
        dynamicStarfield: true,
        asteroidField: { rate: 1.0 },
        aurora: { enabled: true, density: 0.8, color1: 0x9be7ff, color2: 0xd6a6ff, speed: 0.8 },
        prismaticCrystals: true,
        quantumMirrors: true,
        singingGeodes: { density: 25 },
        voidJellyfish: { density: 20 }
    },
    vignettes: {
        geodeClearings: 1.0
    },
    gravLensCorridors: [
        {
            startX: 380,
            lenses: [
                { offsetX: 0, y: 3, z: -5 },
                { offsetX: 90, y: -3, z: -6 },
                { offsetX: 180, y: 5, z: -5 },
                { offsetX: 270, y: 0, z: -6 }
            ]
        },
        {
            startX: 1180,
            lenses: [
                { offsetX: 0, y: -2, z: -5 },
                { offsetX: 100, y: 6, z: -7 },
                { offsetX: 200, y: 1, z: -5 }
            ]
        }
    ],
    // Architect relics: lore + blueprint fragments + cores (tiers 2–3).
    dataMonoliths: [
        { x: 820, y: 5, z: -8, tier: 2 },
        { x: 1600, y: 4, z: -8, tier: 3 }
    ],
    derelictBuoys: [
        { x: 1000, y: 6, z: -6 }
    ]
};

/**
 * Kelp Cathedral — a dim organic tunnel of vacuum kelp and ice matrices.
 * Kelp drains energy and ice needles chill you, so the room teaches energy
 * management; the reused Nebula Kraken waits in the nave.
 */
const KELP_CATHEDRAL: LevelConfig = {
    name: 'Kelp Cathedral',
    distance: 2300,
    objective: {
        type: 'boss',
        target: 1,
        description: 'Defeat the Nebula Kraken in the nave'
    },
    chimeDensity: 4,
    foliageDensity: {
        fern: 3,
        rose: 0,
        lotus: 6,
        glowingFlower: 10,
        tree: 0,
        floweringTree: 0,
        shrub: 2,
        vine: 12,
        orb: 14,
        mushroom: 6,
        voidRootBall: 2,
        vacuumKelp: 28,
        iceNeedle: 14,
        liquidMetal: 0,
        magmaHeart: 0
    },
    speed: 9,
    bgColor: 0x02060c,
    skyColors: { top: 0x01040a, bottom: 0x061a24 },
    levelType: 'organic_tunnel',
    tunnelHeight: 20,
    obstacleInterval: 28,
    fogDensity: 0.03,
    // The scripted Kraken gate is the sector's only Kraken.
    squidSpawnRate: 0,
    moonSnailRate: 0.3,
    stellarSealPupRate: 0.2,
    astroPenguinRate: 0.15,
    lunarLemurRate: 0.2,
    koiSchoolDensity: 5,
    bubbleCoralDensity: 4,
    enemyTintColor: 0x33e0ff,
    environments: {
        dynamicStarfield: true,
        asteroidField: { rate: 1.2 },
        biological: true,
        voidJellyfish: { density: 30 },
        bubbleCoral: { density: 0.8 },
        dancingJellyMoss: { density: 1.0 },
        singingGeodes: { density: 8 }
    },
    bossEncounter: { kind: 'kraken', triggerX: 1500 },
    derelictBuoys: [
        { x: 700, y: 4, z: -6 }
    ]
};

export const LOST_SECTORS: Readonly<Record<LostSectorId, LostSectorDefinition>> = {
    'lost-garden': {
        id: 'lost-garden',
        icon: '💎',
        title: 'Architect Garden',
        blurb: 'Singing crystals and gravity lenses. Scan everything — the Architects left notes!',
        biome: 'crystalline',
        twinChapter: 6,
        config: ARCHITECT_GARDEN
    },
    'lost-kelp': {
        id: 'lost-kelp',
        icon: '🌿',
        title: 'Kelp Cathedral',
        blurb: 'Dark kelp tunnels drain your energy. Save some boost for the Kraken!',
        biome: 'biological',
        twinChapter: 5,
        config: KELP_CATHEDRAL
    }
};

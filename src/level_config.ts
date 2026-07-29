export type LevelObjectiveType =
    | 'scan'
    | 'sling'
    | 'rescue'
    | 'combo'
    | 'survive'
    | 'boss';

export type LevelObjective = {
    type: LevelObjectiveType;
    target: number;
    description: string;
};

export type BlackHoleEnvironmentConfig = {
    enabled: boolean;
    baseX: number;
    baseY: number;
};

export type GodRaysEnvironmentConfig = {
    enabled: boolean;
    density: number;
    baseIntensity: number;
    color: number;
    speedMultiplier: number;
};

export type AuroraEnvironmentConfig = {
    enabled: boolean;
    density: number;
    color1: number;
    color2: number;
    speed: number;
};

export type LightningEnvironmentConfig = {
    enabled: boolean;
    density: number;
    color?: number;
};

export type AsteroidFieldEnvironmentConfig = {
    rate: number;
};

export type GhostDebrisEnvironmentConfig = {
    density: number;
};

export type VoidJellyfishEnvironmentConfig = {
    density?: number;
};

export type BubbleCoralEnvironmentConfig = {
    /** Multiplier on level `bubbleCoralDensity` (default 1). */
    density?: number;
};

export type MeteorShowerEnvironmentConfig = boolean;

/** Galactic Core / accretion-disk finale backdrop (see `galactic_core.ts`). */
export type GalacticCoreEnvironmentConfig = {
    enabled: boolean;
    /** World X where the approach ramp starts / completes. */
    approachStartX?: number;
    approachEndX?: number;
    /** Camera-relative X offset at ramp 0 / ramp 1. */
    startOffsetX?: number;
    endOffsetX?: number;
    /** Depth at ramp 0 / ramp 1 (more negative = further away). */
    startZ?: number;
    endZ?: number;
    baseY?: number;
    scale?: number;
    /** Disk brightness multiplier (0.6–1.6 reads well). */
    intensity?: number;
    innerColor?: number;
    outerColor?: number;
};

/** Dream Portal doors + their bonus rooms (see `dream_portal.ts`). */
export type DreamPortalsEnvironmentConfig = {
    enabled: boolean;
    portals: DreamPortalPlacementConfig[];
};

export type DreamPortalPlacementConfig = {
    /** Absolute world X of the door (same space as `gravLensCorridors.startX`). */
    x: number;
    y?: number;
    z?: number;
    /** Seconds inside the bonus room (defaults to 35). */
    durationSeconds?: number;
    toyCount?: number;
    orbCount?: number;
    hazardCount?: number;
    theme?: 'pastel' | 'candy' | 'aurora';
};

export type GravLensPlacement = {
    offsetX: number;
    y: number;
    z?: number;
    mass?: number;
};

/** Chained grav-lens puzzle corridor (levels 2–3). */
export type GravLensCorridorConfig = {
    startX: number;
    lenses: GravLensPlacement[];
};

/** Derelict Buoy artifact placement (Morse hack, levels 4–5). */
export type DerelictBuoyConfig = {
    /** X offset from the player's position when the level starts. */
    x: number;
    y: number;
    z?: number;
};

/** Data Monolith artifact placement (trace hack, levels 4–5). */
export type DataMonolithConfig = {
    x: number;
    y: number;
    z?: number;
    /** Difficulty tier 1–3 (defaults to 1). */
    tier?: 1 | 2 | 3;
};

export type LevelEnvironments = {
    pastelNebula?: boolean;
    butterflySwarm?: boolean;
    blackHole?: BlackHoleEnvironmentConfig;
    industrial?: { intensity?: number, tunnelSpeed?: number } | boolean;
    waterfall?: boolean;
    biological?: boolean;
    nebula?: boolean;
    /** Parallax ribbon/veil sheets (cheap depth); uses level skyColors. */
    nebulaRibbons?: boolean;
    cosmicDust?: boolean;
    moonPalace?: boolean;
    planetaryHorizon?: boolean;
    reEntry?: boolean;
    aquaticLife?: boolean;
    godRays?: GodRaysEnvironmentConfig;
    aurora?: AuroraEnvironmentConfig;
    lightning?: LightningEnvironmentConfig;
    asteroidField?: AsteroidFieldEnvironmentConfig;
    ghostDebris?: GhostDebrisEnvironmentConfig;
    voidJellyfish?: VoidJellyfishEnvironmentConfig;
    meteorShower?: MeteorShowerEnvironmentConfig;
    bubbleCoral?: BubbleCoralEnvironmentConfig | boolean;
    wishLanterns?: boolean;
    dancingJellyMoss?: boolean | { density?: number };
    weather?: boolean;
    dynamicStarfield?: boolean | { speedScaling?: number };
    /** Finale backdrop: singularity + accretion disk (deferred chunk). */
    galacticCore?: GalacticCoreEnvironmentConfig;
    /** Secret bonus-room doorways (deferred chunk). */
    dreamPortals?: DreamPortalsEnvironmentConfig;
};

// Cumulative player-x thresholds for the journey toward the Moon.
// Index i is the x position where level (i+1) begins; the final entry is the
// Moon's position (the victory threshold). Shared by LevelManager.checkProgress
// and the HUD journey map so both stay in sync.
export const LEVEL_DISTANCE_BOUNDARIES = [0, 500, 1200, 2200, 3200, 4200, 5200];

export type LevelConfig = {
    name: string;
    distance: number;
    objective?: LevelObjective;
    foliageDensity: {
        fern?: number;
        rose?: number;
        lotus?: number;
        glowingFlower?: number;
        tree?: number;
        floweringTree?: number;
        shrub?: number;
        vine?: number;
        orb?: number;
        mushroom?: number;
        cloud?: number;
        voidRootBall?: number;
        vacuumKelp?: number;
        iceNeedle?: number;
        liquidMetal?: number;
        magmaHeart?: number;
        gravityAnchor?: number;
        /** Solar sail ferns per foliage chunk (capped at 6–12 active per segment). */
        solarSail?: number;
    };
    chromaShiftDensity?: number;
    stormGeodeDensity?: number;
    /** Crystal chime clusters per ~400 world units (max 8–12 active per slice). */
    chimeDensity?: number;
    /** Rotating wind-chime mobiles per ~400 world units (max 8 active; cloud/nebula zones). */
    windChimeDensity?: number;
    speed: number;
    bgColor: number;
    skyColors: { top: number, bottom: number };
    levelType?: 'open' | 'tunnel' | 'organic_tunnel';
    tunnelHeight?: number;
    obstacleInterval?: number;
    fogDensity?: number;
    squidSpawnRate?: number;
    // Rare bestiary creatures (see creature_manager.ts) - per-frame spawn
    // probability while the level has none of that creature active.
    crystalTarsierRate?: number;
    geodeTitanRate?: number;
    /** Moon Snail set-pieces per streaming interval (levels 5–6, max 2 active). */
    moonSnailRate?: number;
    /** Weight for Cosmic Otter spawns in the space-friends roulette (levels 2–4). */
    cosmicOtterRate?: number;
    /** Weight for Astro Penguin spawns in the space-friends roulette (levels 4–6). */
    astroPenguinRate?: number;
    /** Weight for Stellar Seal Pup spawns (levels 3–6, especially aquatic zones). */
    stellarSealPupRate?: number;
    /** Weight for Astro Bunny spawns (levels 2–5). */
    astroBunnyRate?: number;
    /** Chance (0–1) to perch a Lunar Lemur on eligible geological props (max 3/level). */
    lunarLemurRate?: number;
    /** Twirling pinwheel flowers per ~100 units along the level (0 = off). */
    pinwheelDensity?: number;
    /** Starlight koi school count for biological / aquatic / nebula levels (0 = off, max ~8 schools). */
    koiSchoolDensity?: number;
    /** Floating toy rocket wrecks per level (hero slingables, max 3). */
    toyRocketCount?: number;
    /** Rainbow bubble coral clusters per level segment (0 = off, max ~12). */
    bubbleCoralDensity?: number;
    /** Gummy ring hoops per ~100 units along the candy belt (levels 1–3). */
    gummyRingDensity?: number;
    /**
     * 0–1: fraction of asteroid spawns (gameplay + parallax) rendered as candy/gummy
     * variants. Replaces existing rocks — does NOT increase asteroid density budgets.
     */
    candyAsteroidChance?: number;
    // Environmental hazards/rewards woven into the asteroid spawn cycle.
    mineRobotRate?: number;
    barnaclePodRate?: number;
    enemyTintColor?: number;
    /**
     * Optional vignette clusters for more composed foliage placement
     * (after base uniform scatter in spawnOpenFoliage).
     * Numbers are "base per ~100 units"; scaled by objectDensityMultiplier.
     */
    vignettes?: {
        treeGroves?: number;      // 3–6 trees clustered in ~15 X units, shared Y band
        roseArches?: number;      // pairs of roses framing a vertical gap (encourage diving)
        geodeClearings?: number;  // FracturedGeode safe harbors with thinned fern ring
    };
    /**
     * Config-driven environment / background systems for this level.
     * Replaces scattered levelIndex checks. New levels declare what they need here.
     * Systems not listed (or false) are deactivated.
     */
    environments?: LevelEnvironments;
    /** Optional chained grav-lens slingshot corridors. */
    gravLensCorridors?: GravLensCorridorConfig[];
    /** Derelict Buoy artifacts (Morse hack) — industrial zones L4–L5. */
    derelictBuoys?: DerelictBuoyConfig[];
    /** Data Monolith artifacts (trace hack) — industrial zones L4–L5. */
    dataMonoliths?: DataMonolithConfig[];
};

export const LEVEL_CONFIG: { [key: number]: LevelConfig } = {
    1: {
        name: "The Neon Garden",
        distance: 3500,
        objective: {
            type: 'scan',
            target: 8,
            description: "Catalog 8 alien plants"
        },
        foliageDensity: {
            fern: 80,
            rose: 50,
            lotus: 20,
            glowingFlower: 60,
            tree: 70,
            floweringTree: 50,
            shrub: 60,
            vine: 30,
            orb: 40,
            mushroom: 45,
            cloud: 40,
            voidRootBall: 8,
            vacuumKelp: 10,
            iceNeedle: 15,
            liquidMetal: 8,
            magmaHeart: 5,
            gravityAnchor: 3,
            solarSail: 3
        },
        speed: 8,
        bgColor: 0x1a1a2e,
        skyColors: { top: 0x000000, bottom: 0x1a1a2e },
        levelType: 'open',
        crystalTarsierRate: 0.0006,
        gummyRingDensity: 0.09,
        candyAsteroidChance: 0.15,
        pinwheelDensity: 0.14,
        windChimeDensity: 0.45,
        lunarLemurRate: 0.28,
        enemyTintColor: 0x66ff99,
        environments: {
            dynamicStarfield: true,
            asteroidField: { rate: 2.5 },
            godRays: { enabled: true, density: 1.0, baseIntensity: 0.8, color: 0xffcc88, speedMultiplier: 1.2 },
            lightning: { enabled: true, density: 1.0 },
            butterflySwarm: true,
            pastelNebula: true,
            wishLanterns: true,
            dancingJellyMoss: true
        },
        vignettes: {
            treeGroves: 1.5,
            roseArches: 0.8
        }
    },
    2: {
        name: "The Asteroid Belt",
        distance: 1200,
        objective: {
            type: 'sling',
            target: 5,
            description: "Complete 5 clean gravity slings"
        },
        chromaShiftDensity: 150,
        stormGeodeDensity: 20,
        chimeDensity: 10,
        foliageDensity: {
            fern: 10,
            rose: 5,
            lotus: 5,
            glowingFlower: 10,
            tree: 10,
            floweringTree: 5,
            shrub: 10,
            vine: 5,
            orb: 10,
            mushroom: 10,
            cloud: 10,
            voidRootBall: 8,
            vacuumKelp: 3,
            iceNeedle: 15,
            liquidMetal: 10,
            magmaHeart: 5
        },
        speed: 8,
        bgColor: 0x2d1a1a,
        skyColors: { top: 0x000000, bottom: 0x2d1a1a },
        levelType: 'open',
        crystalTarsierRate: 0.0006,
        geodeTitanRate: 0.0008,
        cosmicOtterRate: 0.22,
        astroBunnyRate: 0.2,
        lunarLemurRate: 0.38,
        gummyRingDensity: 0.07,
        candyAsteroidChance: 0.32,
        pinwheelDensity: 0.07,
        enemyTintColor: 0x8844ff,
        environments: {
            dynamicStarfield: true,
            asteroidField: { rate: 0.8 },
            ghostDebris: { density: 100 },
            godRays: { enabled: true, density: 1.0, baseIntensity: 0.8, color: 0xffcc88, speedMultiplier: 1.2 },
            lightning: { enabled: true, density: 1.5 },
            blackHole: { enabled: true, baseX: 3000, baseY: 100 },
            // Dream Portal door tucked between the two grav-lens corridors.
            dreamPortals: {
                enabled: true,
                portals: [
                    { x: 820, y: 7, z: -1, theme: 'candy', durationSeconds: 32 }
                ]
            }
        },
        vignettes: {
            geodeClearings: 0.5
        },
        gravLensCorridors: [
            {
                startX: 620,
                lenses: [
                    { offsetX: 0, y: 4, z: -5 },
                    { offsetX: 95, y: -2, z: -6 },
                    { offsetX: 185, y: 6, z: -4 }
                ]
            },
            {
                startX: 980,
                lenses: [
                    { offsetX: 0, y: 0, z: -5 },
                    { offsetX: 110, y: 5, z: -7 }
                ]
            }
        ]
    },
    3: {
        name: "Orbital Descent",
        distance: 2200,
        objective: {
            type: 'rescue',
            target: 4,
            description: "Rescue 4 space friends"
        },
        foliageDensity: {
            fern: 5,
            rose: 4,
            lotus: 15,
            glowingFlower: 5,
            tree: 5,
            floweringTree: 3,
            shrub: 5,
            vine: 15,
            orb: 30,
            mushroom: 5,
            cloud: 20,
            voidRootBall: 12,
            vacuumKelp: 15,
            iceNeedle: 10,
            liquidMetal: 8,
            magmaHeart: 8,
            solarSail: 2
        },
        speed: 10,
        bgColor: 0x000510,
        skyColors: { top: 0x000011, bottom: 0x001133 },
        levelType: 'open',
        squidSpawnRate: 0.0012,
        cosmicOtterRate: 0.25,
        stellarSealPupRate: 0.12,
        astroBunnyRate: 0.16,
        lunarLemurRate: 0.42,
        gummyRingDensity: 0.05,
        candyAsteroidChance: 0.1,
        pinwheelDensity: 0.09,
        windChimeDensity: 0.5,
        bubbleCoralDensity: 3,
        enemyTintColor: 0xff5500,
        environments: {
            dynamicStarfield: true,
            asteroidField: { rate: 1.8 },
            meteorShower: true,
            lightning: { enabled: true, density: 2.0, color: 0xaa44ff },
            planetaryHorizon: true,
            reEntry: true,
            bubbleCoral: { density: 0.7 },
            // Second Dream Portal, before the level-3 grav-lens corridor.
            dreamPortals: {
                enabled: true,
                portals: [
                    { x: 1660, y: -3, z: -1, theme: 'aurora', durationSeconds: 38, toyCount: 16 }
                ]
            }
        },
        vignettes: {
            roseArches: 1.2
        },
        gravLensCorridors: [
            {
                startX: 1380,
                lenses: [
                    { offsetX: 0, y: 3, z: -5 },
                    { offsetX: 100, y: -3, z: -6 },
                    { offsetX: 200, y: 2, z: -4 },
                    { offsetX: 310, y: 7, z: -5 }
                ]
            }
        ]
    },
    4: {
        name: "The Rusty Gauntlet",
        distance: 3200,
        objective: {
            type: 'survive',
            target: 1,
            description: "Survive the rusty gauntlet"
        },
        stormGeodeDensity: 40,
        chimeDensity: 8,
        foliageDensity: {
            fern: 6,
            rose: 4,
            lotus: 3,
            glowingFlower: 5,
            tree: 4,
            floweringTree: 3,
            shrub: 4,
            vine: 5,
            orb: 15,
            mushroom: 4,
            cloud: 4,
            voidRootBall: 3,
            vacuumKelp: 3,
            iceNeedle: 3,
            liquidMetal: 5,
            magmaHeart: 3
        },
        speed: 12,
        bgColor: 0x1a1008,
        skyColors: { top: 0x110800, bottom: 0x221105 },
        levelType: 'tunnel',
        tunnelHeight: 15,
        obstacleInterval: 20,
        squidSpawnRate: 0.001,
        mineRobotRate: 0.12,
        cosmicOtterRate: 0.2,
        astroPenguinRate: 0.18,
        stellarSealPupRate: 0.14,
        astroBunnyRate: 0.12,
        lunarLemurRate: 0.35,
        pinwheelDensity: 0.05,
        windChimeDensity: 0.55,
        candyAsteroidChance: 0.08,
        bubbleCoralDensity: 4,
        toyRocketCount: 1,
        enemyTintColor: 0xcc6633,
        environments: {
            dynamicStarfield: true,
            asteroidField: { rate: 2.0 },
            industrial: { intensity: 1.0, tunnelSpeed: 1.2 },
            bubbleCoral: { density: 0.85 }
        },
        vignettes: {
            treeGroves: 0.6,
            roseArches: 0.5
        },
        // Artifacts (plan §III): 1 buoy + 1 tier-1 monolith in the industrial run.
        derelictBuoys: [
            { x: 320, y: 6, z: -6 }
        ],
        dataMonoliths: [
            { x: 520, y: 4, z: -8, tier: 1 }
        ]
    },
    5: {
        name: "The Astral Leviathan",
        distance: 4200,
        objective: {
            type: 'combo',
            target: 7,
            description: "Reach an Arc Surge combo"
        },
        stormGeodeDensity: 50,
        chimeDensity: 6,
        windChimeDensity: 0.7,
        toyRocketCount: 2,
        enemyTintColor: 0xff1493, // Nebula pink/purple tint
        foliageDensity: {
            fern: 5,
            rose: 4,
            lotus: 15,
            glowingFlower: 20,
            tree: 4,
            floweringTree: 4,
            shrub: 0,
            vine: 10,
            orb: 30,
            mushroom: 8,
            cloud: 5,
            voidRootBall: 5,
            vacuumKelp: 8,
            iceNeedle: 4,
            liquidMetal: 4,
            magmaHeart: 4,
            solarSail: 3
        },
        speed: 10,
        bgColor: 0x0a0810,
        skyColors: { top: 0x0a001a, bottom: 0x1a0033 },
        levelType: 'organic_tunnel',
        tunnelHeight: 20,
        obstacleInterval: 25,
        fogDensity: 0.02,
        squidSpawnRate: 0.0015,
        geodeTitanRate: 0.0008,
        moonSnailRate: 0.42,
        barnaclePodRate: 0.18,
        astroPenguinRate: 0.22,
        stellarSealPupRate: 0.15,
        astroBunnyRate: 0.14,
        lunarLemurRate: 0.32,
        pinwheelDensity: 0.08,
        candyAsteroidChance: 0.14,
        koiSchoolDensity: 4,
        bubbleCoralDensity: 5,
        environments: {
            dynamicStarfield: true,
            asteroidField: { rate: 2.5 },
            godRays: { enabled: true, density: 0.5, baseIntensity: 0.4, color: 0xff00ff, speedMultiplier: 0.8 },
            lightning: { enabled: true, density: 2.5, color: 0xff00ff },
            biological: true,
            nebula: true,
            nebulaRibbons: true,
            cosmicDust: true,
            voidJellyfish: { density: 45 },
            dancingJellyMoss: { density: 1.5 }
        },
        vignettes: {
            treeGroves: 0.8,
            roseArches: 0.6,
            geodeClearings: 0.4
        },
        // Artifacts (plan §III): 2 buoys + 2 monoliths (mixed tiers) deeper in.
        derelictBuoys: [
            { x: 280, y: 7, z: -6 },
            { x: 700, y: 4, z: -7 }
        ],
        dataMonoliths: [
            { x: 440, y: 5, z: -8, tier: 1 },
            { x: 860, y: 6, z: -9, tier: 2 }
        ]
    },
    6: {
        name: "The Aqua Expanse",
        distance: 5200,
        objective: {
            type: 'boss',
            target: 1,
            description: "Find the path to the Moon"
        },
        foliageDensity: {
            fern: 20,
            rose: 0,
            lotus: 40,
            glowingFlower: 10,
            tree: 5,
            floweringTree: 10,
            shrub: 20,
            vine: 30,
            orb: 20,
            mushroom: 10,
            cloud: 20,
            voidRootBall: 0,
            vacuumKelp: 10,
            iceNeedle: 5,
            liquidMetal: 5,
            magmaHeart: 0
        },
        speed: 10,
        bgColor: 0x001133,
        skyColors: { top: 0x001133, bottom: 0x002244 },
        levelType: 'open',
        squidSpawnRate: 0.0012,
        astroPenguinRate: 0.2,
        stellarSealPupRate: 0.18,
        lunarLemurRate: 0.25,
        pinwheelDensity: 0.11,
        windChimeDensity: 0.6,
        candyAsteroidChance: 0.12,
        moonSnailRate: 0.48,
        koiSchoolDensity: 5,
        bubbleCoralDensity: 6,
        toyRocketCount: 2,
        enemyTintColor: 0x66ccff,
        environments: {
            dynamicStarfield: true,
            asteroidField: { rate: 1.5 },
            aurora: { enabled: true, density: 1.0, color1: 0x00ffff, color2: 0xff00ff, speed: 1.5 },
            waterfall: true,
            aquaticLife: true,
            nebulaRibbons: true,
            voidJellyfish: { density: 40 },
            moonPalace: true,
            weather: true,
            // Finale beat: the Galactic Core swells across the last stretch of
            // the run (level 6 spans x 4200 → 5200, the Moon threshold).
            galacticCore: {
                enabled: true,
                approachStartX: 4300,
                approachEndX: 5200,
                startOffsetX: 340,
                endOffsetX: 95,
                startZ: -1150,
                endZ: -470,
                baseY: 95,
                intensity: 1.15,
                innerColor: 0xffb066,
                outerColor: 0x7a3fb5
            }
        }
    }
};

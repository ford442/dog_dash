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

export type LevelConfig = {
    name: string;
    distance: number;
    objective?: LevelObjective;
    asteroidRate: number;
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
    };
    ghostDebrisDensity?: number;
    chromaShiftDensity?: number;
    stormGeodeDensity?: number;
    speed: number;
    bgColor: number;
    skyColors: { top: number, bottom: number };
    levelType?: 'open' | 'tunnel' | 'organic_tunnel';
    tunnelHeight?: number;
    obstacleInterval?: number;
    fogDensity?: number;
    squidSpawnRate?: number;
    meteorShower?: boolean;
    godRays?: {
        enabled: boolean;
        density: number;
        baseIntensity: number;
        color: number;
        speedMultiplier: number;
    };
    aurora?: {
        enabled: boolean;
        density: number;
        color1: number;
        color2: number;
        speed: number;
    };
    lightning?: {
        enabled: boolean;
        density: number;
        color?: number;
    };
    enemyTintColor?: number;
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
        asteroidRate: 2.5,
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
            gravityAnchor: 3
        },
        speed: 8,
        bgColor: 0x1a1a2e,
        skyColors: { top: 0x000000, bottom: 0x1a1a2e },
        levelType: 'open',
        godRays: { enabled: true, density: 1.0, baseIntensity: 0.8, color: 0xffcc88, speedMultiplier: 1.2 },
        lightning: { enabled: true, density: 1.0 }
    },
    2: {
        name: "The Asteroid Belt",
        distance: 1200,
        objective: {
            type: 'sling',
            target: 5,
            description: "Complete 5 clean gravity slings"
        },
        asteroidRate: 0.8,
        ghostDebrisDensity: 100,
        chromaShiftDensity: 150,
        stormGeodeDensity: 20,
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
        godRays: { enabled: true, density: 1.0, baseIntensity: 0.8, color: 0xffcc88, speedMultiplier: 1.2 },
        lightning: { enabled: true, density: 1.5 }
    },
    3: {
        name: "Orbital Descent",
        distance: 2200,
        objective: {
            type: 'rescue',
            target: 4,
            description: "Rescue 4 space friends"
        },
        asteroidRate: 1.8,
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
            magmaHeart: 8
        },
        speed: 10,
        bgColor: 0x000510,
        skyColors: { top: 0x000011, bottom: 0x001133 },
        meteorShower: true,
        levelType: 'open',
        squidSpawnRate: 0.0012,
        lightning: { enabled: true, density: 2.0, color: 0xaa44ff }
    },
    4: {
        name: "The Rusty Gauntlet",
        distance: 3200,
        objective: {
            type: 'survive',
            target: 1,
            description: "Survive the rusty gauntlet"
        },
        asteroidRate: 2.0,
        stormGeodeDensity: 40,
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
        squidSpawnRate: 0.001
    },
    5: {
        name: "The Astral Leviathan",
        distance: 4200,
        objective: {
            type: 'combo',
            target: 7,
            description: "Reach an Arc Surge combo"
        },
        asteroidRate: 2.5,
        stormGeodeDensity: 50,
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
            magmaHeart: 4
        },
        speed: 10,
        bgColor: 0x0a0810,
        skyColors: { top: 0x0a001a, bottom: 0x1a0033 },
        levelType: 'organic_tunnel',
        tunnelHeight: 20,
        obstacleInterval: 25,
        fogDensity: 0.02,
        squidSpawnRate: 0.0015,
        godRays: { enabled: true, density: 0.5, baseIntensity: 0.4, color: 0xff00ff, speedMultiplier: 0.8 },
        lightning: { enabled: true, density: 2.5, color: 0xff00ff }
    },
    6: {
        name: "The Aqua Expanse",
        distance: 5200,
        objective: {
            type: 'boss',
            target: 1,
            description: "Find the path to the Moon"
        },
        asteroidRate: 1.5,
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
        aurora: { enabled: true, density: 1.0, color1: 0x00ffff, color2: 0xff00ff, speed: 1.5 }
    }
};

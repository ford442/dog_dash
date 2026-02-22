export type LevelConfig = {
    name: string;
    distance: number;
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
    };
    speed: number;
    bgColor: number;
    skyColors: { top: number, bottom: number };
    levelType?: 'open' | 'tunnel' | 'organic_tunnel';
    tunnelHeight?: number;
    obstacleInterval?: number;
    fogDensity?: number;
};

export const LEVEL_CONFIG: { [key: number]: LevelConfig } = {
    1: {
        name: "The Neon Garden",
        distance: 500,
        asteroidRate: 3.0,
        foliageDensity: {
            fern: 50,
            rose: 30,
            lotus: 10,
            glowingFlower: 40,
            tree: 50,
            floweringTree: 40,
            shrub: 40,
            vine: 15,
            orb: 25,
            mushroom: 30,
            cloud: 25,
            voidRootBall: 3,
            vacuumKelp: 5,
            iceNeedle: 8,
            liquidMetal: 4,
            magmaHeart: 2
        },
        speed: 6,
        bgColor: 0x1a1a2e,
        skyColors: { top: 0x000000, bottom: 0x1a1a2e },
        levelType: 'open'
    },
    2: {
        name: "The Asteroid Belt",
        distance: 1200,
        asteroidRate: 0.8,
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
        levelType: 'open'
    },
    3: {
        name: "Orbital Descent",
        distance: 2200,
        asteroidRate: 1.8,
        foliageDensity: {
            fern: 5,
            rose: 0,
            lotus: 15,
            glowingFlower: 5,
            tree: 5,
            floweringTree: 0,
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
        levelType: 'open'
    },
    4: {
        name: "The Rusty Gauntlet",
        distance: 3200,
        asteroidRate: 2.0,
        foliageDensity: {
            fern: 0,
            rose: 0,
            lotus: 0,
            glowingFlower: 5,
            tree: 0,
            floweringTree: 0,
            shrub: 0,
            vine: 0,
            orb: 15,
            mushroom: 0,
            cloud: 5,
            voidRootBall: 0,
            vacuumKelp: 0,
            iceNeedle: 0,
            liquidMetal: 5,
            magmaHeart: 3
        },
        speed: 12,
        bgColor: 0x1a1008,
        skyColors: { top: 0x110800, bottom: 0x221105 },
        levelType: 'tunnel',
        tunnelHeight: 15,
        obstacleInterval: 20
    },
    5: {
        name: "The Astral Leviathan",
        distance: 4200,
        asteroidRate: 2.5,
        foliageDensity: {
            fern: 5,
            rose: 0,
            lotus: 15,
            glowingFlower: 20,
            tree: 0,
            floweringTree: 0,
            shrub: 0,
            vine: 10,
            orb: 30,
            mushroom: 8,
            cloud: 15,
            voidRootBall: 5,
            vacuumKelp: 8,
            iceNeedle: 0,
            liquidMetal: 0,
            magmaHeart: 0
        },
        speed: 10,
        bgColor: 0x0a0810,
        skyColors: { top: 0x0a001a, bottom: 0x1a0033 },
        levelType: 'organic_tunnel',
        tunnelHeight: 20,
        obstacleInterval: 25,
        fogDensity: 0.02
    },
    6: {
        name: "The Aqua Expanse",
        distance: 5200,
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
        levelType: 'open'
    }
};

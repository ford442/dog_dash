/**
 * How each env system is switched on in a generated chapter: one patch per
 * descriptor key, applied to a fresh `LevelConfig` built from the biome's
 * campaign twin. The table is a `Record` over every `EnvDescriptorKey`, so a
 * new system fails typecheck until it says how Endless places it.
 *
 * Positions are absolute world X inside the chapter span (the same space the
 * campaign's `windCurrents.zones[].x` or `gravLensCorridors[].startX` use),
 * except artifacts, which are offsets from the player's X at chapter start.
 */
import type { Biome, EnvDescriptorKey } from '../env_system_descriptors';
import type { BossEncounterKind, LevelConfig, LevelEnvironments } from '../level_config';
import type { ChapterSpan } from '../journey_layout';
import type { SeededRng } from '../run_seed/rng';
import type { ChapterRecipe } from './recipe';

export type PatchContext = {
    recipe: ChapterRecipe;
    span: ChapterSpan;
    /** Campaign chapter the base config was cloned from. */
    twin: LevelConfig;
    ordinal: number;
    /** Layout stream for this chapter (positions, jitter); never the recipe stream. */
    rng: SeededRng;
};

type Patch = (cfg: LevelConfig, ctx: PatchContext) => void;

/** Absolute X at fraction `t` of the chapter. */
function at(ctx: PatchContext, t: number): number {
    return Math.round(ctx.span.startX + t * ctx.span.length);
}

function jitter(ctx: PatchContext, amount: number): number {
    return (ctx.rng.random() - 0.5) * 2 * amount;
}

function env(cfg: LevelConfig): LevelEnvironments {
    cfg.environments ??= {};
    return cfg.environments;
}

/** Turn a flag on with `true` (systems with no config). */
function on(flag: keyof LevelEnvironments): Patch {
    return (cfg) => {
        (env(cfg) as Record<string, unknown>)[flag] = true;
    };
}

/** Reuse the twin chapter's tuning for a flag when it has one, else `fallback`. */
function fromTwin<F extends keyof LevelEnvironments>(flag: F, fallback: NonNullable<LevelEnvironments[F]>): Patch {
    return (cfg, ctx) => {
        const tuned = ctx.twin.environments?.[flag];
        env(cfg)[flag] = structuredClone(tuned ?? fallback);
    };
}

const PORTAL_THEME: Record<Biome, 'pastel' | 'candy' | 'aurora'> = {
    candy: 'candy',
    nebula: 'pastel',
    industrial: 'pastel',
    biological: 'pastel',
    crystalline: 'aurora'
};

export const BOSS_TITLES: Record<BossEncounterKind, string> = {
    zephyr: 'The Zephyr',
    starEater: 'the Star-Eater',
    kraken: 'the Nebula Kraken'
};

export const RECIPE_PATCHES: Record<EnvDescriptorKey, Patch> = {
    // --- backdrops -------------------------------------------------------
    dynamicStarfield: on('dynamicStarfield'),
    dayNightCycle: on('dayNightCycle'),
    candyPlanetRing: on('candyPlanetRing'),
    candyField: on('candyField'),
    pastelNebula: on('pastelNebula'),
    galacticCore: (cfg, ctx) => {
        env(cfg).galacticCore = {
            enabled: true,
            approachStartX: at(ctx, 0.1),
            approachEndX: ctx.span.endX,
            startOffsetX: 340,
            endOffsetX: 95,
            startZ: -1150,
            endZ: -470,
            baseY: 95,
            intensity: 1.15,
            innerColor: 0xffb066,
            outerColor: 0x7a3fb5
        };
    },
    industrial: fromTwin('industrial', { intensity: 1.0, tunnelSpeed: 1.2 }),
    waterfall: on('waterfall'),
    planetaryHorizon: on('planetaryHorizon'),
    moonPalace: on('moonPalace'),
    biological: on('biological'),
    nebula: on('nebula'),
    nebulaRibbons: on('nebulaRibbons'),
    cosmicDust: on('cosmicDust'),
    godRays: fromTwin('godRays', { enabled: true, density: 0.8, baseIntensity: 0.6, color: 0xffffff, speedMultiplier: 1.0 }),
    aurora: fromTwin('aurora', { enabled: true, density: 1.0, color1: 0x00ffff, color2: 0xff00ff, speed: 1.5 }),
    weather: on('weather'),
    fossilizedSpaceWhales: on('fossilizedSpaceWhales'),
    hyperspaceTunnel: fromTwin('hyperspaceTunnel', { speed: 1.5, density: 1.0 }),
    cosmicCyberGrid: fromTwin('cosmicCyberGrid', { enabled: true, speedMultiplier: 1.5 }),
    energyRifts: on('energyRifts'),
    clouds: (cfg) => {
        env(cfg).clouds = { density: 5 };
    },
    grappleIsles: on('grappleIsles'),

    // --- hazards ---------------------------------------------------------
    blackHole: (cfg, ctx) => {
        // The disk drifts with the camera (x = baseX + 0.05·cameraX, y =
        // baseY − 0.01·cameraX); anchor it ~2.2k units ahead like chapter 2.
        const mid = at(ctx, 0.5);
        env(cfg).blackHole = { enabled: true, baseX: Math.round(mid * 0.95 + 2200), baseY: Math.round(90 + mid * 0.01) };
    },
    reEntry: on('reEntry'),
    meteorShower: on('meteorShower'),
    lightning: fromTwin('lightning', { enabled: true, density: 2.0 }),
    asteroidField: (cfg, ctx) => {
        // Featured hazard: the twin's full rate. Base stream: a lighter one.
        const rate = ctx.twin.environments?.asteroidField?.rate ?? 2.0;
        const featured = ctx.recipe.hazard === 'asteroidField';
        env(cfg).asteroidField = { rate: featured ? rate : Math.round(rate * 0.6 * 100) / 100 };
    },
    ghostDebris: (cfg) => {
        env(cfg).ghostDebris = { density: 100 };
    },
    aerialGuardPatrol: (cfg, ctx) => {
        env(cfg).aerialGuardPatrol = {
            zones: [0.3, 0.55, 0.8].map((t) => ({
                x: at(ctx, t),
                y: Math.round(jitter(ctx, 9)),
                z: 0,
                width: 80 + Math.round(ctx.rng.random() * 60),
                searchRadius: 15 + Math.round(ctx.rng.random() * 10)
            }))
        };
    },
    chromaShift: (cfg) => {
        cfg.chromaShiftDensity = 150;
    },
    stormGeode: (cfg, ctx) => {
        cfg.stormGeodeDensity = 25 + Math.min(25, ctx.ordinal * 2);
    },
    industrialGeometry: (cfg, ctx) => {
        const organic = ctx.recipe.biome === 'biological';
        cfg.levelType = organic ? 'organic_tunnel' : 'tunnel';
        cfg.tunnelHeight = organic ? 20 : 15;
        cfg.obstacleInterval = organic ? 25 : 20;
    },

    // --- traversal -------------------------------------------------------
    skyRailTerminal: on('skyRailTerminal'),
    windCurrents: (cfg, ctx) => {
        const lift = ctx.rng.random() < 0.5 ? 30 : -30;
        env(cfg).windCurrents = {
            zones: [
                { x: at(ctx, 0.3), y: 5, width: 200, height: 20, forceX: 0, forceY: lift },
                { x: at(ctx, 0.62), y: 5, width: 200, height: 20, forceX: 0, forceY: -lift }
            ]
        };
    },
    bouncePads: (cfg, ctx) => {
        env(cfg).bouncePads = {
            pads: [0.25, 0.45, 0.65].map((t) => ({
                x: at(ctx, t),
                y: Math.round(jitter(ctx, 5)),
                z: 0,
                bounceStrength: 40 + Math.round(ctx.rng.random() * 5)
            }))
        };
    },
    comboCorridor: on('comboCorridor'),
    timeShiftZones: (cfg, ctx) => {
        env(cfg).timeShiftZones = {
            zones: [0.3, 0.6].map((t) => ({ x: at(ctx, t), y: 0, width: 80 + Math.round(ctx.rng.random() * 20), height: 25 }))
        };
    },
    airTokens: (cfg, ctx) => {
        env(cfg).airTokens = {
            tokens: [0.1, 0.22, 0.34, 0.46, 0.58, 0.7].map((t) => ({ x: at(ctx, t), y: Math.round(jitter(ctx, 9)) }))
        };
    },
    slingables: (cfg) => {
        cfg.toyRocketCount = 2;
    },
    gravLens: (cfg, ctx) => {
        cfg.gravLensCorridors = [{
            startX: at(ctx, 0.4),
            lenses: [0, 95, 190].map((offsetX) => ({
                offsetX,
                y: Math.round(jitter(ctx, 6)),
                z: -4 - Math.round(ctx.rng.random() * 3)
            }))
        }];
    },

    // --- flavor ----------------------------------------------------------
    wishLanterns: on('wishLanterns'),
    spacePetsSwarm: on('spacePetsSwarm'),
    dreamPortals: (cfg, ctx) => {
        env(cfg).dreamPortals = {
            enabled: true,
            portals: [{ x: at(ctx, 0.5), y: Math.round(jitter(ctx, 6)), z: -1, theme: PORTAL_THEME[ctx.recipe.biome], durationSeconds: 32 }]
        };
    },
    voidJellyfish: (cfg) => {
        env(cfg).voidJellyfish = { density: 40 };
    },
    aquaticLife: on('aquaticLife'),
    dancingJellyMoss: (cfg) => {
        env(cfg).dancingJellyMoss = { density: 1.5 };
    },
    singingGeodes: (cfg) => {
        env(cfg).singingGeodes = { density: 15 };
    },
    cloudCastles: on('cloudCastles'),
    flowerConstellations: on('flowerConstellations'),
    hideAndSeekStars: on('hideAndSeekStars'),
    spaceGarden: on('spaceGarden'),
    shootingStars: on('shootingStars'),
    starlightKoi: (cfg) => {
        cfg.koiSchoolDensity = 4;
    },
    bubbleCoral: (cfg) => {
        cfg.bubbleCoralDensity = 4;
        env(cfg).bubbleCoral = { density: 0.8 };
    },
    liquidMetal: (cfg) => {
        cfg.foliageDensity.liquidMetal = 5;
    },
    crystalChimes: (cfg) => {
        cfg.chimeDensity = 8;
    },
    derelictBuoys: (cfg, ctx) => {
        cfg.derelictBuoys = [{ x: Math.round(ctx.span.length * 0.3), y: 6, z: -6 }];
    },
    dataMonoliths: (cfg, ctx) => {
        cfg.dataMonoliths = [{ x: Math.round(ctx.span.length * 0.5), y: 5, z: -8, tier: ctx.ordinal >= 6 ? 2 : 1 }];
    },
    // Always loaded (DEFERRED_LEVEL_LOAD_RULES); listing it just credits the recipe.
    magicPaintbrush: () => {},
    butterflySwarm: on('butterflySwarm'),

    // --- boss ------------------------------------------------------------
    boss: (cfg, ctx) => {
        const kind = ctx.recipe.bossKind ?? 'zephyr';
        cfg.bossEncounter = { kind, triggerX: at(ctx, 0.45) };
        cfg.objective = { type: 'boss', target: 1, description: `Defeat ${BOSS_TITLES[kind]}` };
        // A Kraken gate is the chapter's only Kraken.
        if (kind === 'kraken') cfg.squidSpawnRate = 0;
    }
};

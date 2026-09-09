/**
 * `DEFERRED_LEVEL_REGISTRY` — non-env deferred systems (density / objective /
 * spawn-rule driven), split out of `level_env_registry.ts`.
 */
import type { DeferredLevelSystemKey } from './level_deferred_registry';
import { DEFERRED_LEVEL_NEEDS_LOAD } from './level_deferred_registry';
import { patchEnvironmentSystems } from './environment';
import type { DeferredLevelRegistryEntry } from './level_env_registry_types';

export const DEFERRED_LEVEL_REGISTRY: Record<DeferredLevelSystemKey, DeferredLevelRegistryEntry> = {
    boss: {
        systemKey: 'boss',
        needsLoad: DEFERRED_LEVEL_NEEDS_LOAD.boss,
        load: () => import('./boss_system'),
        install: (ctx, mod) => {
            const { BossManager } = mod as typeof import('./boss_system');
            ctx.assignGameSystem('bossManager', new BossManager(ctx.scene));
        }
    },
    chromaShift: {
        systemKey: 'chromaShift',
        needsLoad: DEFERRED_LEVEL_NEEDS_LOAD.chromaShift,
        load: () => import('./chroma_shift'),
        install: (ctx, mod) => {
            const { ChromaShiftSystem } = mod as typeof import('./chroma_shift');
            ctx.installEnvPartial({ chromaShiftSystem: new ChromaShiftSystem(ctx.scene) });
        }
    },
    stormGeode: {
        systemKey: 'stormGeode',
        needsLoad: DEFERRED_LEVEL_NEEDS_LOAD.stormGeode,
        load: () => import('./storm_geodes'),
        install: (ctx, mod) => {
            const { StormGeodeSystem } = mod as typeof import('./storm_geodes');
            ctx.installEnvPartial({
                stormGeodeSystem: new StormGeodeSystem(ctx.scene, {
                    playHit: () => ctx.game.audioSystem.play('hit'),
                    onBoltStrike: (pos, color) => ctx.game.lightningBoltSystem.onBoltStrike?.(pos, color)
                })
            });
        }
    },
    industrialGeometry: {
        systemKey: 'industrialGeometry',
        needsLoad: DEFERRED_LEVEL_NEEDS_LOAD.industrialGeometry,
        load: () => import('./industrial_geometry'),
        install: (ctx, mod) => {
            const { IndustrialGeometryManager } = mod as typeof import('./industrial_geometry');
            const instance = new IndustrialGeometryManager(ctx.scene);
            ctx.game.industrialGeometryManager = instance;
            if (ctx.game.levelManager) {
                ctx.game.levelManager.industrialGeometryManager = instance;
            }
        }
    },
    starlightKoi: {
        systemKey: 'starlightKoi',
        needsLoad: DEFERRED_LEVEL_NEEDS_LOAD.starlightKoi,
        load: () => import('./starlight_koi'),
        install: (ctx, mod) => {
            const { StarlightKoiManager } = mod as typeof import('./starlight_koi');
            ctx.game.starlightKoiManager = new StarlightKoiManager(ctx.scene, ctx.game.particleSystem);
        }
    },
    bubbleCoral: {
        systemKey: 'bubbleCoral',
        needsLoad: DEFERRED_LEVEL_NEEDS_LOAD.bubbleCoral,
        load: () => import('./bubble_coral'),
        install: (ctx, mod) => {
            const { RainbowBubbleCoralManager } = mod as typeof import('./bubble_coral');
            ctx.game.bubbleCoralManager = new RainbowBubbleCoralManager(ctx.scene, ctx.game.particleSystem);
        }
    },
    clouds: {
        systemKey: 'clouds',
        needsLoad: () => true,
        load: () => import('./clouds'),
        install: (ctx, mod) => {
            // eagerly loaded
        }
    },
    slingables: {
        systemKey: 'slingables',
        needsLoad: DEFERRED_LEVEL_NEEDS_LOAD.slingables,
        load: async () => {
            const [slingables, rockets] = await Promise.all([
                import('./slingable_objects'),
                import('./toy_rockets')
            ]);
            return { ...slingables, ...rockets };
        },
        install: (ctx, mod) => {
            const { SlingableObjectSystem, ToyRocketSpawnManager } = mod as typeof import('./slingable_objects') &
                typeof import('./toy_rockets');
            const slingableObjectSystem = new SlingableObjectSystem(
                ctx.scene,
                ctx.game.particleSystem,
                ctx.game.debrisSystem
            );
            ctx.game.slingableObjectSystem = slingableObjectSystem;
            ctx.game.toyRocketSpawnManager = new ToyRocketSpawnManager(slingableObjectSystem);
            if (typeof ctx.game.rewireSlingableCallbacks === 'function') {
                ctx.game.rewireSlingableCallbacks();
            }
        }
    },
    liquidMetal: {
        systemKey: 'liquidMetal',
        needsLoad: DEFERRED_LEVEL_NEEDS_LOAD.liquidMetal,
        load: () => import('./geological/liquid_metal'),
        install: (ctx, mod) => {
            const { LiquidMetalSystem } = mod as typeof import('./geological/liquid_metal');
            const instance = new LiquidMetalSystem(ctx.scene);
            ctx.assignGameSystem('liquidMetalSystem', instance);
            patchEnvironmentSystems({ liquidMetalSystem: instance });
        }
    },
    crystalChimes: {
        systemKey: 'crystalChimes',
        needsLoad: DEFERRED_LEVEL_NEEDS_LOAD.crystalChimes,
        load: () => import('./crystal_chimes'),
        install: (ctx, mod) => {
            const { CrystalChimeManager } = mod as typeof import('./crystal_chimes');
            ctx.installEnvPartial({
                crystalChimeManager: new CrystalChimeManager(ctx.scene, ctx.game.particleSystem, ctx.game.audioSystem)
            });
        }
    },
    gravLens: {
        systemKey: 'gravLens',
        needsLoad: DEFERRED_LEVEL_NEEDS_LOAD.gravLens,
        load: () => import('./grav_lens'),
        install: (ctx, mod) => {
            const { GravLensManager } = mod as typeof import('./grav_lens');
            ctx.assignGameSystem('gravLensManager', new GravLensManager(ctx.scene));
        }
    },
    derelictBuoys: {
        systemKey: 'derelictBuoys',
        needsLoad: DEFERRED_LEVEL_NEEDS_LOAD.derelictBuoys,
        load: () => import('./derelict_buoy'),
        install: (ctx, mod) => {
            const { DerelictBuoyManager } = mod as typeof import('./derelict_buoy');
            ctx.assignGameSystem('derelictBuoyManager', new DerelictBuoyManager(ctx.scene));
        }
    },
    dataMonoliths: {
        systemKey: 'dataMonoliths',
        needsLoad: DEFERRED_LEVEL_NEEDS_LOAD.dataMonoliths,
        load: () => import('./data_monolith'),
        install: (ctx, mod) => {
            const { DataMonolithManager } = mod as typeof import('./data_monolith');
            ctx.assignGameSystem('dataMonolithManager', new DataMonolithManager(ctx.scene));
        }
    },
    magicPaintbrush: {
        systemKey: 'magicPaintbrush',
        needsLoad: DEFERRED_LEVEL_NEEDS_LOAD.magicPaintbrush,
        load: () => import('./magic_paintbrush'),
        install: (ctx, mod) => {
            const { MagicPaintbrushSystem } = mod as typeof import('./magic_paintbrush');
            ctx.assignGameSystem('magicPaintbrushSystem', new MagicPaintbrushSystem(ctx.scene));
        }
    }
};

/**
 * Per-level / per-flag async system loading.
 * Heavy modules are only downloaded when a level that needs them is about to start
 * (or prefetched near the end of the previous segment).
 */
import { game } from './game_runtime';
import { getLevelSpan } from './depth_layers';
import { LEVEL_CONFIG, LEVEL_DISTANCE_BOUNDARIES, type LevelConfig } from './level_config';
import { isEnvironmentEnabled } from './level_manager/types';
import type { LevelEnvironmentPorts } from './level_manager/types';
import {
    shouldSpawnStarlightKoi,
    shouldSpawnBubbleCoral
} from './level_spawn_rules';
import { scene, camera } from './scene_context';

type SystemKey =
    | 'reEntry'
    | 'waterfall'
    | 'meteorShower'
    | 'industrial'
    | 'biological'
    | 'cosmicDust'
    | 'boss'
    | 'planetaryHorizon'
    | 'moonPalace'
    | 'chromaShift'
    | 'stormGeode'
    | 'blackHole'
    | 'ghostDebris'
    | 'voidJellyfish'
    | 'industrialGeometry'
    | 'aquaticLife'
    | 'starlightKoi'
    | 'bubbleCoral'
    | 'slingables'
    | 'wishLanterns'
    | 'weather';

const loaded = new Set<SystemKey>();
const inflight = new Map<SystemKey, Promise<void>>();
const prefetchedLevels = new Set<number>();

function installEnvPartial(partial: Partial<LevelEnvironmentPorts>): void {
    Object.assign(game, partial);
    if (game.levelManager) {
        game.levelManager.installEnvironmentSystems(partial);
    }
}

function assignGameSystem<K extends keyof typeof game>(key: K, value: (typeof game)[K]): void {
    game[key] = value;
}

async function loadSystem(key: SystemKey): Promise<void> {
    if (loaded.has(key)) return;
    const existing = inflight.get(key);
    if (existing) return existing;

    const promise = (async () => {
        switch (key) {
            case 'reEntry': {
                const { ReEntrySystem } = await import('./reentry');
                installEnvPartial({ reEntrySystem: new ReEntrySystem(scene, camera) });
                break;
            }
            case 'waterfall': {
                const { WaterfallSystem } = await import('./waterfall');
                installEnvPartial({
                    waterfallSystem: new WaterfallSystem(scene, camera, game.weaponLightManager)
                });
                break;
            }
            case 'weather': {
                const { WeatherSystem } = await import('./weather_system');
                installEnvPartial({
                    weatherSystem: new WeatherSystem(scene)
                });
                break;
            }
            case 'wishLanterns': {
                const { WishLanternSystem } = await import('./wish_lanterns');
                installEnvPartial({
                    wishLanternSystem: new WishLanternSystem(scene)
                });
                break;
            }
            case 'meteorShower': {
                const { MeteorShowerSystem } = await import('./meteor_shower');
                installEnvPartial({
                    meteorShowerSystem: new MeteorShowerSystem(scene, game.weaponLightManager)
                });
                break;
            }
            case 'industrial': {
                const { IndustrialBackgroundSystem } = await import('./industrial_background');
                installEnvPartial({
                    industrialSystem: new IndustrialBackgroundSystem(scene, game.weaponLightManager)
                });
                break;
            }
            case 'biological': {
                const { BiologicalBackgroundSystem } = await import('./biological_background');
                installEnvPartial({ biologicalSystem: new BiologicalBackgroundSystem(scene) });
                break;
            }
            case 'cosmicDust': {
                const { CosmicDustSystem } = await import('./cosmic_dust');
                installEnvPartial({
                    cosmicDustSystem: new CosmicDustSystem(scene, game.weaponLightManager)
                });
                break;
            }
            case 'boss': {
                const { BossManager } = await import('./boss_system');
                assignGameSystem('bossManager', new BossManager(scene));
                break;
            }
            case 'planetaryHorizon': {
                const { PlanetaryHorizonSystem } = await import('./planetary_horizon');
                installEnvPartial({
                    planetaryHorizonSystem: new PlanetaryHorizonSystem(scene, camera)
                });
                break;
            }
            case 'moonPalace': {
                const { MoonPalaceSystem } = await import('./moon_palace');
                installEnvPartial({
                    moonPalaceSystem: new MoonPalaceSystem(scene, camera, game.weaponLightManager)
                });
                break;
            }
            case 'chromaShift': {
                const { ChromaShiftSystem } = await import('./chroma_shift');
                installEnvPartial({ chromaShiftSystem: new ChromaShiftSystem(scene) });
                break;
            }
            case 'stormGeode': {
                const { StormGeodeSystem } = await import('./storm_geodes');
                installEnvPartial({
                    stormGeodeSystem: new StormGeodeSystem(scene, {
                        playHit: () => game.audioSystem.play('hit'),
                        onBoltStrike: (pos, color) => game.lightningBoltSystem.onBoltStrike?.(pos, color)
                    })
                });
                break;
            }
            case 'blackHole': {
                const { BlackHoleSystem } = await import('./black_hole');
                installEnvPartial({ blackHoleSystem: new BlackHoleSystem(scene) });
                break;
            }
            case 'ghostDebris': {
                const { GhostDebrisSystem } = await import('./ghost_debris');
                game.ghostDebrisSystem = new GhostDebrisSystem(scene);
                if (game.levelManager) {
                    game.levelManager.ghostDebrisSystem = game.ghostDebrisSystem;
                }
                break;
            }
            case 'voidJellyfish': {
                const { VoidJellyfishSystem } = await import('./void_jellyfish');
                game.voidJellyfishSystem = new VoidJellyfishSystem(scene);
                if (game.levelManager) {
                    game.levelManager.voidJellyfishSystem = game.voidJellyfishSystem;
                }
                break;
            }
            case 'industrialGeometry': {
                const { IndustrialGeometryManager } = await import('./industrial_geometry');
                game.industrialGeometryManager = new IndustrialGeometryManager(scene);
                if (game.levelManager) {
                    game.levelManager.industrialGeometryManager = game.industrialGeometryManager;
                }
                break;
            }
            case 'aquaticLife': {
                const { AquaticLifeManager } = await import('./aquatic_life');
                game.aquaticLifeManager = new AquaticLifeManager(scene);
                break;
            }
            case 'starlightKoi': {
                const { StarlightKoiManager } = await import('./starlight_koi');
                game.starlightKoiManager = new StarlightKoiManager(scene, game.particleSystem);
                break;
            }
            case 'bubbleCoral': {
                const { RainbowBubbleCoralManager } = await import('./bubble_coral');
                game.bubbleCoralManager = new RainbowBubbleCoralManager(scene, game.particleSystem);
                break;
            }
            case 'slingables': {
                const [{ SlingableObjectSystem }, { ToyRocketSpawnManager }] = await Promise.all([
                    import('./slingable_objects'),
                    import('./toy_rockets')
                ]);
                const slingableObjectSystem = new SlingableObjectSystem(
                    scene,
                    game.particleSystem,
                    game.debrisSystem
                );
                game.slingableObjectSystem = slingableObjectSystem;
                game.toyRocketSpawnManager = new ToyRocketSpawnManager(slingableObjectSystem);
                if (typeof game.rewireSlingableCallbacks === 'function') {
                    game.rewireSlingableCallbacks();
                }
                break;
            }
        }
        loaded.add(key);
        inflight.delete(key);
    })();

    inflight.set(key, promise);
    try {
        await promise;
    } catch (err) {
        inflight.delete(key);
        throw err;
    }
}

/** Resolve which deferred systems a level config needs. */
export function systemsNeededForLevel(cfg: LevelConfig | undefined): SystemKey[] {
    if (!cfg) return [];
    const keys = new Set<SystemKey>();
    const env = cfg.environments || {};

    if (isEnvironmentEnabled(env.reEntry)) keys.add('reEntry');
    if (isEnvironmentEnabled(env.waterfall)) keys.add('waterfall');
    if (isEnvironmentEnabled(env.meteorShower)) keys.add('meteorShower');
    if (isEnvironmentEnabled(env.industrial)) keys.add('industrial');
    if (isEnvironmentEnabled(env.biological)) keys.add('biological');
    if (isEnvironmentEnabled(env.cosmicDust)) keys.add('cosmicDust');
    if (isEnvironmentEnabled(env.planetaryHorizon)) keys.add('planetaryHorizon');
    if (isEnvironmentEnabled(env.moonPalace)) keys.add('moonPalace');
    if (isEnvironmentEnabled(env.blackHole)) keys.add('blackHole');
    if (isEnvironmentEnabled(env.ghostDebris)) keys.add('ghostDebris');
    if (isEnvironmentEnabled(env.voidJellyfish)) keys.add('voidJellyfish');
    if (isEnvironmentEnabled(env.aquaticLife)) keys.add('aquaticLife');
    if (isEnvironmentEnabled(env.wishLanterns)) keys.add('wishLanterns');
    if (isEnvironmentEnabled(env.weather)) keys.add('weather');

    if ((cfg.chromaShiftDensity ?? 0) > 0) keys.add('chromaShift');
    if ((cfg.stormGeodeDensity ?? 0) > 0) keys.add('stormGeode');

    if (cfg.levelType === 'tunnel' || cfg.levelType === 'organic_tunnel') {
        keys.add('industrialGeometry');
    }

    if (cfg.objective?.type === 'boss') keys.add('boss');

    if (shouldSpawnStarlightKoi(env, cfg.koiSchoolDensity)) keys.add('starlightKoi');
    if (shouldSpawnBubbleCoral(env, cfg.bubbleCoralDensity)) keys.add('bubbleCoral');

    if ((cfg.toyRocketCount ?? 0) > 0 || cfg.objective?.type === 'sling') {
        keys.add('slingables');
    }

    return [...keys];
}

async function loadKeys(keys: SystemKey[]): Promise<void> {
    if (keys.length === 0) return;
    await Promise.all(keys.map((k) => loadSystem(k)));
}

/** Loads async chunks needed before the first gameplay click (Level 1 only). */
export function ensureGameplayReady(): Promise<void> {
    return ensureLevelSystemsForLevel(1);
}

/** Prefetch chunks for a target level (no-op if already covered). */
export function prefetchLevelSystems(levelIndex: number): void {
    if (prefetchedLevels.has(levelIndex)) return;
    prefetchedLevels.add(levelIndex);
    void ensureLevelSystemsForLevel(levelIndex);
}

/** Ensure systems for a level transition are loaded before startLevel runs. */
export async function ensureLevelSystemsForLevel(levelIndex: number): Promise<void> {
    const cfg = LEVEL_CONFIG[levelIndex];
    await loadKeys(systemsNeededForLevel(cfg));
}

/** Load slingable / toy-rocket systems (prototype content, non-blocking for L1 start). */
export async function ensureSlingableSystems(): Promise<void> {
    await loadSystem('slingables');
}

/** Prefetch the next level chunk when the player is ~75% through the current segment. */
export function maybePrefetchNextLevel(playerX: number, currentLevel: number): void {
    if (currentLevel >= 6) return;
    const { startX, length } = getLevelSpan(currentLevel);
    const progress = length > 0 ? (playerX - startX) / length : 0;
    if (progress >= 0.75) {
        prefetchLevelSystems(currentLevel + 1);
    }
    const nextBoundary = LEVEL_DISTANCE_BOUNDARIES[currentLevel];
    if (nextBoundary !== undefined && playerX > nextBoundary - length * 0.15) {
        prefetchLevelSystems(currentLevel + 1);
    }
}

export function isGameplayReady(): boolean {
    return loaded.size > 0 || systemsNeededForLevel(LEVEL_CONFIG[1]).every((k) => loaded.has(k));
}

export function isSystemLoaded(key: SystemKey): boolean {
    return loaded.has(key);
}

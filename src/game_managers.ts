/**
 * Gameplay managers composition root.
 * Boot constructs stubs; real managers load via ensureGameManagers() before first play.
 */
import * as THREE from 'three';
import type { FriendsManager } from './space_friends';
import type { ConstellationManager } from './flower_constellations';
import type { PinwheelFloraManager } from './pinwheel_flora';
import type { CandyBeltManager } from './candy_obstacles';
import type { ButterflySwarmSystem } from './butterfly_swarm';
import type { SolarSailFernManager } from './solar_sail_ferns';
import type { WindChimeManager } from './wind_chimes';
import type { ParticleSystem } from './particles';
import type { AudioSystem } from './audio_system';
import { game } from './game_runtime';
import { scene } from './scene_context';

export interface GameManagers {
    friendsManager: FriendsManager;
    flowerManager: ConstellationManager;
    pinwheelManager: PinwheelFloraManager;
    candyManager: CandyBeltManager;
    butterflySwarmSystem: ButterflySwarmSystem;
    solarSailFernManager: SolarSailFernManager;
    windChimeManager: WindChimeManager;
}

const noop = () => undefined;
const emptyArr = () => [];

function createFriendsManagerStub(): FriendsManager {
    return {
        lanterns: [],
        flotilla: [],
        lemursThisLevel: 0,
        MAX_LEMURS_PER_LEVEL: 3,
        update: noop,
        maybeSpawnFriends: noop,
        cleanupFarFriends: noop,
        getScannables: emptyArr,
        getRescuedCount: () => 0,
        hasFullFlotilla: () => false,
        resetLevelLemurCap: noop,
        spawnTrappedLemurIsland: noop,
        spawnTrappedFriendsAlong: () => [],
        spawnSealPup: noop,
        spawnTarsiersNearAnchor: noop,
        maybeSpawnLemurOnPerch: noop,
        cheerFlotilla: noop,
        cheerTarsiersNearAnchor: noop,
        triggerVictoryFlyby: noop,
        panicTarsiersNear: noop,
        panicLemursNear: noop,
        popLantern: noop
    } as unknown as FriendsManager;
}

function createButterflySwarmStub(): ButterflySwarmSystem {
    return {
        activate: noop,
        deactivate: noop,
        update: noop,
        bindEffects: noop,
        resyncBudgetCounts: noop,
        tryAbsorbHit: () => false
    } as unknown as ButterflySwarmSystem;
}

function createPinwheelStub(): PinwheelFloraManager {
    return {
        update: () => [],
        cleanupFarBehind: noop,
        streamChunk: noop,
        spawnField: noop,
        clear: noop
    } as unknown as PinwheelFloraManager;
}

function createWindChimeStub(): WindChimeManager {
    return {
        update: noop,
        cleanupFarBehind: noop,
        streamChunk: noop,
        spawnField: noop,
        clear: noop
    } as unknown as WindChimeManager;
}

function createSolarSailStub(): SolarSailFernManager {
    return {
        update: () => [],
        cleanupFarBehind: noop,
        streamChunk: noop,
        clear: noop
    } as unknown as SolarSailFernManager;
}

function createCandyBeltStub(): CandyBeltManager {
    return {
        update: noop,
        checkCollisions: () => [],
        clear: noop,
        generateCandyBelt: noop
    } as unknown as CandyBeltManager;
}

function createFlowerManagerStub(): ConstellationManager {
    return {
        update: noop,
        clear: noop,
        spawnField: noop
    } as unknown as ConstellationManager;
}

let createdManagers: GameManagers | null = null;
let managersReady = false;
let managersInflight: Promise<void> | null = null;

/**
 * Creates stub managers at bootstrap so title paint does not download friends/flora chunks.
 * Call ensureGameManagers() before first gameplay frame.
 */
export function createGameManagers(
    _scene: THREE.Scene,
    _audioSystem: AudioSystem,
    _particleSystem: ParticleSystem
): GameManagers {
    if (createdManagers) {
        throw new Error('createGameManagers() must only be called once per runtime.');
    }

    createdManagers = {
        friendsManager: createFriendsManagerStub(),
        flowerManager: createFlowerManagerStub(),
        pinwheelManager: createPinwheelStub(),
        candyManager: createCandyBeltStub(),
        butterflySwarmSystem: createButterflySwarmStub(),
        solarSailFernManager: createSolarSailStub(),
        windChimeManager: createWindChimeStub()
    };

    return createdManagers;
}

/** Load and install real managers; rewire levelManager + butterfly effects. */
export async function ensureGameManagers(): Promise<void> {
    if (managersReady) return;
    if (managersInflight) return managersInflight;

    managersInflight = (async () => {
        const { createRealGameManagers } = await import('./game_managers_impl');
        const real = createRealGameManagers(scene, game.audioSystem, game.particleSystem);

        // Preserve callbacks wired on the stub during startup.
        const stubFriends = game.friendsManager;
        real.friendsManager.onFriendRescued = stubFriends?.onFriendRescued;
        real.friendsManager.onOtterGift = stubFriends?.onOtterGift;
        real.friendsManager.onPenguinSlide = stubFriends?.onPenguinSlide;
        real.friendsManager.onSealClap = stubFriends?.onSealClap;
        real.friendsManager.onAstroBunnyLucky = stubFriends?.onAstroBunnyLucky;
        real.friendsManager.onLemurHeartGift = stubFriends?.onLemurHeartGift;

        real.butterflySwarmSystem.bindEffects(
            game.particleSystem,
            game.juiceManager,
            game.audioSystem
        );

        Object.assign(game, real);
        createdManagers = real;

        const lm = game.levelManager;
        if (lm) {
            lm.butterflySwarmSystem = real.butterflySwarmSystem;
            lm.friendsManager = real.friendsManager;
            lm.pinwheelManager = real.pinwheelManager;
            lm.windChimeManager = real.windChimeManager;
            lm.solarSailFernManager = real.solarSailFernManager;
            lm.candyManager = real.candyManager;
        }

        managersReady = true;
    })();

    try {
        await managersInflight;
    } catch (err) {
        managersInflight = null;
        throw err;
    }
}

export function isGameManagersReady(): boolean {
    return managersReady;
}

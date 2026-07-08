import * as THREE from 'three';
import { FriendsManager } from './space_friends';
import { ConstellationManager } from './flower_constellations';
import { PinwheelFloraManager } from './pinwheel_flora';
import { CandyBeltManager } from './candy_obstacles';
import { CastleBackgroundManager } from './cloud_castles';
import { ButterflySwarmSystem } from './butterfly_swarm';
import { SolarSailFernManager } from './solar_sail_ferns';
import { WindChimeManager } from './wind_chimes';
import type { ParticleSystem } from './particles';

export interface GameManagers {
    friendsManager: FriendsManager;
    flowerManager: ConstellationManager;
    pinwheelManager: PinwheelFloraManager;
    candyManager: CandyBeltManager;
    castleManager: CastleBackgroundManager;
    butterflySwarmSystem: ButterflySwarmSystem;
    solarSailFernManager: SolarSailFernManager;
    windChimeManager: WindChimeManager;
}

let createdManagers: GameManagers | null = null;

/**
 * Creates the singleton gameplay managers that own scene objects and need the
 * rendered scene from scene_context/main.ts. Call once during main startup.
 */
export function createGameManagers(
    scene: THREE.Scene,
    audioSystem: unknown,
    particleSystem: unknown
): GameManagers {
    if (createdManagers) {
        throw new Error('createGameManagers() must only be called once per runtime.');
    }

    createdManagers = {
        friendsManager: new FriendsManager(scene, audioSystem, particleSystem),
        flowerManager: new ConstellationManager(scene, audioSystem, particleSystem),
        pinwheelManager: new PinwheelFloraManager(scene, particleSystem),
        candyManager: new CandyBeltManager(scene, audioSystem, particleSystem),
        castleManager: new CastleBackgroundManager(scene),
        butterflySwarmSystem: new ButterflySwarmSystem(scene),
        solarSailFernManager: new SolarSailFernManager(scene, particleSystem),
        windChimeManager: new WindChimeManager(scene, particleSystem, audioSystem)
    };

    return createdManagers;
}

import * as THREE from 'three';
import { FriendsManager } from './space_friends';
import { ConstellationManager } from './flower_constellations';
import { CandyBeltManager } from './candy_obstacles';
import { CastleBackgroundManager } from './cloud_castles';
import { ButterflySwarmSystem } from './butterfly_swarm';

export interface GameManagers {
    friendsManager: FriendsManager;
    flowerManager: ConstellationManager;
    candyManager: CandyBeltManager;
    castleManager: CastleBackgroundManager;
    butterflySwarmSystem: ButterflySwarmSystem;
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
        candyManager: new CandyBeltManager(scene, audioSystem, particleSystem),
        castleManager: new CastleBackgroundManager(scene),
        butterflySwarmSystem: new ButterflySwarmSystem(scene)
    };

    return createdManagers;
}

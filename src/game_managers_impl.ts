/**
 * Real gameplay-manager construction (dynamically imported).
 * Kept out of the cold entry graph — see ensureGameManagers() in game_managers.ts.
 */
import * as THREE from 'three';
import { FriendsManager } from './space_friends';
import { ConstellationManager } from './flower_constellations';
import { PinwheelFloraManager } from './pinwheel_flora';
import { CandyBeltManager } from './candy_obstacles';
import { ButterflySwarmSystem } from './butterfly_swarm';
import { SolarSailFernManager } from './solar_sail_ferns';
import { WindChimeManager } from './wind_chimes';
import type { ParticleSystem } from './particles';
import type { AudioSystem } from './audio_system';
import type { GameManagers } from './game_managers';

export function createRealGameManagers(
    scene: THREE.Scene,
    audioSystem: AudioSystem,
    particleSystem: ParticleSystem
): GameManagers {
    return {
        friendsManager: new FriendsManager(scene, audioSystem, particleSystem),
        flowerManager: new ConstellationManager(scene, audioSystem, particleSystem),
        pinwheelManager: new PinwheelFloraManager(scene, particleSystem),
        candyManager: new CandyBeltManager(scene, audioSystem, particleSystem),
        butterflySwarmSystem: new ButterflySwarmSystem(scene),
        solarSailFernManager: new SolarSailFernManager(scene, particleSystem),
        windChimeManager: new WindChimeManager(scene, particleSystem, audioSystem)
    };
}

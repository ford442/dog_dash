import type * as THREE from 'three';
import type {
    LevelConfig,
    LevelEnvironments
} from '../level_config';
import type { LevelEnvironmentPorts } from './types';

/** Systems registry host for environment plugin activation. */
export interface LevelPluginHost extends LevelEnvironmentPorts {
    cloudSystem: { layers: { mesh: { visible: boolean } }[] };
    ghostDebrisSystem: { activate: () => void; deactivate: () => void };
    voidJellyfishSystem: { activate: (config: NonNullable<LevelEnvironments['voidJellyfish']>) => void; deactivate: () => void };
    camera: { position: { x: number } };
    baseAsteroidDensity: number;
    objectDensityMultiplier: number;
    moonPalaceSystem: LevelEnvironmentPorts['moonPalaceSystem'] & { levelDistance: number; activate: () => void; deactivate: () => void };
    wishLanternSystem: LevelEnvironmentPorts['wishLanternSystem'] & { activate: () => void; deactivate: () => void };
    spacePetsSwarmSystem: LevelEnvironmentPorts['spacePetsSwarmSystem'] & { activate: () => void; deactivate: () => void };
    weatherSystem: LevelEnvironmentPorts['weatherSystem'] & { activate: () => void; deactivate: () => void };
    dancingJellyMossSystem: LevelEnvironmentPorts['dancingJellyMossSystem'] & { activate: (config?: { density?: number }) => void; deactivate: () => void };
    dynamicStarfieldSystem: LevelEnvironmentPorts['dynamicStarfieldSystem'] & { activate: (config?: { speedScaling?: number }) => void; deactivate: () => void };
    dayNightCycleSystem: LevelEnvironmentPorts['dayNightCycleSystem'] & { activate: (config?: { cycleDuration?: number }) => void; deactivate: () => void };
    cloudCastlesSystem: LevelEnvironmentPorts['cloudCastlesSystem'] & { activate: (config?: { density?: number }) => void; deactivate: () => void; cleanup: () => void };
    windCurrentsSystem: LevelEnvironmentPorts['windCurrentsSystem'] & { activate: (config?: any) => void; deactivate: () => void; cleanup: () => void; getWindForce: (pos: THREE.Vector3) => THREE.Vector3; };
    timeShiftZonesSystem: LevelEnvironmentPorts['timeShiftZonesSystem'] & { activate: (config?: any) => void; deactivate: () => void; cleanup: () => void; getTimeScaleModifier: (pos: THREE.Vector3) => number; };
    candyFieldSystem: LevelEnvironmentPorts['candyFieldSystem'] & { activate: (config?: unknown) => void; deactivate: () => void; setVisible: (visible: boolean) => void; update: (delta: number, cameraX: number) => void };
    shootingStarsSystem?: LevelEnvironmentPorts['shootingStarsSystem'] & { activate: (config?: any) => void; deactivate: () => void; cleanup: () => void; };
    bouncePadsSystem: LevelEnvironmentPorts['bouncePadsSystem'] & { activate: (config?: any) => void; deactivate: () => void; update: (delta: number, cameraX: number, playerPos?: THREE.Vector3) => void; cleanup: () => void; checkCollision: (pos: THREE.Vector3, velY: number) => number | null; };
    aerialGuardPatrolSystem: LevelEnvironmentPorts['aerialGuardPatrolSystem'] & { activate: (config?: any) => void; deactivate: () => void; update: (delta: number, cameraX: number, playerPos?: THREE.Vector3) => void; cleanup: () => void; checkDetection: (playerPos: THREE.Vector3) => number; };
    airTokensSystem: LevelEnvironmentPorts['airTokensSystem'] & { activate: (config?: any) => void; deactivate: () => void; update: (delta: number, cameraX: number, playerPos?: THREE.Vector3) => void; cleanup: () => void; collectNear: (pos: THREE.Vector3, radius?: number) => { lift: number } | null; };
    singingGeodeSystem: LevelEnvironmentPorts['singingGeodeSystem'] & { activate: (density?: number) => void; deactivate: () => void; update: (delta: number, cameraX: number, playerPos?: THREE.Vector3) => void; cleanup: () => void };
}

export type EnvPluginBuilder = (
    host: LevelPluginHost,
    cfg: LevelConfig,
    levelLength: number
) => { flag: keyof LevelEnvironments; activate: (value: never) => void; deactivate: () => void };

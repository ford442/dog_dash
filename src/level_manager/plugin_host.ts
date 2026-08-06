import type * as THREE from 'three';
import type {
    LevelConfig,
    LevelEnvironments,
    GodRaysEnvironmentConfig,
    AuroraEnvironmentConfig,
    LightningEnvironmentConfig,
    AsteroidFieldEnvironmentConfig
} from '../level_config';
import type { LevelEnvironmentPorts } from './types';

/** Systems registry host for environment plugin activation. */
export interface LevelPluginHost extends LevelEnvironmentPorts {
    butterflySwarmSystem: { activate: () => void; deactivate: () => void };
    cloudSystem: { layers: { mesh: { visible: boolean } }[] };
    godRaySystem: { activate: (config: GodRaysEnvironmentConfig) => void; deactivate: () => void };
    auroraSystem: { activate: (config: AuroraEnvironmentConfig) => void; deactivate: () => void };
    ghostDebrisSystem: { activate: () => void; deactivate: () => void };
    voidJellyfishSystem: { activate: (config: NonNullable<LevelEnvironments['voidJellyfish']>) => void; deactivate: () => void };
    camera: { position: { x: number } };
    baseAsteroidDensity: number;
    objectDensityMultiplier: number;
    moonPalaceSystem: LevelEnvironmentPorts['moonPalaceSystem'] & { levelDistance: number; activate: () => void; deactivate: () => void };
    wishLanternSystem: LevelEnvironmentPorts['wishLanternSystem'] & { activate: () => void; deactivate: () => void };
    weatherSystem: LevelEnvironmentPorts['weatherSystem'] & { activate: () => void; deactivate: () => void };
    dancingJellyMossSystem: LevelEnvironmentPorts['dancingJellyMossSystem'] & { activate: (config?: { density?: number }) => void; deactivate: () => void };
    dynamicStarfieldSystem: LevelEnvironmentPorts['dynamicStarfieldSystem'] & { activate: (config?: { speedScaling?: number }) => void; deactivate: () => void };
    dayNightCycleSystem: LevelEnvironmentPorts['dayNightCycleSystem'] & { activate: (config?: { cycleDuration?: number }) => void; deactivate: () => void };
    cloudCastlesSystem: LevelEnvironmentPorts['cloudCastlesSystem'] & { activate: (config?: { density?: number }) => void; deactivate: () => void; cleanup: () => void };
    candyFieldSystem: LevelEnvironmentPorts['candyFieldSystem'] & { activate: (config?: unknown) => void; deactivate: () => void; setVisible: (visible: boolean) => void; update: (delta: number, cameraX: number) => void };
    singingGeodeSystem: LevelEnvironmentPorts['singingGeodeSystem'] & { activate: (density?: number) => void; deactivate: () => void; update: (delta: number, cameraX: number, playerPos?: THREE.Vector3) => void; cleanup: () => void };
}

export type EnvPluginBuilder = (
    host: LevelPluginHost,
    cfg: LevelConfig,
    levelLength: number
) => { flag: keyof LevelEnvironments; activate: (value: never) => void; deactivate: () => void };

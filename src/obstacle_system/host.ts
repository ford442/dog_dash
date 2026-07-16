import * as THREE from 'three';
import type { EnemyInstance } from '../enemy_patterns';
import { NebulaKraken } from '../space_robot_squid';
import type { ObstacleSystemOptions } from './types';

/** Mutable state surface shared by spawn/collision helper modules. */
export interface ObstacleSystemHost {
    scene: THREE.Scene;
    options: ObstacleSystemOptions;
    obstacles: THREE.Mesh[];
    patternEnemies: EnemyInstance[];
    squids: NebulaKraken[];
    time: number;
    bounceCooldown: number;
    grazeCombo: number;
    lastGrazeTime: number;
    grazeCount: number;
    grazeCooldowns: Map<THREE.Mesh, number>;
    grazeWindowBonusDist: number;
    grazeWindowBonusTimer: number;
    level6KrakenSpawned: boolean;
    readonly GRAZE_MIN_DIST: number;
    readonly GRAZE_MAX_DIST: number;
    readonly GRAZE_COMBO_TIMEOUT: number;
    readonly GRAZE_COOLDOWN: number;
}

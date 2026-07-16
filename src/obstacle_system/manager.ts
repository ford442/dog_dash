import * as THREE from 'three';
import {
    type PatternConfig,
    type EnemyInstance,
    updatePatternPosition
} from '../enemy_patterns';
import { NebulaKraken } from '../space_robot_squid';
import { getCandyScoreBonus, type CandyAsteroidVariant } from '../candy_materials';
import type { ObstacleSystemOptions } from './types';
import type { ObstacleSystemHost } from './host';
import {
    splitAsteroid as splitAsteroidFn,
    spawnPatternFormation,
    createAsteroid as createAsteroidFn,
    createCandyAsteroid as createCandyAsteroidFn,
    createMineRobot,
    createBarnaclePod,
    triggerCandySquash as triggerCandySquashFn,
    _updateCandyAsteroid
} from './spawn_pools';
import {
    handleSquidCollision,
    handleCollision,
    handleBounce,
    processGrazeDetection
} from './collision_hooks';

export class ObstacleSystem implements ObstacleSystemHost {
    readonly scene: THREE.Scene;
    readonly options: ObstacleSystemOptions;
    readonly obstacles: THREE.Mesh[] = [];
    readonly patternEnemies: EnemyInstance[] = [];
    squids: NebulaKraken[] = [];
    private spawnInterval = 1.5;
    private lastSpawn = 0;
    private patternSpawnTimer = 0;
    private nextPatternDistance = 100;
    private currentPattern: PatternConfig | null = null;
    private patternProgress = 0;
    time = 0;
    bounceCooldown = 0;

    grazeCombo = 0;
    lastGrazeTime = 0;
    grazeCount = 0;
    grazeCooldowns = new Map<THREE.Mesh, number>();
    readonly GRAZE_MIN_DIST = 1.0;
    readonly GRAZE_MAX_DIST = 1.8;
    readonly GRAZE_COMBO_TIMEOUT = 2.5;
    readonly GRAZE_COOLDOWN = 0.4;
    grazeWindowBonusDist = 0;
    grazeWindowBonusTimer = 0;

    level6KrakenSpawned = false;

    constructor(options: ObstacleSystemOptions) {
        this.options = options;
        this.scene = options.scene;
    }

    getObstacles() {
        return this.obstacles;
    }

    getGrazeCombo(): number {
        if (this.time - this.lastGrazeTime > this.GRAZE_COMBO_TIMEOUT) {
            return 0;
        }
        return this.grazeCombo;
    }

    applyGrazeWindowBonus(duration: number, extraDist: number): void {
        this.grazeWindowBonusTimer = Math.max(this.grazeWindowBonusTimer, duration);
        this.grazeWindowBonusDist = Math.max(this.grazeWindowBonusDist, extraDist);
    }

    update(delta: number) {
        const player = this.options.getPlayer();
        if (!player) return;

        this.time += delta;
        const playerX = player.position.x;
        const playerY = player.position.y;
        const currentCfg = this.options.getCurrentConfig();
        if (currentCfg) {
            this.spawnInterval = currentCfg.environments?.asteroidField?.rate ?? 0;
        }

        this.patternSpawnTimer += delta;
        if (playerX > this.nextPatternDistance) {
            spawnPatternFormation(this, playerX + 50, playerY);
            this.nextPatternDistance = playerX + 80 + Math.random() * 100;
        }

        this.lastSpawn += delta;
        if (this.lastSpawn > this.spawnInterval * 1.5) {
            this.lastSpawn = 0;
            const spawnX = playerX + 50 + Math.random() * 30;
            const waveY = Math.sin(playerX * 0.1) * 5 + Math.cos(playerX * 0.05) * 3;
            const spawnY = waveY + (Math.random() - 0.5) * 8;

            const mineRate = currentCfg?.mineRobotRate || 0;
            const barnacleRate = currentCfg?.barnaclePodRate || 0;
            if (mineRate > 0 && Math.random() < mineRate) {
                createMineRobot(this, spawnX, spawnY, 0);
            } else if (barnacleRate > 0 && Math.random() < barnacleRate) {
                createBarnaclePod(this, spawnX, spawnY, 0);
            } else {
                const candyChance = currentCfg?.candyAsteroidChance ?? 0;
                if (candyChance > 0 && Math.random() < candyChance) {
                    createCandyAsteroidFn(this, spawnX, spawnY, 0);
                } else {
                    createAsteroidFn(this, spawnX, spawnY, 0);
                }
            }
        }

        for (const enemy of this.patternEnemies) {
            const newPos = updatePatternPosition(enemy, this.time, delta);
            enemy.mesh.position.copy(newPos);
            enemy.mesh.rotation.x += delta * enemy.speed;
            enemy.mesh.rotation.y += delta * enemy.speed * 0.7;
        }

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.rotation.x += obs.userData.rotationSpeed * delta;
            obs.rotation.y += obs.userData.rotationSpeedY * delta;
            obs.rotation.z += obs.userData.rotationSpeedZ * delta;

            if (obs.userData.velocity) {
                obs.position.addScaledVector(obs.userData.velocity, delta);
            }

            if (obs.userData.isCandyAsteroid) {
                _updateCandyAsteroid(this, obs, delta);
            }

            if (obs.userData.isMineRobot && obs.userData.pupils) {
                const distToPlayer = Math.hypot(obs.position.x - playerX, obs.position.y - playerY);
                const alert = distToPlayer < 12 ? 1.0 : 0.0;
                for (const pupil of obs.userData.pupils as THREE.Mesh[]) {
                    const pmat = pupil.material as THREE.MeshStandardMaterial;
                    pmat.emissiveIntensity = 0.4 + alert * 0.8;
                    pupil.scale.setScalar(1.0 + alert * 0.3);
                }
                if (alert === 1.0) {
                    this.options.onMineRobotProximity?.();
                }
            }

            const zDepth = Math.abs(obs.position.z);
            if (!obs.userData.isCandyAsteroid) {
                if (zDepth > 1.0) {
                    const mat = obs.material as THREE.MeshStandardMaterial;
                    const depthFactor = Math.min(1.0, zDepth / 25.0);
                    const brightness = 1.0 - depthFactor * 0.9;
                    mat.color.setScalar(0.4 * brightness);
                } else {
                    const mat = obs.material as THREE.MeshStandardMaterial;
                    if (mat.color.r < 0.3) mat.color.setScalar(0.4);
                }
            }

            if (obs.position.x < playerX - 30 || Math.abs(obs.position.z) > 50) {
                this.scene.remove(obs);
                this.obstacles.splice(i, 1);
            }
        }

        for (let i = this.patternEnemies.length - 1; i >= 0; i--) {
            const enemy = this.patternEnemies[i];
            if (enemy.mesh.position.x < playerX - 50) {
                this.scene.remove(enemy.mesh);
                this.patternEnemies.splice(i, 1);
            }
        }

        const squidRate = currentCfg?.squidSpawnRate || 0;
        const currentLevel = this.options.getCurrentLevel();
        // L6 capstone is the Star-Eater Pitcher (boss_system); Kraken still spawns randomly elsewhere.
        const isLevel6Capstone = false;

        if (isLevel6Capstone || (squidRate > 0 && this.squids.length === 0 && Math.random() < squidRate)) {
            const spawnX = playerX + 55;
            const spawnY = (Math.random() - 0.5) * 12;
            const squid = new NebulaKraken({
                scene: this.scene,
                particleSystem: this.options.particleSystem,
                debrisSystem: this.options.debrisSystem,
            }, spawnX, spawnY);
            if (isLevel6Capstone) {
                this.level6KrakenSpawned = true;
            }
            this.squids.push(squid);
        }

        for (let i = this.squids.length - 1; i >= 0; i--) {
            const squid = this.squids[i];
            squid.update(delta, playerX, playerY);

            if (!this.options.playerState.invincible && !this.options.playerState.inSafeHarbor) {
                const dist = squid.getPosition().distanceTo(new THREE.Vector3(playerX, playerY, 0));
                if (dist < squid.getRadius() + 1.0) {
                    handleSquidCollision(this, squid);
                }
            }

            if (squid.isDestroyed || squid.getPosition().x < playerX - 50) {
                if (!squid.isDestroyed) {
                    this.scene.remove(squid.group);
                }
                this.squids.splice(i, 1);
            }
        }

        const wasm = this.options.getWasm();
        if (!wasm.exports) return;

        const activeObstacles = this.obstacles.filter(o => Math.abs(o.position.z) < 2.0);
        if (activeObstacles.length > 0) {
            const ptr = wasm.exports.allocAsteroids(activeObstacles.length);
            let memory = wasm.memory;
            if (!memory || memory.buffer !== wasm.exports.memory.buffer) {
                memory = new Float32Array(wasm.exports.memory.buffer);
                this.options.setWasmMemory(memory);
            }
            const startIdx = ptr >>> 2;
            for (let i = 0; i < activeObstacles.length; i++) {
                const obs = activeObstacles[i];
                const offset = startIdx + (i * 3);
                memory[offset] = obs.position.x;
                memory[offset + 1] = obs.position.y;
                memory[offset + 2] = obs.userData.radius || 1.0;
            }

            const hitIndex = wasm.exports.checkCollision(playerX, playerY, 0.5, activeObstacles.length);
            if (hitIndex !== -1) {
                const hitObs = activeObstacles[hitIndex];
                const hitRadius = hitObs.userData.radius || 1.0;
                const modifiers = this.options.getPowerUpModifiers
                    ? this.options.getPowerUpModifiers()
                    : { shieldActive: false, shieldBouncesAsteroids: false };
                if (modifiers.shieldBouncesAsteroids && this.bounceCooldown <= 0) {
                    handleBounce(this, hitObs);
                } else if (!this.options.playerState.invincible && !this.options.playerState.inSafeHarbor) {
                    if (this.bounceCooldown <= 0 && this.options.tryConsumeButterflyCharge?.()) {
                        this.options.onButterflySave?.(hitObs.position);
                    } else if (this.options.tryConsumeSwarmEscort?.(hitObs.position.clone(), hitRadius)) {
                        this.bounceCooldown = 0.35;
                        this.options.particleSystem.emit(hitObs.position.clone(), 0xffb6c1, 8, 4.0, 0.4, 0.45);
                    } else if (this.bounceCooldown <= 0 && this.options.tryConsumeWrenchCharge?.()) {
                        handleBounce(this, hitObs);
                        this.options.onWrenchSave?.(hitObs);
                    } else {
                        handleCollision(this, hitObs);
                    }
                }
            }
        }

        this.bounceCooldown = Math.max(0, this.bounceCooldown - delta);
        if (this.grazeWindowBonusTimer > 0) {
            this.grazeWindowBonusTimer = Math.max(0, this.grazeWindowBonusTimer - delta);
            if (this.grazeWindowBonusTimer <= 0) {
                this.grazeWindowBonusDist = 0;
            }
        }

        processGrazeDetection(this, activeObstacles, player, playerX, playerY, delta);

        const nearbyClouds = this.options.sporeClouds.filter(c => c.active && Math.abs(c.position.x - playerX) < 20);
        if (nearbyClouds.length > 0) {
            const cloudPtr = wasm.exports.allocSporeClouds(nearbyClouds.length);
            let memory = wasm.memory;
            if (!memory || memory.buffer !== wasm.exports.memory.buffer) {
                memory = new Float32Array(wasm.exports.memory.buffer);
                this.options.setWasmMemory(memory);
            }
            const cloudStartIdx = cloudPtr >>> 2;
            for (let i = 0; i < nearbyClouds.length; i++) {
                const c = nearbyClouds[i];
                const offset = cloudStartIdx + (i * 4);
                memory[offset] = c.position.x;
                memory[offset + 1] = c.position.y;
                memory[offset + 2] = c.position.z;
                memory[offset + 3] = 5.0;
            }

            const cloudHitIndex = wasm.exports.checkSporeCollision(playerX, playerY, 0, 1.0, nearbyClouds.length);
            if (cloudHitIndex !== -1) {
                const hitCloud = nearbyClouds[cloudHitIndex];
                if (!hitCloud.spores.userData.playerInside) {
                    hitCloud.spores.userData.playerInside = true;
                    this.options.particleSystem.emit(player.position.clone(), 0x88ff88, 5, 2.0, 0.5, 1.0);
                }
            } else {
                nearbyClouds.forEach(c => { c.spores.userData.playerInside = false; });
            }
        }
    }

    splitAsteroid(asteroid: THREE.Mesh) {
        splitAsteroidFn(this, asteroid);
    }

    createAsteroid(x: number, y: number, z = 0, size = 0, velocity: THREE.Vector3 | null = null) {
        return createAsteroidFn(this, x, y, z, size, velocity);
    }

    createCandyAsteroid(
        x: number,
        y: number,
        z = 0,
        size = 0,
        velocity: THREE.Vector3 | null = null,
        flavor?: import('../candy_materials').CandyFlavor,
        variant?: CandyAsteroidVariant
    ) {
        return createCandyAsteroidFn(this, x, y, z, size, velocity, flavor, variant);
    }

    triggerCandySquash(asteroid: THREE.Mesh, intensity = 1) {
        triggerCandySquashFn(this, asteroid, intensity);
    }

    getSquids(): NebulaKraken[] {
        return this.squids;
    }
}

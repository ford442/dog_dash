import * as THREE from 'three';
import type { LevelConfig } from './level_config';
import type { SporeCloud } from './geological';
import { NebulaKraken } from './space_robot_squid';

type ObstacleSystemOptions = {
    scene: THREE.Scene;
    getPlayer: () => THREE.Group | null;
    getCurrentConfig: () => LevelConfig | undefined;
    playerState: { health: number; invincible: boolean; velocity: THREE.Vector3 };
    getWasm: () => { exports: any; memory: Float32Array | null };
    setWasmMemory: (memory: Float32Array | null) => void;
    sporeClouds: SporeCloud[];
    particleSystem: {
        emit: (position: THREE.Vector3, color: number, count: number, speed: number, lifetime: number, size?: number) => void;
    };
    debrisSystem: { emit: (position: THREE.Vector3, count: number, speed: number, radius: number) => void };
    waterfallSystem: { triggerSplash: (position: THREE.Vector3, strength: number) => void };
    getCurrentLevel: () => number;
    updateHealthDisplay: () => void;
    gameOver: () => void;
};

export class ObstacleSystem {
    private readonly scene: THREE.Scene;
    private readonly options: ObstacleSystemOptions;
    private readonly obstacles: THREE.Mesh[] = [];
    private squids: NebulaKraken[] = [];
    private spawnInterval = 1.5;
    private lastSpawn = 0;

    constructor(options: ObstacleSystemOptions) {
        this.options = options;
        this.scene = options.scene;
    }

    getObstacles() {
        return this.obstacles;
    }

    update(delta: number) {
        const player = this.options.getPlayer();
        if (!player) return;

        const playerX = player.position.x;
        const playerY = player.position.y;
        const currentCfg = this.options.getCurrentConfig();
        if (currentCfg) {
            this.spawnInterval = currentCfg.asteroidRate;
        }

        this.lastSpawn += delta;
        if (this.lastSpawn > this.spawnInterval) {
            this.lastSpawn = 0;
            const spawnX = playerX + 40 + Math.random() * 20;
            const spawnY = (Math.random() - 0.5) * 15;
            this.createAsteroid(spawnX, spawnY, 0);
        }

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.rotation.x += obs.userData.rotationSpeed * delta;
            obs.rotation.y += obs.userData.rotationSpeedY * delta;
            obs.rotation.z += obs.userData.rotationSpeedZ * delta;

            if (obs.userData.velocity) {
                obs.position.addScaledVector(obs.userData.velocity, delta);
            }

            const zDepth = Math.abs(obs.position.z);
            if (zDepth > 1.0) {
                const mat = obs.material as THREE.MeshStandardMaterial;
                const depthFactor = Math.min(1.0, zDepth / 25.0);
                const brightness = 1.0 - depthFactor * 0.9;
                mat.color.setScalar(0.4 * brightness);
            } else {
                const mat = obs.material as THREE.MeshStandardMaterial;
                if (mat.color.r < 0.3) mat.color.setScalar(0.4);
            }

            if (obs.position.x < playerX - 30 || Math.abs(obs.position.z) > 50) {
                this.scene.remove(obs);
                this.obstacles.splice(i, 1);
            }
        }

        // --- Nebula Kraken (Boss Squid) Spawning & Update ---
        const squidRate = currentCfg?.squidSpawnRate || 0;
        if (squidRate > 0 && this.squids.length === 0 && Math.random() < squidRate) {
            const spawnX = playerX + 55;
            const spawnY = (Math.random() - 0.5) * 12;
            const squid = new NebulaKraken({
                scene: this.scene,
                particleSystem: this.options.particleSystem,
                debrisSystem: this.options.debrisSystem,
            }, spawnX, spawnY);
            this.squids.push(squid);
        }

        // Update squids
        for (let i = this.squids.length - 1; i >= 0; i--) {
            const squid = this.squids[i];
            squid.update(delta, playerX, playerY);

            // Player-squid collision (simple distance check)
            if (!this.options.playerState.invincible) {
                const dist = squid.getPosition().distanceTo(new THREE.Vector3(playerX, playerY, 0));
                if (dist < squid.getRadius() + 1.0) {
                    this.handleSquidCollision(squid);
                }
            }

            // Clean up destroyed or far-away squids
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
                this.handleCollision(activeObstacles[hitIndex]);
            }
        }

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
        this.options.debrisSystem.emit(asteroid.position, 8, 5.0, asteroid.userData.radius);
        const r = asteroid.userData.radius;
        if (r > 0.8) {
            const count = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
                const speed = 3.0 + Math.random() * 3.0;
                const zSpeed = (Math.random() - 0.5) * 8.0;
                const vel = new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed, zSpeed);
                this.createAsteroid(asteroid.position.x, asteroid.position.y, asteroid.position.z, r * 0.5, vel);
            }
        }

        this.scene.remove(asteroid);
        const idx = this.obstacles.indexOf(asteroid);
        if (idx > -1) this.obstacles.splice(idx, 1);
    }

    private createAsteroid(x: number, y: number, z = 0, size = 0, velocity: THREE.Vector3 | null = null) {
        const finalSize = (size > 0) ? size : (0.5 + Math.random() * 1.5);
        const geo = new THREE.IcosahedronGeometry(finalSize, 1);
        const positions = geo.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const px = positions.getX(i);
            const py = positions.getY(i);
            const pz = positions.getZ(i);
            const noise = (Math.random() - 0.5) * 0.4;
            positions.setXYZ(i, px * (1 + noise), py * (1 + noise), pz * (1 + noise));
        }
        geo.computeVertexNormals();

        const colorVariation = Math.random() * 0.2;
        const baseColor = 0x666666 + Math.floor(colorVariation * 0x222222);
        const mat = new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: 0.95,
            metalness: 0.05,
            flatShading: true
        });
        const asteroid = new THREE.Mesh(geo, mat);
        asteroid.position.set(x, y, z);
        asteroid.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        asteroid.castShadow = true;
        asteroid.receiveShadow = true;
        asteroid.userData = {
            rotationSpeed: (Math.random() - 0.5) * 2,
            rotationSpeedY: (Math.random() - 0.5) * 1.5,
            rotationSpeedZ: (Math.random() - 0.5) * 1.8,
            radius: finalSize,
            velocity: velocity || new THREE.Vector3(0, 0, 0)
        };
        this.scene.add(asteroid);
        this.obstacles.push(asteroid);
        return asteroid;
    }

    getSquids(): NebulaKraken[] {
        return this.squids;
    }

    private handleSquidCollision(squid: NebulaKraken) {
        const player = this.options.getPlayer();
        if (!player) return;

        // Squid collision deals damage to player
        this.options.particleSystem.emit(
            player.position.clone(), 0x9900ff, 20, 8.0, 1.2, 1.5
        );

        // The squid also takes some damage from ramming
        squid.takeDamage(25);

        this.options.playerState.health--;
        this.options.playerState.invincible = true;

        // Visual flash on player rocket
        const rocket = player.children[0];
        if (rocket) {
            rocket.children.forEach((child: any) => {
                if (child.material) {
                    const originalColor = child.material.color.clone();
                    child.material.color.setHex(0x9900ff); // Purple flash
                    setTimeout(() => {
                        if (child.material) {
                            child.material.color.copy(originalColor);
                        }
                    }, 200);
                }
            });
        }

        setTimeout(() => {
            this.options.playerState.invincible = false;
        }, 2000);

        this.options.updateHealthDisplay();
        if (this.options.playerState.health <= 0) {
            this.options.gameOver();
        }

        // Knockback from squid
        const dy = squid.getPosition().y - player.position.y;
        this.options.playerState.velocity.y += (dy > 0 ? -8 : 8);
        this.options.playerState.velocity.x -= 5;
    }

    private handleCollision(obs: THREE.Mesh) {
        if (!obs) return;
        const player = this.options.getPlayer();
        const playerY = player ? player.position.y : 0;
        this.options.particleSystem.emit(obs.position.clone(), 0xff5555, 15, 10.0, 1.2, 1.0);
        if (this.options.getCurrentLevel() === 6) {
            this.options.waterfallSystem.triggerSplash(obs.position, 30);
        }

        this.splitAsteroid(obs);
        this.options.playerState.health--;
        this.options.playerState.invincible = true;

        if (player) {
            const rocket = player.children[0];
            if (rocket) {
                rocket.children.forEach((child: any) => {
                    if (child.material) {
                        const originalColor = child.material.color.clone();
                        child.material.color.setHex(0xff0000);
                        setTimeout(() => {
                            if (child.material) {
                                child.material.color.copy(originalColor);
                            }
                        }, 200);
                    }
                });
            }
        }

        setTimeout(() => {
            this.options.playerState.invincible = false;
        }, 2000);

        this.options.updateHealthDisplay();
        if (this.options.playerState.health <= 0) {
            this.options.gameOver();
        }

        const dy = obs.position.y - playerY;
        this.options.playerState.velocity.y += (dy > 0 ? -5 : 5);
        this.options.playerState.velocity.x -= 3;
    }
}

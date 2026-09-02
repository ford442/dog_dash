import * as THREE from 'three';
import { camera } from '../../scene_context';
import { player } from '../../player_loader';
import { playerState } from '../../game_config';
import { game } from '../../game_runtime';
import { updateHealthDisplay } from '../../ui_controls';
import { DogAnimationState } from '../../dog_cockpit';
import { ShakeType } from '../../juice_effects';
import { VictoryState } from '../../victory_system/victory_state';
import { updateBossHealthBar } from '../boss_health_ui';
import { writeBossHitboxesToWasm, checkCircleCollisionJs } from '../../physics_utils';
import { WasmBackend, type WasmHandle } from '../../wasm_loader';

/** Boss spawn/update, WASM projectile hits, health bar. Returns true on mouth-snap death. */
export function updateCombatBoss(delta: number): boolean {
    if (!player) return false;

    if (!playerState.bossActive) {
        const bossSpawned = game.bossManager.checkBossSpawn(
            player.position.x,
            playerState.level,
            game.levelManager.config[game.levelManager.currentLevel]?.distance,
            {
                onDefeated: () => {
                    playerState.cores += 50;
                    game.saveManager.addCores(50);
                    if (game.saveManager.hasMemory('star_eater')) {
                        playerState.cores += 10;
                        game.saveManager.addCores(10);
                    }
                    game.saveManager.recordBossDefeated();
                    game.audioSystem.play('boss_defeat');
                    playerState.bossActive = false;

                    playerState.autoScrollSpeed = game.saveManager.applyToSpeed(8);

                    const objective = game.levelManager.config[game.levelManager.currentLevel]?.objective;
                    if (objective?.type === 'boss') {
                        game.hudManager.updateObjectiveProgress(objective.target, objective.target);

                        if (game.levelManager.currentLevel === 6 && !game.level6BossDefeated) {
                            game.level6BossDefeated = true;
                            game.particleSystem.emit(
                                player!.position.clone(), 0xeeffff, 25, 5.0, 1.2, 1.4
                            );
                            game.particleSystem.emit(
                                player!.position.clone(), 0xff0044, 20, 4.0, 1.4, 1.6
                            );
                            game.waterfallSystem.triggerSplash(player!.position.clone(), 35);
                            game.audioSystem.playWhaleSong();

                            game.juiceManager.showFloatingText(
                                'The Path to the Moon Opens!',
                                player!.position.clone(),
                                '#aaffff',
                                30
                            );
                            game.juiceManager.burstMagic(player!.position.clone());
                            game.dogController.triggerAnimation(DogAnimationState.VICTORY, 2.0);

                            const bossPos = game.bossManager.getBoss()?.group.position
                                ?? player!.position.clone();
                            game.planetaryHorizonSystem.activateMoonGate(
                                new THREE.Vector3(bossPos.x + 120, 0, -30)
                            );
                            game.friendsManager.triggerVictoryFlyby(4.0);
                            game.moonGateSequenceActive = true;
                            game.moonGateSequenceTimer = 0;
                        }
                    }

                    console.log('🎉 BOSS DEFEATED! +50 Cores');
                },
                onPlayerHit: () => {
                    game.lastPlayerDamageTime = performance.now() * 0.001;
                    if (!playerState.invincible && !playerState.inSafeHarbor) {
                        playerState.health--;
                        game.audioSystem.play('hit');
                        updateHealthDisplay(playerState);
                        game.dogController.triggerAnimation(DogAnimationState.HIT, 1.0);
                        game.juiceManager.shakeScreen(ShakeType.HEAVY);
                        if (player) game.juiceManager.burstDamage(player.position.clone());
                        game.hudManager.updateHealth(playerState.health, playerState.maxHealth);
                        if (playerState.health <= 0) {
                            game.handleGameOver();
                        }
                    }
                },
                getPlayerPosition: () => player ? player.position : null,
                spawnDebris: (pos, homing) => {
                    const speed = homing ? 12 : 8;
                    game.obstacleSystem.createAsteroid(
                        pos.x, pos.y, pos.z, homing ? 0.8 : 1.0,
                        new THREE.Vector3(-speed - Math.random() * 5, (Math.random() - 0.5) * 5, 0)
                    );
                },
                onPhaseChange: (phase) => {
                    if (phase === 'phase1') {
                        game.audioSystem.play('boss_suction');
                    } else {
                        game.audioSystem.play('boss_phase');
                    }
                    game.juiceManager.shakeScreen(ShakeType.HEAVY);
                },
                onBossStart: () => {
                    playerState.bossActive = true;
                    playerState.autoScrollSpeed = 2;
                    game.audioSystem.play('boss_roar');
                    game.audioSystem.updateDroneIntensity(2.0);
                    game.creatureCatalogManager.catalog('star_eater');
                }
            }
        );

        if (bossSpawned) {
            console.log('👹 Boss fight started!');
        }
    }

    const bossResult = game.bossManager.update(delta);
    if (bossResult.bossActive && player) {
        const playerPos = player.position;
        const boss = bossResult.boss;
        const bossPos = boss?.group.position;

        if (boss && bossPos) {
            const pullDir = bossPos.y - playerPos.y;
            playerState.currentSpeedY += pullDir * bossResult.pullForce * delta * 0.1;

            // Add vertical pull force from Zephyr boss
            if (bossResult.pullForceY) {
                 playerState.currentSpeedY += bossResult.pullForceY * delta;
            }

            if (bossResult.isSnapping) {
                const distToMouth = Math.abs(playerPos.x - (bossPos.x + 8));
                if (distToMouth < 3 && Math.abs(playerPos.y - bossPos.y) < 3) {
                    playerState.health = 0;
                    updateHealthDisplay(playerState);
                    game.dogController.triggerAnimation(DogAnimationState.HIT, 1.0);
                    game.juiceManager.shakeScreen(ShakeType.EARTHQUAKE);
                    game.juiceManager.burstDamage(player.position.clone());
                    game.hudManager.updateHealth(0, playerState.maxHealth);
                    game.handleGameOver();
                    return true;
                }
            }

            const projectiles = game.weaponSystem.getActiveProjectiles();
            const hitboxes = boss.collectWasmHitboxes();
            if (hitboxes.length > 0) {
                const applyBossHit = (hitIndex: number, proj: { active: boolean; mesh: THREE.Object3D; deactivate: () => void }) => {
                    const entry = boss.resolveHitboxEntry(hitIndex);
                    if (!entry?.dealsDamage) {
                        proj.deactivate();
                        return;
                    }

                    const damage = (entry.target === 'boss' ? 10 : 15) * game.weaponDamageMult;
                    if (boss.takeDamage(damage, entry.target)) {
                        game.audioSystem.play('hit');
                        game.particleSystem.emit(
                            proj.mesh.position.clone(),
                            entry.target === 'boss' ? 0xff0044 : 0xff66aa,
                            12, 4.0, 0.8, 1.2
                        );
                        proj.deactivate();
                    }
                };

                if (game.wasmExports) {
                    const exports = game.wasmExports;
                    const wasmHandle: WasmHandle = {
                        exports,
                        memory: game.wasmMemory ?? new Float32Array(exports.memory.buffer),
                        backend: WasmBackend.AssemblyScript
                    };
                    const count = writeBossHitboxesToWasm(wasmHandle, hitboxes);
                    if (game.wasmMemory?.buffer !== exports.memory.buffer) {
                        game.wasmMemory = new Float32Array(exports.memory.buffer);
                    }

                    for (const proj of projectiles) {
                        if (!proj.active) continue;
                        const hitIndex = exports.checkBossCollision(
                            proj.mesh.position.x,
                            proj.mesh.position.y,
                            0.5,
                            count
                        );
                        if (hitIndex === -1) continue;
                        applyBossHit(hitIndex, proj);
                    }
                } else {
                    for (const proj of projectiles) {
                        if (!proj.active) continue;
                        const hitIndex = checkCircleCollisionJs(
                            proj.mesh.position.x,
                            proj.mesh.position.y,
                            0.5,
                            hitboxes
                        );
                        if (hitIndex === -1) continue;
                        applyBossHit(hitIndex, proj);
                    }
                }
            }
        }
    }

    updateBossHealthBar(game.obstacleSystem.getSquids(), game.bossManager.getBoss());
    return false;
}

/** Projectile hits on Nebula Kraken squids. */
export function updateCombatBossKraken(
    projectiles: Array<{ active: boolean; mesh: THREE.Object3D; deactivate: () => void }>
): void {
    const squids = game.obstacleSystem.getSquids();
    for (const squid of squids) {
        if (squid.isDestroyed) continue;

        if (player && squid.getPosition().distanceTo(player.position) < squid.getRadius() + 6) {
            game.creatureCatalogManager.catalog('kraken');
        }

        for (const proj of projectiles) {
            if (!proj.active) continue;
            const dist = proj.mesh.position.distanceTo(squid.getPosition());
            if (dist < squid.getRadius() + 0.5) {
                game.particleSystem.emit(proj.mesh.position.clone(), 0x9900ff, 15, 6.0, 1.0, 1.5);
                squid.takeDamage(30);
                proj.deactivate();

                if (squid.isDestroyed && game.saveManager.hasMemory('kraken') && !game.krakenMemoryRewarded.has(squid)) {
                    game.krakenMemoryRewarded.add(squid);
                    game.saveManager.addCores(20);
                    if (player) {
                        game.juiceManager.showFloatingText('Kraken Memory +20', squid.getPosition().clone(), '#cc88ff', 22);
                    }
                }

                if (squid.isDestroyed) {
                    game.particleSystem.emit(squid.getPosition().clone(), 0xeeffff, 25, 5.0, 1.2, 1.4);
                    game.particleSystem.emit(squid.getPosition().clone(), 0x440088, 20, 4.0, 1.4, 1.6);
                    game.waterfallSystem.triggerSplash(squid.getPosition().clone(), 35);
                    game.audioSystem.playWhaleSong();
                }
                break;
            }
        }
    }
}

/** Moon gate camera pull → victory approach. */
export function updateMoonGateSequence(delta: number): void {
    game.planetaryHorizonSystem.updateMoonGate(delta);

    if (game.moonGateSequenceActive) {
        game.moonGateSequenceTimer += delta;
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, camera.position.z - 0.5, Math.min(1, delta * 0.5));
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, camera.position.y + 0.3, Math.min(1, delta * 0.5));
        if (game.moonGateSequenceTimer > 3.0 && player && game.victorySystem.getState() === VictoryState.NONE) {
            game.moonGateSequenceActive = false;
            game.victorySystem.startApproach(game.moon.position);
        }
    }
}

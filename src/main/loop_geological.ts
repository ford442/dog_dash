import * as THREE from 'three';
import { scene, camera, mainLight, renderer, touchControls } from '../scene_context';
import { player } from '../player_loader';
import { playerState, isGamePaused } from '../game_config';
import { game } from '../game_runtime';
import { keys, updateHealthDisplay } from '../ui_controls';
import { PowerUpType } from '../powerup_manager';
import { MagicalEffectType } from '../magical_effects';
import { DogAnimationState } from '../dog_cockpit';
import { ShakeType } from '../juice_effects';
import { VictoryState } from '../victory_system';
import { getLevelSpan } from '../depth_layers';
import { shouldSpawnStarlightKoi } from '../starlight_koi';
import { shouldSpawnBubbleCoral, getBubbleCoralPlacement, resolveBubbleCoralClusterCount } from '../bubble_coral';
import { animateFoliage, updateSolarSail } from '../foliage';
import { moonPlants } from '../visuals';
import {
    sporeClouds, jellyMosses, solarSails, geodes, voidRootBalls, vacuumKelps,
    iceNeedleClusters, magmaHearts, gravityAnchors, liquidMetalBlobs, cleanupGeologicalObjects
} from '../environment';
import {
    damageGeode, updateGeode, updateNebulaJellyMoss, destroyNebulaJellyMoss,
    updateVoidRootBall, updateVacuumKelp, updateIceNeedleCluster, updateMagmaHeart,
    updateGravityAnchor, GA_SLING_BONUS
} from '../geological';
import type { VoidRootBallUpdateContext } from '../void_root_ball';
import { isVoidRootTethered } from '../void_root_ball';
import { CONFIG } from '../game_config';
export function updateLoopGeological(delta: number, time: number): void {
        // --- NEW: Update Geological Objects ---
        if (game.debugSystem.isEnabled('geologicalObjects')) {
            game.geologicalUpdateFrame++;
            const farUpdateFrame = game.geologicalUpdateFrame % 3 === 0;
            // Update spore clouds (brownian motion)
            sporeClouds.forEach(cloud => {
                const isFar = camera.position.distanceTo(cloud.position) > 80;
                if (!isFar || farUpdateFrame) {
                    cloud.update(delta);
                }
            });
    
    
    
            // Update geodes and check for projectile hits & safe harbor
            playerState.inSafeHarbor = false;
    
            geodes.forEach(geode => {
                updateGeode(geode, delta, time);
    
                // Check safe harbor distance
                if (player && !geode.userData.isDischarged && geode.userData.fieldRadius) {
                    const distToPlayer = player.position.distanceTo(geode.position);
                    if (distToPlayer < geode.userData.fieldRadius) {
                        playerState.inSafeHarbor = true;
                    }
                }
    
                // Check projectile hits
                if (!geode.userData.isDischarged) {
                    const projectiles = game.weaponSystem.getActiveProjectiles();
                    for (const proj of projectiles) {
                        if (!proj.active) continue;
    
                        const distToProj = proj.mesh.position.distanceTo(geode.position);
                        // Hit the core
                        if (distToProj < (geode.userData.fieldRadius * 0.4)) {
                            // Deactivate projectile
                            proj.deactivate();
    
                            // Spawn sparks
                            game.particleSystem.emit(proj.mesh.position.clone(), 0x8844ff, 10, 3.0, 0.5, 0.8);
    
                            // Apply damage
                            const justDepleted = damageGeode(geode, 20); // 5 hits to deplete
                            if (justDepleted) {
                                game.audioSystem.playCollect(); // Or a breaking sound
                                // Craft materials from geode shatter (Void Gems)
                                const geodeTag = (geode.userData.speciesId as string) || 'fracturedGeode';
                                game.resourceHarvester.harvest(geodeTag, 'destroy', geode.position.clone());
                                // Release gems (Void Gems) based on quality
                                const gemCount = Math.floor(3 + Math.random() * 3 * geode.userData.quality);
                                for (let i = 0; i < gemCount; i++) {
                                    // Add small offset
                                    const offset = new THREE.Vector3(
                                        (Math.random() - 0.5) * 2,
                                        (Math.random() - 0.5) * 2,
                                        (Math.random() - 0.5) * 2
                                    );
                                    const orbPos = geode.position.clone().add(offset);
                                    // Spawn a valuable floating orb
                                    game.orbManager.spawnRandomOrb(orbPos.x, orbPos.y, orbPos.z);
                                }
                            }
                            break; // Only hit once per frame per projectile
                        }
                    }
                }
            });
    
            // Update nebula jelly-moss (pulsing and drifting)
            // Use reverse loop so we can remove items safely
            for (let i = jellyMosses.length - 1; i >= 0; i--) {
                const jellyMoss = jellyMosses[i];
                const isFar = camera.position.distanceTo(jellyMoss.position) > 80;
                if (!isFar || farUpdateFrame) {
                    updateNebulaJellyMoss(jellyMoss, delta, time);
                }

                // Projectile hits — precision core shot can destroy for Pure Extract
                if (jellyMoss.visible && jellyMoss.userData.radius) {
                    const projectiles = game.weaponSystem.getActiveProjectiles();
                    const hitRadius = jellyMoss.userData.radius * 0.55;
                    for (const proj of projectiles) {
                        if (!proj.active) continue;
                        if (proj.mesh.position.distanceTo(jellyMoss.position) < hitRadius) {
                            proj.deactivate();
                            game.particleSystem.emit(proj.mesh.position.clone(), 0x00ff88, 8, 4.0, 0.4, 0.6);
                            jellyMoss.userData.health = (jellyMoss.userData.health || 10) - 5;
                            jellyMoss.userData.hitCount = (jellyMoss.userData.hitCount || 0) + 1;
                            if (jellyMoss.userData.health <= 0) {
                                const precision = jellyMoss.userData.hitCount <= 2;
                                const pos = jellyMoss.position.clone();
                                destroyNebulaJellyMoss(jellyMoss, scene, game.particleSystem);
                                jellyMosses.splice(i, 1);
                                game.resourceHarvester.harvest(
                                    'nebulaJellyMoss',
                                    'destroy',
                                    pos,
                                    { precision }
                                );
                                game.audioSystem.playCollect();
                                break;
                            }
                        }
                    }
                    if (!jellyMosses[i] || jellyMosses[i] !== jellyMoss) {
                        continue; // destroyed this frame
                    }
                }

                // --- NEW: Jelly Moss Interaction (Stealth, Shield & Overload) ---
                if (player && jellyMoss.visible && jellyMoss.userData.radius) {
                    const dist = player.position.distanceTo(jellyMoss.position);
                    const radius = jellyMoss.userData.radius;

                    // Player inside membrane?
                    if (dist < radius) {
                        // 1. Viscosity
                        playerState.velocity.multiplyScalar(Math.pow(0.05, delta));

                        // 2. Stealth Effect
                        if (!jellyMoss.userData.isHiding) {
                            jellyMoss.userData.isHiding = true;
                            const rocket = player.children[0];
                            if (rocket) {
                                 rocket.traverse((child: any) => {
                                     if (child.isMesh && child.material) {
                                         if (child.userData.originalOpacity === undefined) {
                                             child.userData.originalOpacity = child.material.opacity;
                                             child.userData.originalTransparent = child.material.transparent;
                                         }
                                         child.material.transparent = true;
                                         child.material.opacity = 0.4;
                                     }
                                 });
                            }
                        }

                        // 3. Shield Leech & Overload
                        const normDist = dist / radius;
                        const leechIntensity = THREE.MathUtils.lerp(1.0, 0.0, normDist);

                        // Build Overload! (Destruction Mechanic)
                        // Rate: 0.5 per second (takes ~2 seconds to explode)
                        jellyMoss.userData.overloadValue = (jellyMoss.userData.overloadValue || 0) + delta * 0.5;

                        // Update Shader Uniform
                        const mat = jellyMoss.material as any;
                        if (mat.userData && mat.userData.uOverload) {
                            mat.userData.uOverload.value = Math.min(1.0, jellyMoss.userData.overloadValue);
                        }

                        // Check for Explosion
                        if (jellyMoss.userData.overloadValue >= 1.0) {
                            // BOOM — sustained overload yields Tainted Extract
                            const pos = jellyMoss.position.clone();
                            destroyNebulaJellyMoss(jellyMoss, scene, game.particleSystem);

                            // Remove from list
                            jellyMosses.splice(i, 1);

                            game.resourceHarvester.harvest(
                                'nebulaJellyMoss',
                                'destroy',
                                pos,
                                { precision: false }
                            );
    
                            // Restore player state immediately (exit stealth)
                            const rocket = player.children[0];
                            if (rocket) {
                                 rocket.traverse((child: any) => {
                                     if (child.isMesh && child.material) {
                                         if (child.userData.originalOpacity !== undefined) {
                                             child.material.opacity = child.userData.originalOpacity;
                                             child.material.transparent = child.userData.originalTransparent;
                                         } else {
                                             child.material.opacity = 1.0;
                                             child.material.transparent = false;
                                         }
                                     }
                                 });
                            }
                            continue; // Skip next logic
                        }
    
                        // Visual damage effect (red tint pulse)
                        if (Math.random() < 0.05 * leechIntensity) {
                            const rocket = player.children[0];
                            if (rocket) {
                                rocket.traverse((child: any) => {
                                    if (child.isMesh && child.material) {
                                        const childMat = child.material as any;
                                        if (childMat.emissive) {
                                            const oldEmissive = childMat.emissive.getHex();
                                            childMat.emissive.setHex(0xff0000);
                                            setTimeout(() => {
                                                if(childMat) childMat.emissive.setHex(oldEmissive);
                                            }, 100);
                                        }
                                    }
                                });
                            }
                        }
    
                    } else {
                        // Exit Stealth / Decay Overload
                        if (jellyMoss.userData.isHiding) {
                            jellyMoss.userData.isHiding = false;
                            const rocket = player.children[0];
                            if (rocket) {
                                 rocket.traverse((child: any) => {
                                     if (child.isMesh && child.material) {
                                         if (child.userData.originalOpacity !== undefined) {
                                             child.material.opacity = child.userData.originalOpacity;
                                             child.material.transparent = child.userData.originalTransparent;
                                         } else {
                                             child.material.opacity = 1.0;
                                             child.material.transparent = false;
                                         }
                                     }
                                 });
                            }
                        }
    
                        // Decay overload if player leaves
                        if (jellyMoss.userData.overloadValue > 0) {
                            jellyMoss.userData.overloadValue = Math.max(0, jellyMoss.userData.overloadValue - delta * 0.5);
                            const mat = jellyMoss.material as any;
                            if (mat.userData && mat.userData.uOverload) {
                                mat.userData.uOverload.value = jellyMoss.userData.overloadValue;
                            }
                        }
                    }
                }
            }
    
            // Update solar sails (iridescent rippling, unfold near player)
            if (player) {
                const activePlayer = player;
                solarSails.forEach(solarSail => updateSolarSail(solarSail, delta, time, activePlayer.position));
    
                // Update void root balls (harpoon AI, tether, crystal flowers)
                const playerStealthed = jellyMosses.some(
                    (m) => m.userData.isHiding && m.visible
                );
                const voidRootCtx: VoidRootBallUpdateContext = {
                    scene,
                    projectiles: game.weaponSystem.getActiveProjectiles(),
                    sporeClouds,
                    playerStealthed
                };
                voidRootBalls.forEach(rootBall => {
                    const interaction = updateVoidRootBall(rootBall, delta, time, activePlayer, voidRootCtx);
                    if (interaction.isTethered) {
                        playerState.vineTetherActive = true;
                        playerState.currentSpeedY += interaction.force.y;
                        playerState.currentSpeedY = THREE.MathUtils.clamp(
                            playerState.currentSpeedY,
                            -CONFIG.player.maxDescentSpeed,
                            CONFIG.player.maxSpeedY
                        );
                        activePlayer.position.z += interaction.force.z;
                        activePlayer.position.y += interaction.force.y * 0.35;
                        if (interaction.hitPoint && Math.random() < 0.25) {
                            game.particleSystem.emit(interaction.hitPoint, 0xcc44ff, 2, 2.0, 0.5);
                        }
                    }
                    if (interaction.impactDamage > 0 && !playerState.invincible) {
                        playerState.health = Math.max(0, playerState.health - 1);
                        playerState.vineBleedTimer = 10;
                        playerState.vineBleedDps = interaction.bleedDamagePerSec;
                        playerState.invincible = true;
                        setTimeout(() => { playerState.invincible = false; }, 1200);
                        game.hudManager.updateHealth(playerState.health, playerState.maxHealth);
                        game.juiceManager.shakeScreen(ShakeType.MEDIUM, 0.5);
                        updateHealthDisplay(playerState);
                    }
                });
                if (!voidRootBalls.some(isVoidRootTethered)) {
                    playerState.vineTetherActive = false;
                }

                // Vine bleed damage over time after failed sever
                if (playerState.vineBleedTimer > 0) {
                    playerState.vineBleedTimer = Math.max(0, playerState.vineBleedTimer - delta);
                    if (!playerState.invincible && playerState.vineBleedDps > 0) {
                        const bleedTick = playerState.vineBleedDps * delta;
                        if (Math.random() < bleedTick * 0.15) {
                            playerState.health = Math.max(0, playerState.health - 1);
                            game.hudManager.updateHealth(playerState.health, playerState.maxHealth);
                            updateHealthDisplay(playerState);
                        }
                    }
                }
            }
            vacuumKelps.forEach(kelp => updateVacuumKelp(kelp, delta, time));
            iceNeedleClusters.forEach(cluster => updateIceNeedleCluster(cluster, delta, time));
    
            // Update Liquid Metal System (Physics & Collisions)
            game.liquidMetalSystem.update(delta);
            if (player && game.weaponSystem) {
                game.liquidMetalSystem.checkCollisions(game.weaponSystem.getActiveProjectiles());
            }
    
            magmaHearts.forEach(heart => updateMagmaHeart(heart, delta, time));
    
            // Update Gravity Anchors — apply inverse-square field forces to player Y velocity
            let nearestGravDist = Infinity;
            let nearestGravAngularSpeed = 0;
            let anyInfluencing = false;
    
            if (player) gravityAnchors.forEach(anchor => {
                if (!anchor) return;
                const interaction = updateGravityAnchor(anchor, delta, time, player.position);
                if (interaction.isInfluencing) {
                    anyInfluencing = true;
    
                    // Track the closest anchor for audio hum
                    if (interaction.distance < nearestGravDist) {
                        nearestGravDist = interaction.distance;
                        nearestGravAngularSpeed = interaction.angularSpeed;
                    }
    
                    // Apply Y component of radial force to vertical speed
                    playerState.currentSpeedY += interaction.force.y;
                    // Clamp to keep the flight model intact
                    playerState.currentSpeedY = THREE.MathUtils.clamp(
                        playerState.currentSpeedY,
                        -CONFIG.player.maxDescentSpeed,
                        CONFIG.player.maxSpeedY
                    );
                    // Sling exit bonus: give a burst of upward velocity on clean tangent arcs
                    if (interaction.slungExit) {
                        playerState.currentSpeedY = Math.max(
                            playerState.currentSpeedY + GA_SLING_BONUS,
                            CONFIG.player.maxSpeedY
                        );
                        game.particleSystem.emit(player.position.clone(), 0x44aaff, 12, 3.0, 0.6);
    
                        // Record a perfect gravity-arc sling in the combo chain
                        const gaSlipstreamBonus = game.slingableObjectSystem.isInSlipstream(player.position) ? 2 : 1;
                        game.slingComboManager.recordSlingAction('perfect', player.position.clone(), gaSlipstreamBonus);
                        game.slingObjectiveManager.recordSling('perfect');
                        game.reportComboObjectiveProgress();
                        game.friendsManager.cheerFlotilla(player.position.clone());
    
                        // Sling release doppler whoosh
                        game.audioSystem.playGravitySlingRelease('perfect', game.slingComboManager.getCombo());
    
                        // Tarsiers near this anchor cheer the clean sling-arc!
                        if (game.debugSystem.isEnabled('spaceFriends')) {
                            game.friendsManager.cheerTarsiersNearAnchor(anchor.position);
                            game.dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.8);
                        }
                    }
                    // Inflow particles — emit from random field-edge position toward core
                    if (Math.random() < 0.08) {
                        const inflowColor: number = (anchor.userData.inflowColor as number) ?? 0x4466ff;
                        const fieldR = (anchor.userData.fieldRadius as number) ?? 40;
                        // Random point on the field sphere surface
                        const theta = Math.random() * Math.PI * 2;
                        const phi   = Math.acos(2 * Math.random() - 1);
                        const spawnPos = new THREE.Vector3(
                            anchor.position.x + fieldR * 0.7 * Math.sin(phi) * Math.cos(theta),
                            anchor.position.y + fieldR * 0.7 * Math.sin(phi) * Math.sin(theta),
                            anchor.position.z + fieldR * 0.3 * Math.cos(phi)
                        );
                        // Velocity directed inward (toward anchor)
                        const inwardDir = new THREE.Vector3()
                            .subVectors(anchor.position, spawnPos)
                            .normalize()
                            .multiplyScalar(2.5 + Math.random() * 1.5);
                        game.particleSystem.emit(spawnPos, inflowColor, 1, inwardDir.length(), 0.35);
                    }
    
                    // Dog becomes curious when first entering a gravity anchor's field
                    if (!anchor.userData.dogCuriousTriggered) {
                        anchor.userData.dogCuriousTriggered = true;
                        if (game.dogController.getCurrentState() === DogAnimationState.IDLE ||
                            game.dogController.getCurrentState() === DogAnimationState.THRUST) {
                            game.dogController.triggerAnimation(DogAnimationState.CURIOUS, 1.5);
                        }
                    }
                } else {
                    // Reset curious flag when player exits the field
                    anchor.userData.dogCuriousTriggered = false;
                }
            });
    
            // Gravity hum audio — start/update/stop based on field presence
            if (anyInfluencing) {
                game.audioSystem.startGravityHum();
                game.audioSystem.updateGravityHum(nearestGravDist, nearestGravAngularSpeed);
            } else {
                game.audioSystem.stopGravityHum();
            }
        }
}

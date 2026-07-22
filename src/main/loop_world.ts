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
import { updateCandyMaterialGlobals } from '../candy_materials';
import { animateFoliage, updateSolarSail } from '../foliage';
import { moonPlants } from '../visuals';
import {
    sporeClouds, jellyMosses, solarSails, geodes, voidRootBalls, vacuumKelps,
    iceNeedleClusters, magmaHearts, gravityAnchors, liquidMetalBlobs, cleanupGeologicalObjects
} from '../environment';
import { updateCamera } from './camera_system';
import { updateShadowQuality, updateShadowCulling } from './render_helpers';
import { updateGravLensSystems } from './grav_lens_update';
import { updateArtifacts } from './artifact_update';
import { gravLensManager, derelictBuoyManager, dataMonolithManager } from '../game_systems';
export function updateLoopWorld(delta: number, time: number): void {
        // "Path to the Moon" gate animates independently of the planet horizon
        game.planetaryHorizonSystem.updateMoonGate(delta);
    
        // Once the Moon Gate has opened, gently pull the camera back for a
        // celebratory view before handing off to the victory approach sequence.
        if (game.moonGateSequenceActive) {
            game.moonGateSequenceTimer += delta;
            camera.position.z = THREE.MathUtils.lerp(camera.position.z, camera.position.z - 0.5, Math.min(1, delta * 0.5));
            camera.position.y = THREE.MathUtils.lerp(camera.position.y, camera.position.y + 0.3, Math.min(1, delta * 0.5));
            if (game.moonGateSequenceTimer > 3.0 && player && game.victorySystem.getState() === VictoryState.NONE) {
                game.moonGateSequenceActive = false;
                game.victorySystem.startApproach(game.moon.position);
            }
        }
        
        // Update HUD system
        game.hudManager.update(delta);
    
        // --- NEW: Update Particles (engine trails & explosions)
        if (game.debugSystem.isEnabled('particles')) {
            game.particleSystem.update(delta);
        }
        if (game.debugSystem.isEnabled('debris')) {
            game.debrisSystem.update(delta);
        }
    
        // Update Weapon System
        if (player) {
            game.weaponSystem.update(delta, camera.position.x);
            game.weaponLightManager.update(game.weaponSystem.getActiveProjectiles());
            updateCandyMaterialGlobals({ weaponLights: game.weaponLightManager.storageNode });
        }

        // Update Re-Entry System
        if (player && game.debugSystem.isEnabled('reEntry')) {
            game.reEntrySystem.update(delta, camera.position.x, camera.position.y, player);
        }
    
        // BLACK HOLE SYSTEM (Level 2 environmental hazard)
        if (player && game.blackHoleSystem.active) {
            // Update is now handled inside game.levelManager.update
    
            // Gentle player gravity pull (very light bias on desired velocity)
            const yPull = game.blackHoleSystem.getPlayerPullForce(player.position);
            if (yPull !== 0 && (playerState as any).desiredVelocityY !== undefined) {
                (playerState as any).desiredVelocityY += yPull;
            } else if (yPull !== 0 && !(playerState as any).inSafeHarbor && !(playerState as any).invincible) {
                // Apply yPull directly to targetY to gently drift the player if not using custom movement system
                playerState.targetY += yPull;
            }
    
            // Projectile accretion-disk feedback (capped internally)
            const projectiles = game.weaponSystem.getActiveProjectiles();
            if (projectiles.length > 0) {
                game.blackHoleSystem.handleProjectileInteractions(projectiles, game.particleSystem, () => {
                    if (game.juiceManager) game.juiceManager.shakeScreen(ShakeType.LIGHT, 0.6); // 0.5 is ShakeType.LIGHT
                });
            }
        }

        // Grav-lens slingshot corridors (levels 2–3)
        if (player) {
            updateGravLensSystems(delta);
        }

        // Artifacts — Derelict Buoys + Data Monoliths (levels 4–5)
        if (player) {
            updateArtifacts(delta);
        }
    
        // Update Level Manager (and Clouds)
        if (player) {
            const isFiringProxy = game.weaponSystem.getActiveProjectiles().length > 0;
            game.levelManager.update(delta, camera.position.x, playerState.autoScrollSpeed, isFiringProxy, new THREE.Vector3(1, 0, 0));
            const geoScannables = [
                ...sporeClouds.map(cloud => cloud.spores),
                ...vacuumKelps,
                ...voidRootBalls,
                ...magmaHearts,
                ...iceNeedleClusters,
                ...gravityAnchors,
                ...liquidMetalBlobs,
                ...gravLensManager.getScannables(),
                ...derelictBuoyManager.getScannables(),
                ...dataMonolithManager.getScannables(),
            ];
            game.discoveryManager.update(player.position, [
                ...game.levelManager.levelObjects,
                ...geoScannables,
                ...game.friendsManager.getScannables(),
                ...game.creatureManager.getScannables(),
                ...game.slingableObjectSystem.getScannables()
            ]);
            if (game.debugSystem.isEnabled('butterflySwarm')) {
                const nowSec = performance.now() * 0.001;
                game.butterflySwarmSystem.update(delta, camera.position.x, player.position, {
                    grazeCombo: game.obstacleSystem.getGrazeCombo(),
                    slingCombo: game.slingComboManager.getCombo(),
                    cleanFlightTime: nowSec - game.lastPlayerDamageTime
                });
            }
            game.videoTumblingStars.forEach(star => star.update(delta, camera));
        }
    
        // Phase 1 FPS Fixes - Quick Wins: shadow & object cleanup
        updateShadowQuality();
        try {
            updateShadowCulling();
        } catch (error) {
            if (!game.shadowCullingWarningIssued) {
                game.shadowCullingWarningIssued = true;
                console.warn('Shadow culling skipped because a tracked object was malformed.', error);
            }
        }
        cleanupGeologicalObjects(camera.position.x);
    
        // Keep directional light following player so shadows work throughout the level
        if (player) {
            mainLight.position.x = player.position.x - 5;
            mainLight.target.position.set(player.position.x, 0, 0);
            mainLight.target.updateMatrixWorld();
        }
    
        updateCamera(delta);
        // Update industrial obstacles (Level 4)
        if (game.debugSystem.isEnabled('industrialGeo')) {
            game.industrialGeometryManager.update(time);
        }
    
        // SWARM #3: Update Dreamy Environments
        if (player) {
            // Update flower constellations (bloom, pollen, sparkles)
            if (game.debugSystem.isEnabled('flowerConstellations')) {
                game.flowerManager.update(delta, player.position);
                game.flowerManager.checkPlayerProximity(player.position);
            }
    
            // Twirling pinwheel flowers — spin, wind gusts, blade clips
            if (game.debugSystem.isEnabled('pinwheelFlora')) {
                const pinwheelHits = game.pinwheelManager.update(delta, time, player.position);
                for (const hit of pinwheelHits) {
                    playerState.velocity.add(hit.force);
                    if (hit.type === 'hub_collect' && hit.scoreBonus) {
                        game.hudManager.addScore(hit.scoreBonus);
                        game.juiceManager.showFloatingText(`+${hit.scoreBonus}`, hit.position.clone(), '#ff69b4', 20);
                        game.audioSystem.play('twinkle', 0.65);
                    } else if (hit.type === 'blade_clip') {
                        game.juiceManager.showFloatingText('Whoosh!', hit.position.clone(), '#ffd9ec', 16);
                        game.audioSystem.play('sparkle', 0.35);
                    }
                }
                game.pinwheelManager.cleanupFarBehind(player.position.x);
            }
    
            // Solar sail ferns — tilt, boost zones, soft clips
            if (game.debugSystem.isEnabled('solarSailFerns')) {
                const sailHits = game.solarSailFernManager.update(
                    delta,
                    time,
                    player.position,
                    playerState.velocity
                );
                for (const hit of sailHits) {
                    playerState.velocity.add(hit.force);
                    if (hit.type === 'boost') {
                        game.juiceManager.showFloatingText('Solar wind!', hit.position.clone(), '#88eeff', 16);
                        game.audioSystem.play('sparkle', 0.4);
                    } else if (hit.type === 'clip') {
                        game.juiceManager.showFloatingText('Rustle', hit.position.clone(), '#ffddaa', 14);
                        game.audioSystem.play('sparkle', 0.2);
                    }
                }
                game.solarSailFernManager.cleanupFarBehind(player.position.x);
            }
    
            // Crystal chime clusters — proximity rings, sparkles, micro stars
            if (game.debugSystem.isEnabled('crystalChimes')) {
                const chimeHits = game.crystalChimeManager.update(
                    delta,
                    time,
                    player.position,
                    playerState.velocity
                );
                for (const hit of chimeHits) {
                    if (hit.type === 'soft_push' && hit.force) {
                        playerState.velocity.add(hit.force);
                    } else if (hit.type === 'star_bonus' && hit.scoreBonus) {
                        game.hudManager.addScore(hit.scoreBonus);
                        game.juiceManager.showFloatingText(`+${hit.scoreBonus}`, hit.position.clone(), '#aaddff', 18);
                        game.audioSystem.play('twinkle', 0.5);
                    }
                }
                game.crystalChimeManager.cleanupFarBehind(player.position.x);
            }
    
            // Crystal wind-chime mobiles — slow spin, tinkle + sparkles when flown near
            if (game.debugSystem.isEnabled('windChimes')) {
                game.windChimeManager.update(delta, time, player.position, playerState.velocity);
                game.windChimeManager.cleanupFarBehind(player.position.x);
            }
            
            // Update candy belt (wobble, dissolve, shatter)
            if (game.debugSystem.isEnabled('candyBelt')) {
                game.candyManager.update(delta);
                
                // Check candy collisions (bouncy gummies!)
                const candyCollisions = game.candyManager.checkCollisions(player.position, 2.0);
                candyCollisions.forEach(collision => {
                    if (collision.type === 'bouncy') {
                        // Bouncy gummies make the dog giggle!
                        game.dogController.triggerAnimation(DogAnimationState.POWER_UP, 0.5);
                        game.juiceManager.showFloatingText("Boing!", collision.candy.position, '#ff69b4');
                        game.audioSystem.playMagicSound('happy');
                    } else if (collision.type === 'collectible') {
                        // Cotton candy dissolves into sugar sparkles
                        game.juiceManager.spawnSparkles(player.position, new THREE.Color(0xffb6c1), 10);
                        game.audioSystem.playMagicSound('collect');
                    }
                });
            }
            
            // Update cloud castles (parallax scrolling)
            if (game.debugSystem.isEnabled('cloudCastles')) {
                game.castleManager.update(delta, player.position.x);
            }

            // Update Moon Palace
            if (game.moonPalaceSystem) {
                game.moonPalaceSystem.update(delta, camera.position.x, player.position);
            }
        }
    
        // Rotate galaxies slowly
        if (game.debugSystem.isEnabled('moonEffects')) {
            if (game.galaxy1) game.galaxy1.rotation.z += game.galaxy1.userData.rotationSpeed;
            if (game.galaxy2) game.galaxy2.rotation.z += game.galaxy2.userData.rotationSpeed;
            if (game.galaxy3) game.galaxy3.rotation.z += game.galaxy3.userData.rotationSpeed;
            
            // Rotate and pulse game.moon atmosphere
            if (game.moon && game.moon.userData.atmosphere) {
                game.moon.rotation.y += 0.002;
                const pulse = Math.sin(Date.now() * 0.001) * 0.5 + 0.5;
                (game.moon.userData.atmosphere.material as THREE.MeshBasicMaterial).opacity = 0.1 + pulse * 0.1;
            }
    
            // --- NEW: Animate Alien Moon Plants ---
            // We pass 'false' for isDay because it's space (always night!) and null for audio
            moonPlants.forEach(plant => {
                animateFoliage(plant, time, null, false);
            });
        }
    
        // --- NEW: Pilot/Player Animations ---
        if (game.debugSystem.isEnabled('pilotAnim')) {
            try {
                const rocketRoot = player.children[0];
                if (rocketRoot) {
                    // Pitch and roll are now driven by updatePlayer's upgraded flight model.
    
                    // Animate pilot bob and ears
                    const pilot = rocketRoot.getObjectByName('pilotGroup');
                    if (pilot) {
                        const offset = pilot.userData.animationOffset || 0;
                        const baseY = pilot.userData.baseY ?? pilot.position.y;
                        const bobAmp = keys.jump ? 0.05 : 0.02;
                        const bob = Math.sin(time * 2 + offset) * bobAmp;
                        pilot.position.y = baseY + bob;
    
                        const head = pilot.getObjectByName('pilotHead');
                        const leftEar = pilot.getObjectByName('leftEar');
                        const rightEar = pilot.getObjectByName('rightEar');
                        if (head) {
                            head.rotation.y = head.userData.baseRotationY + Math.sin(time * 1.5 + offset) * 0.08;
                        }
                        if (leftEar && rightEar) {
                            leftEar.rotation.z = leftEar.userData.baseRotationZ + Math.sin(time * 6 + offset) * 0.3 * (keys.jump ? 1.5 : 1.0);
                            rightEar.rotation.z = rightEar.userData.baseRotationZ + Math.sin(time * 6 + offset + Math.PI) * 0.3 * (keys.jump ? 1.5 : 1.0);
                        }
                    }
                }
            } catch (e) { /* swallow animation errors gracefully */ }
        }
}

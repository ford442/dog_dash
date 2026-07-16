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
import { FlotillaMember } from '../space_friends';
import { getCandySlingComboBonus, CANDY_FLAVOR_COLORS, updateCandyMaterialGlobals } from '../candy_materials';
import type { CandyAsteroidVariant, CandyFlavor } from '../candy_materials';
import { updateBossHealthBar } from './boss_health_ui';
import { writeBossHitboxesToWasm } from '../physics_utils';
import type { WasmHandle } from '../wasm_loader';
export function updateLoopCombat(_rawDelta: number, delta: number, time: number): boolean {
        // --- BOSS SYSTEM ---
        if (player) {
            // Check for boss spawn
            if (!playerState.bossActive) {
                const bossSpawned = game.bossManager.checkBossSpawn(
                    player.position.x,
                    playerState.level,
                    game.levelManager.config[game.levelManager.currentLevel]?.distance,
                    {
                        onDefeated: () => {
                            // Boss defeated - give rewards and continue
                            playerState.cores += 50;
                            game.saveManager.addCores(50);
                            // Star-Eater memory: a few extra cores for veterans who've cataloged it
                            if (game.saveManager.hasMemory('star_eater')) {
                                playerState.cores += 10;
                                game.saveManager.addCores(10);
                            }
                            game.saveManager.recordBossDefeated();
                            game.audioSystem.play('boss_defeat');
                            playerState.bossActive = false;

                            // Resume auto-scroll
                            playerState.autoScrollSpeed = game.saveManager.applyToSpeed(8);

                            // 'boss' objective (L6): defeating the Star-Eater completes the chapter
                            const objective = game.levelManager.config[game.levelManager.currentLevel]?.objective;
                            if (objective?.type === 'boss') {
                                game.hudManager.updateObjectiveProgress(objective.target, objective.target);
                                game.hudManager.onObjectiveComplete?.();

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
                            // Boss hit player
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
                            // Slow down during boss fight
                            playerState.autoScrollSpeed = 2;
                            game.audioSystem.play('boss_roar');
                            game.audioSystem.updateDroneIntensity(2.0);
                            // Surviving the first roar catalogs the Star-Eater
                            game.creatureCatalogManager.catalog('star_eater');
                        }
                    }
                );
                
                if (bossSpawned) {
                    console.log('👹 Boss fight started!');
                }
            }
            
            // Update boss
            const bossResult = game.bossManager.update(delta);
            if (bossResult.bossActive && player) {
                // Apply pull force from boss
                const playerPos = player.position;
                const boss = bossResult.boss;
                const bossPos = boss?.group.position;
                
                if (boss && bossPos) {
                    // Pull toward boss Y position
                    const pullDir = bossPos.y - playerPos.y;
                    playerState.currentSpeedY += pullDir * bossResult.pullForce * delta * 0.1;
                    
                    // Check mouth snap death
                    if (bossResult.isSnapping) {
                        const distToMouth = Math.abs(playerPos.x - (bossPos.x + 8));
                        if (distToMouth < 3 && Math.abs(playerPos.y - bossPos.y) < 3) {
                            // Inside mouth when it snaps - instant death
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
                    
                    // Check projectile hits on boss (WASM hitboxes)
                    const projectiles = game.weaponSystem.getActiveProjectiles();
                    const hitboxes = boss.collectWasmHitboxes();
                    if (hitboxes.length > 0 && game.wasmExports) {
                        const wasmHandle = {
                            exports: game.wasmExports,
                            memory: game.wasmMemory
                        } as WasmHandle;
                        const count = writeBossHitboxesToWasm(wasmHandle, hitboxes);
                        if (game.wasmMemory?.buffer !== (game.wasmExports as { memory: WebAssembly.Memory }).memory.buffer) {
                            game.wasmMemory = new Float32Array(
                                (game.wasmExports as { memory: WebAssembly.Memory }).memory.buffer
                            );
                        }

                        for (const proj of projectiles) {
                            if (!proj.active) continue;
                            const hitIndex = (game.wasmExports as {
                                checkBossCollision: (x: number, y: number, r: number, n: number) => number;
                            }).checkBossCollision(
                                proj.mesh.position.x,
                                proj.mesh.position.y,
                                0.5,
                                count
                            );
                            if (hitIndex === -1) continue;

                            const entry = boss.resolveHitboxEntry(hitIndex);
                            if (!entry?.dealsDamage) {
                                proj.deactivate();
                                continue;
                            }

                            const damage = entry.target === 'boss' ? 10 : 15;
                            if (boss.takeDamage(damage, entry.target)) {
                                game.audioSystem.play('hit');
                                game.particleSystem.emit(
                                    proj.mesh.position.clone(),
                                    entry.target === 'boss' ? 0xff0044 : 0xff66aa,
                                    12, 4.0, 0.8, 1.2
                                );
                                proj.deactivate();
                            }
                        }
                    }
                }
            }

            // Boss health bar (Star-Eater Pitcher or Kraken)
            updateBossHealthBar(game.obstacleSystem.getSquids(), game.bossManager.getBoss());
            
            // --- PICKUP SYSTEM ---
            const collected = game.pickupManager.update(delta, time, player.position);
            if (collected) {
                game.upgradeSystem.setPlayerGroup(player);
                game.upgradeSystem.activateUpgrade(collected);
            }
            
            // --- UPGRADE SYSTEM ---
            game.upgradeSystem.update(delta, time);
            
            // --- AUDIO SYSTEM ---
            // Engine state is now updated inside updatePlayer with thrust/glide/dive info
            
            // --- HEAT SYSTEM ---
            game.heatSystem.update(delta);
            
            // --- MAGICAL SYSTEMS (from swarm) ---
            // Update game.starfield with speed multiplier
            const speedMultiplier = 1 + Math.abs(playerState.currentSpeedY) / 20;
            game.starfield.update(delta, speedMultiplier);
            
            // Update orb manager and check collection
            game.orbManager.update(delta, time);
            const collectionResult = game.orbManager.checkCollection(player.position, game.friendsManager.hasFullFlotilla() ? 4.0 : 2.0);
            if (collectionResult.collected && player) {
                game.dogController.triggerAnimation(DogAnimationState.COLLECT, 0.5);
                game.juiceManager.burstCollect(player.position.clone());
                game.juiceManager.showScoreText(collectionResult.points || 10, player.position.clone());
                if (collectionResult.healthRestore) {
                    playerState.health = Math.min(playerState.health + collectionResult.healthRestore, playerState.maxHealth);
                    game.hudManager.updateHealth(playerState.health, playerState.maxHealth);
                    updateHealthDisplay(playerState);
                }
                // Collecting any orb gives +1 boost charge
                game.boostSystem.addCharge(1);
            }
            
            // Update power-up manager
            game.powerUpManager.update(delta);
    
            // --- RAINBOW COMET TAIL GAMEPLAY EFFECTS ---
            const hasRainbowComet = game.powerUpManager.hasPowerUp(PowerUpType.RAINBOW_COMET_TAIL);
            const rainbowEffect = game.powerUpManager.activeEffects.get(PowerUpType.RAINBOW_COMET_TAIL);
            const rainbowTimeRemaining = rainbowEffect ? rainbowEffect.timeRemaining : 0;
    
            if (hasRainbowComet && player) {
                // Auto-collect nearby orbs within ~45 units
                const orbCollectibles = game.orbManager.getActiveOrbs();
                for (const orb of orbCollectibles) {
                    if (orb.collected) continue;
                    const dist = player.position.distanceTo(orb.position);
                    if (dist < 45) {
                        // Gently pull orb toward player
                        const pullDir = player.position.clone().sub(orb.position).normalize();
                        orb.position.addScaledVector(pullDir, dist * 0.05);
                        orb.mesh.position.copy(orb.position);
                        if (dist < 2) {
                            // Collect it!
                            orb.collected = true;
                            orb.mesh.visible = false;
                            game.boostSystem.addCharge(1);
                            game.audioSystem.playCollect();
                            game.juiceManager.burstCollect(orb.position.clone());
                            game.hudManager.addScore(Math.floor(orb.points * 1.15));
                        }
                    }
                }
    
                // Transform small asteroids within ~25 units into floating candy
                const obstacles = game.obstacleSystem.getObstacles();
                for (let i = obstacles.length - 1; i >= 0; i--) {
                    const obs = obstacles[i];
                    const radius = obs.userData.radius || 1.0;
                    if (radius < 1.2 && player.position.distanceTo(obs.position) < 25) {
                        // Transform to candy: pastel color + heart particles
                        const pastelColors = [0xffb6c1, 0xffc0cb, 0xe6e6fa, 0xb0e0e6, 0x98fb98];
                        const candyColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];
                        (obs.material as THREE.MeshStandardMaterial).color.setHex(candyColor);
                        (obs.material as THREE.MeshStandardMaterial).emissive.setHex(candyColor);
                        (obs.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
                        obs.userData.isCandy = true;
    
                        // Heart particle burst
                        game.particleSystem.emit(obs.position.clone(), candyColor, 5, 3.0, 0.4, 0.6);
                        game.particleSystem.emit(obs.position.clone(), 0xffffff, 3, 2.0, 0.3, 0.4);
    
                        // Small chance to destroy tiny asteroids entirely
                        if (radius < 0.6 && Math.random() < 0.05) {
                            game.particleSystem.emit(obs.position.clone(), candyColor, 10, 4.0, 0.6, 1.0);
                            game.obstacleSystem.splitAsteroid(obs);
                            game.audioSystem.playMagicSound('happy');
                        }
                    }
                }
    
                // Score multiplier (+15%)
                // Applied via game.hudManager if it supports score multipliers, otherwise accumulate
            }
    
            // Fade-out handling: when rainbow comet is ending (< 1s left), reduce trail intensity
            if (hasRainbowComet && rainbowTimeRemaining < 1.0 && rainbowTimeRemaining > 0) {
                const fadeRatio = rainbowTimeRemaining; // 1.0 → 0
                if (player) {
                    const rocket = player.children[0];
                    if (rocket) {
                        rocket.traverse((child: any) => {
                            if (child.isMesh && child.material && child.material.emissiveIntensity !== undefined) {
                                child.material.emissiveIntensity *= fadeRatio;
                            }
                        });
                    }
                }
            }
    
            // SWARM #3: Update magical effects (rainbow trails, butterflies, etc.)
            if (game.debugSystem.isEnabled('magicalEffects')) {
                game.effectManager.update(delta);
            }
            
            // Pass magic state to Nebula
            const isMagicActive = game.effectManager.hasEffect(MagicalEffectType.RAINBOW_TRAIL) ||
                                  game.effectManager.hasEffect(MagicalEffectType.HEART_BUBBLE);
            game.levelManager.setMagicActive(isMagicActive);
    
            // SWARM #4: Update victory and tutorial systems
            game.victorySystem.update(delta);
            game.tutorialSystem.update(delta);
            
            // Randomly spawn orbs as player progresses
            if (Math.random() < 0.02) {
                const spawnX = player.position.x + 40 + Math.random() * 20;
                const spawnY = (Math.random() - 0.5) * 12;
                game.orbManager.spawnRandomOrb(spawnX, spawnY);
            }
            
            // Update space friends and spawn new ones
            if (game.debugSystem.isEnabled('spaceFriends')) {
                game.friendsManager.update(
                    delta,
                    player.position,
                    game.weaponSystem.getActiveProjectiles(),
                    new THREE.Vector3(playerState.autoScrollSpeed, playerState.currentSpeedY, 0)
                );
                game.friendsManager.maybeSpawnFriends(
                    player.position.x,
                    game.levelManager.config[game.levelManager.currentLevel]
                );
                game.friendsManager.cleanupFarFriends(player.position.x);
            }
    
            // --- Aquatic environments (enabled per level via environments.aquaticLife) ---
            const currentLevelCfg = game.levelManager.config[game.levelManager.currentLevel];
            const isAquaEnv = !!currentLevelCfg?.environments?.aquaticLife;
            if (isAquaEnv) {
                if (game.aquaticLifeSpawnedLevel !== game.levelManager.currentLevel) {
                    aquaticLifeManager.clear();
                    game.aquaticLifeSpawnedLevel = game.levelManager.currentLevel;
                    game.whaleSongTimer = 30;
                    const cfgA = currentLevelCfg;
                    aquaticLifeManager.spawnForLevel(player.position.x + 80, cfgA.distance - 200);
    
                    // Bubble-reef rescue friends feeding the final flotilla parade.
                    const reefFriends = game.friendsManager.spawnTrappedFriendsAlong(
                        player.position.x + 150,
                        cfgA.distance - 400,
                        3
                    );
                    for (const reefFriend of reefFriends) {
                        aquaticLifeManager.spawnBubbleReef(reefFriend.position);
                    }
    
                    // Scatter seal pups through the aqua expanse
                    for (let s = 0; s < 5; s++) {
                        const sx = player.position.x + 100 + Math.random() * (cfgA.distance - 300);
                        const sy = (Math.random() - 0.5) * 16;
                        game.friendsManager.spawnSealPup(sx, sy);
                    }
                }
    
                const aquaEvents = aquaticLifeManager.update(delta, player.position);
                for (const ev of aquaEvents) {
                    if (ev.type === 'jellyfish') {
                        game.hudManager.addScore(15);
                        game.juiceManager.showFloatingText('Jellyfish Drift! +15', ev.position.clone(), '#aaffee', 20);
                        game.particleSystem.emit(ev.position.clone(), 0x66ffee, 10, 2.0, 1.0, 1.0);
                        game.audioSystem.playGraze(1);
                    } else if (ev.type === 'kelp') {
                        game.hudManager.addScore(10);
                        game.juiceManager.showFloatingText('Swimming!', ev.position.clone(), '#88ffaa', 18);
                        game.particleSystem.emit(ev.position.clone(), 0x44cc88, 8, 3.0, 0.8, 0.8);
                    } else if (ev.type === 'plankton') {
                        game.juiceManager.burstMagic(ev.position.clone());
                        game.particleSystem.emit(ev.position.clone(), 0x99ffee, 14, 2.5, 1.2, 0.8);
                    }
                }
                aquaticLifeManager.cleanupFarBehind(player.position.x);
    
                // "Whale song" ambience - a slow procedural moan from the deep
                game.whaleSongTimer -= delta;
                if (game.whaleSongTimer <= 0) {
                    game.whaleSongTimer = 25 + Math.random() * 15;
                    game.audioSystem.playWhaleSong();
                }
            } else if (game.aquaticLifeSpawnedLevel !== null) {
                aquaticLifeManager.clear();
                game.aquaticLifeSpawnedLevel = null;
            }
    
            // --- Starlight koi schools (biological / aquatic / nebula biomes) ---
            const koiCfg = game.levelManager.config[game.levelManager.currentLevel];
            if (shouldSpawnStarlightKoi(koiCfg?.environments, koiCfg?.koiSchoolDensity)) {
                if (game.koiSpawnedLevel !== game.levelManager.currentLevel) {
                    game.koiSpawnedLevel = game.levelManager.currentLevel;
                    starlightKoiManager.activate();
                    const koiSpan = getLevelSpan(game.levelManager.currentLevel);
                    starlightKoiManager.spawnForLevel(
                        koiSpan.startX + 60,
                        koiSpan.length - 120,
                        koiCfg!.koiSchoolDensity!
                    );
                }
                if (game.debugSystem.isEnabled('starlightKoi')) {
                    starlightKoiManager.update(delta, camera.position.x, player.position);
                    starlightKoiManager.cleanupFarBehind(player.position.x);
                }
            } else if (game.koiSpawnedLevel !== null) {
                starlightKoiManager.deactivate();
                game.koiSpawnedLevel = null;
            }
    
            // --- Rainbow bubble coral (waterfall / aquatic / biological reefs) ---
            const coralCfg = game.levelManager.config[game.levelManager.currentLevel];
            if (shouldSpawnBubbleCoral(coralCfg?.environments, coralCfg?.bubbleCoralDensity)) {
                if (game.coralSpawnedLevel !== game.levelManager.currentLevel) {
                    game.coralSpawnedLevel = game.levelManager.currentLevel;
                    bubbleCoralManager.activate();
                    const coralSpan = getLevelSpan(game.levelManager.currentLevel);
                    const clusterCount = resolveBubbleCoralClusterCount(
                        coralCfg!.bubbleCoralDensity!,
                        coralCfg!.environments?.bubbleCoral
                    );
                    bubbleCoralManager.spawnForLevel(
                        coralSpan.startX + 50,
                        coralSpan.length - 100,
                        clusterCount,
                        getBubbleCoralPlacement(coralCfg!.environments, coralCfg!.levelType)
                    );
                }
                if (game.debugSystem.isEnabled('bubbleCoral')) {
                    bubbleCoralManager.update(delta, camera.position.x);
                    bubbleCoralManager.cleanupFarBehind(player.position.x);
                }
            } else if (game.coralSpawnedLevel !== null) {
                bubbleCoralManager.deactivate();
                game.coralSpawnedLevel = null;
            }
    
            // Update dog cockpit animation
            game.dogController.update(delta, playerState);
        }
    
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
    
            // Projectile Collisions
            const projectiles = game.weaponSystem.getActiveProjectiles();
            if (projectiles.length > 0) {
                const obstacles = game.obstacleSystem.getObstacles();
                // Check against obstacles (asteroids)
                for (let i = obstacles.length - 1; i >= 0; i--) {
                    const obs = obstacles[i];
                    const obsRadius = obs.userData.radius || 1.0;
    
                    for (const proj of projectiles) {
                        if (!proj.active) continue;
    
                        const dist = proj.mesh.position.distanceTo(obs.position);
                        if (dist < obsRadius + 0.5) { // Projectile radius approx 0.5
                            // Hit!
    
                            // 1. Visuals
                            if (obs.userData.isCandyAsteroid) {
                                const flavor = obs.userData.candyFlavor as CandyFlavor;
                                const sparkle = CANDY_FLAVOR_COLORS[flavor]?.sparkle ?? 0xffffff;
                                game.particleSystem.emit(obs.position, sparkle, 14, 5.5, 0.9, 1.2);
                                game.obstacleSystem.triggerCandySquash(obs as THREE.Mesh, 1.2);
                            } else {
                                game.particleSystem.emit(obs.position, 0x00ffff, 10, 5.0, 1.0, 2.0); // Cyan splash
                            }
    
                            // 2. Destroy Asteroid
                            game.audioSystem.play('explode');
    
                            // Barnacle pods (L5): cracking one open can reveal a
                            // memory fragment (bonus cores) and/or a tiny whale
                            // lice critter that joins the flotilla.
                            if (obs.userData.type === 'barnacle') {
                                if (obs.userData.hasMemoryFragment) {
                                    game.saveManager.addCores(25);
                                    game.juiceManager.showFloatingText('Memory Fragment! +25', obs.position.clone(), '#aaffee', 24);
                                }
                                if (obs.userData.hasWhaleLice) {
                                    const member = new FlotillaMember(scene, 0x88ffaa, game.friendsManager.flotilla.length);
                                    game.friendsManager.flotilla.push(member);
                                    game.juiceManager.showFloatingText('Whale Lice joined!', obs.position.clone(), '#88ffaa', 22);
                                    game.dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.5);
                                }
                            }
    
                            // Try spawn pickup
                            game.pickupManager.trySpawn(obs.position.clone());
    
                            game.obstacleSystem.splitAsteroid(obs as THREE.Mesh);
    
                            // 3. Destroy Projectile
                            proj.deactivate();
                            break;
                        }
                    }
                }
    
                // --- CHECK BACKGROUND ASTEROIDS ---
                for (const proj of projectiles) {
                    if (!proj.active) continue;
                    // We pass the global camera position to calculate perspective projection
                    const shotDir = new THREE.Vector3(1, 0, 0);
                    if ((proj as any).velocity) {
                        shotDir.copy((proj as any).velocity).normalize();
                    }
                    const hitAsteroid = game.asteroidFieldSystem.hitAsteroid(proj.mesh.position, game.particleSystem, camera.position, shotDir);
                    const hitMeteor = game.meteorShowerSystem.hitMeteor(proj.mesh.position, game.particleSystem, camera.position, shotDir);
                    if (hitAsteroid || hitMeteor) {
                        game.audioSystem.play('explode');
                        // We DO NOT deactivate the projectile here so it doesn't get blocked by background visual elements
                    }
                }
    
                // Check projectiles against Nebula Kraken (boss squids)
                const squids = game.obstacleSystem.getSquids();
                for (const squid of squids) {
                    if (squid.isDestroyed) continue;
    
                    // Cataloging: get close to a living Kraken without destroying it
                    if (player && squid.getPosition().distanceTo(player.position) < squid.getRadius() + 6) {
                        game.creatureCatalogManager.catalog('kraken');
                    }
    
                    for (const proj of projectiles) {
                        if (!proj.active) continue;
                        const dist = proj.mesh.position.distanceTo(squid.getPosition());
                        if (dist < squid.getRadius() + 0.5) {
                            // Hit the boss!
                            game.particleSystem.emit(proj.mesh.position.clone(), 0x9900ff, 15, 6.0, 1.0, 1.5);
                            squid.takeDamage(30);
                            proj.deactivate();
    
                            // Kraken memory: bonus cores the first time this Kraken is defeated
                            if (squid.isDestroyed && game.saveManager.hasMemory('kraken') && !game.krakenMemoryRewarded.has(squid)) {
                                game.krakenMemoryRewarded.add(squid);
                                game.saveManager.addCores(20);
                                if (player) {
                                    game.juiceManager.showFloatingText('Kraken Memory +20', squid.getPosition().clone(), '#cc88ff', 22);
                                }
                            }
    
                            // Kraken defeated — bonus rewards only (L6 capstone is Star-Eater Pitcher)
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
    
                // Tarsiers panic when a projectile passes near a gravity anchor
                if (game.debugSystem.isEnabled('spaceFriends') && gravityAnchors.length > 0) {
                    for (const proj of projectiles) {
                        if (!proj.active) continue;
                        for (const anchor of gravityAnchors) {
                            if (proj.mesh.position.distanceTo(anchor.position) < 22) {
                                game.friendsManager.panicTarsiersNear(anchor.position);
                                game.friendsManager.panicLemursNear(anchor.position);
                                // Dog notices the commotion
                                if (game.dogController.getCurrentState() === DogAnimationState.IDLE) {
                                    game.dogController.triggerAnimation(DogAnimationState.CURIOUS, 1.2);
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }
    return false;
}

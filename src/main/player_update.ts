import * as THREE from 'three';
import { CONFIG, playerState } from '../game_config';
import { game } from '../game_runtime';
import { keys } from '../ui_controls';
import { touchControls } from '../scene_context';
import { player } from '../player_loader';
import { updateHealthDisplay } from '../ui_controls';
import { LEVEL_DISTANCE_BOUNDARIES } from '../level_config';
import { gravityAnchors } from '../environment';
import { showRollPopup, updateBarkDisplay } from './hud_displays';
import { BARK_RADIUS } from '../bark_blast_system';
import { maybePrefetchNextLevel } from '../level_systems_loader';
import { PowerUpType } from '../powerup_manager';
import { DogAnimationState } from '../dog_cockpit';

export function updatePlayer(delta: number) {
    // Don't update if player hasn't loaded yet
    if (!player) return;

    const modifiers = game.powerUpManager.getCombinedModifiers();
    const hasFairyWings = game.powerUpManager.hasPowerUp(PowerUpType.FAIRY_DOG_WINGS);
    
    // Auto-scroll (constant forward movement)
    // Apply wind currents force
    let windForceY = 0;
    let windForceX = 0;
    if (game.levelManager && game.levelManager.windCurrentsSystem) {
        const windForce = game.levelManager.windCurrentsSystem.getWindForce(player.position);
        windForceY = windForce.y;
        windForceX = windForce.x;
    }
    const speedMult = modifiers.speedMultiplier ?? 1.0;
    player.position.x += (playerState.autoScrollSpeed + windForceX) * speedMult * delta;


    // --- UPGRADED: Gravity and Momentum Flight ---
    let targetSpeed = 0;

    let isMovingUp = keys.jump || keys.right;  // Space or Up arrow or D
    let isMovingDown = keys.left;              // A or Left arrow
    
    // Get touch input and update touch controls
    if (touchControls) {
        const touchInput = touchControls.getInput();
        touchControls.update();
        
        // Combine keyboard and touch input
        if (touchInput.vertical > 0.1) isMovingUp = true;
        if (touchInput.vertical < -0.1) isMovingDown = true;
        
        // Handle boost from touch (double-tap or boost button)
        if (touchInput.boost) {
            playerState.autoScrollSpeed = Math.min(
                playerState.autoScrollSpeed * 1.02,
                25  // Max boost speed
            );
            // Play boost sound occasionally to avoid spam
            if (Math.random() < 0.05) {
                game.audioSystem.playBoost();
            }
        }
        
        // Handle fire from touch
        if (touchInput.fire && player && game.weaponSystem) {
            const fireDirection = new THREE.Vector3(1, 0, 0);
            game.weaponSystem.fire(player.position, fireDirection);
        }
    }
    
    if (isMovingUp) {
        targetSpeed = CONFIG.player.maxSpeedY;
        targetSpeed += windForceY * 0.5; // Apply vertical wind (reduced in thrust)
    } else if (isMovingDown) {
        targetSpeed = -CONFIG.player.maxDescentSpeed;
        targetSpeed += windForceY * 0.5; // Apply vertical wind (reduced in dive)
    } else {
        targetSpeed = -CONFIG.player.gravity;
        targetSpeed += windForceY; // Apply vertical wind
        if (playerState.penguinSlideAssistTimer > 0) {
            targetSpeed *= 0.45;
        }
        targetSpeed *= (modifiers.gravityMultiplier ?? 1.0);
    }
    
    const accel = (targetSpeed !== -CONFIG.player.gravity && targetSpeed !== 0)
        ? CONFIG.player.acceleration
        : CONFIG.player.deceleration;

    // Sling Assist: temporary 30% gravity-control boost awarded by Arc Surge (7×+)
    if (playerState.slingAssistTimer > 0) {
        playerState.slingAssistTimer = Math.max(0, playerState.slingAssistTimer - delta);
        playerState.currentSpeedY += (targetSpeed - playerState.currentSpeedY) * accel * 0.3 * delta;
    }

    // Astro Penguin slide assist: lighter gravity + gentle forward nudge
    if (playerState.penguinSlideAssistTimer > 0) {
        playerState.penguinSlideAssistTimer = Math.max(0, playerState.penguinSlideAssistTimer - delta);
        playerState.autoScrollSpeed = Math.min(playerState.autoScrollSpeed + 2.2 * delta, 20);
    }
    
    playerState.currentSpeedY += (targetSpeed - playerState.currentSpeedY) * accel * delta;

    if (hasFairyWings && keys.run) {
        // Float glide handled above via targetSpeed
    } else if (game.powerUpManager.hasPowerUp(PowerUpType.MAGIC_PAINTBRUSH)) {
        playerState.currentSpeedY = game.magicPaintbrushSystem.applyGuideForce(
            player.position,
            playerState.currentSpeedY,
            delta
        );
    }

    player.position.y += playerState.currentSpeedY * delta;
    
    // Soft boundaries - keep player on screen (Y: origin-10 to origin+15).
    // `worldOriginY` is 0 in the main run and DREAM_ROOM_Y inside a bonus room.
    const originY = playerState.worldOriginY;
    if (player.position.y > originY + 15) {
        player.position.y = originY + 15;
        playerState.currentSpeedY = Math.min(0, playerState.currentSpeedY);
    } else if (player.position.y < originY - 10) {
        player.position.y = originY - 10;
        playerState.currentSpeedY = Math.max(0, playerState.currentSpeedY);
    }
    
    // Store for animation
    playerState.velocity.y = playerState.currentSpeedY;

    // --- UPGRADED: Visual Flight Angles (Pitch & Roll) ---
    const rocket = player.children[0];
    if (rocket && !playerState.vineTetherActive) {
        const speedRatio = playerState.currentSpeedY / CONFIG.player.maxDescentSpeed;
        const targetPitch = -Math.sign(speedRatio) * Math.pow(Math.abs(speedRatio), 1.2) * 0.6;
        const targetRoll = playerState.currentSpeedY * 0.015;

        player.rotation.z += (targetPitch - player.rotation.z) * 0.12; // Pitch
        player.rotation.x += (targetRoll - player.rotation.x) * 0.08;  // Roll

        // Gentle hover bob (always present, subtle)
        const hoverY = Math.sin(Date.now() * 0.004) * 0.03;
        rocket.position.y = hoverY;

        // Engine VFX based on thrust vs glide vs dive
        if (rocket.userData.flame) {
            if (isMovingUp) {
                // Thrusting up → bright, large, flickering flame
                const flicker = 0.9 + Math.random() * 0.3;
                rocket.userData.flame.scale.set(flicker * 1.5, flicker * 3.0, flicker * 1.5);
                
                // Emit engine trail
                const exhaustPos = player.position.clone();
                exhaustPos.x -= 0.5;
                exhaustPos.y -= 0.5;
                game.particleSystem.emit(exhaustPos, 0x00ff00, 2, 5.0, 0.8, 0.2); // Green for boost/thrust
            } else if (isMovingDown) {
                // Diving → very small, dim flame + extra downward particle streaks
                const flicker = 0.4 + Math.random() * 0.2;
                rocket.userData.flame.scale.set(flicker, flicker, flicker);
                
                // Extra downward streaks
                const streakPos = player.position.clone();
                streakPos.x -= 0.5;
                streakPos.y -= 0.3;
                game.particleSystem.emit(streakPos, 0xff0000, 1, 3.0, 0.5, 0.3); // Red for dive
            } else {
                // Gliding / idle → smaller, softer flame
                const flicker = 0.5 + Math.random() * 0.2;
                rocket.userData.flame.scale.set(flicker, flicker * 1.5, flicker);

                // Blue trail for glide
                const glidePos = player.position.clone();
                glidePos.x -= 0.5;
                glidePos.y -= 0.1;
                if (Math.random() < 0.3) {
                    game.particleSystem.emit(glidePos, 0x00aaff, 1, 3.0, 0.6, 0.2);
                }
            }
        }
    }

    // --- BOOST SYSTEM ---
    game.boostSystem.update(delta);

    // Check for boost activation
    const canActivateBoost = game.boostSystem.canBoost();
    const isBoosting = game.boostSystem.isBoosting();

    // Keyboard: Shift hold or double-tap Space
    if (hasFairyWings && keys.run) {
        // Float instead of boosting
        targetSpeed = CONFIG.player.gravity * 0.15; // Positive lift
    } else if (canActivateBoost) {
        if (keys.run) {
            game.boostSystem.activate();
        } else if (game.wantsBoost) {
            game.wantsBoost = false;
            game.boostSystem.activate();
        }
    }

    // Touch boost activation (dedicated button or double-tap)
    if (touchControls && canActivateBoost) {
        const touchInput = touchControls.getInput();
        if (touchInput.boost && !game.wasTouchBoosting) {
            game.boostSystem.activate();
        }
        game.wasTouchBoosting = touchInput.boost;
    }

    // Apply boost physics and effects
    if (isBoosting) {
        // Strong upward velocity
        playerState.currentSpeedY = Math.max(playerState.currentSpeedY, 25);
        
        // Temporarily increase horizontal scroll speed
        const baseSpeed = game.saveManager.applyToSpeed(8);
        const boostedSpeed = Math.min(baseSpeed * 1.6, 30);
        playerState.autoScrollSpeed += (boostedSpeed - playerState.autoScrollSpeed) * 0.1;

        // Enhanced flame: much larger, brighter
        if (rocket && rocket.userData.flame) {
            const flicker = 0.9 + Math.random() * 0.4;
            rocket.userData.flame.scale.set(flicker * 2.2, flicker * 5.0, flicker * 2.2);
            (rocket.userData.flame.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.5 + Math.random() * 1.0;
        }

        // Rainbow afterburner trail particles
        const exhaustPos = player.position.clone();
        exhaustPos.x -= 0.8;
        const colors = [0xff8800, 0xffaa00, 0xffdd44, 0xffffff];
        const color = colors[Math.floor(Math.random() * colors.length)];
        game.particleSystem.emit(exhaustPos, color, 2, 6.0 + Math.random() * 2, 0.8, 0.25);

        // Additional downward streak for contrast
        const streakPos = player.position.clone();
        streakPos.x -= 0.6;
        streakPos.y -= 0.2;
        game.particleSystem.emit(streakPos, 0xff4400, 1, 4.0, 0.5, 0.3);
    } else {
        // Restore normal scroll speed when not boosting
        const baseSpeed = game.saveManager.applyToSpeed(8);
        playerState.autoScrollSpeed += (baseSpeed - playerState.autoScrollSpeed) * 0.02;
    }

    // --- ROLL SYSTEM ---
    game.rollSystem.update(delta);

    // Check for roll activation
    const canRoll = game.rollSystem.canRoll();
    const isRolling = game.rollSystem.isRolling();

    if (canRoll) {
        if (game.wantsRoll) {
            game.wantsRoll = false;
            if (game.rollSystem.activate()) {
                playerState.invincible = true;
                showRollPopup();
            }
        }
    }

    // Touch roll activation (downward swipe)
    if (touchControls) {
        const touchInput = touchControls.getInput();
        if (touchInput.roll && !game.wasTouchRolling) {
            if (canRoll) {
                if (game.rollSystem.activate()) {
                    playerState.invincible = true;
                    showRollPopup();
                }
            }
        }
        game.wasTouchRolling = touchInput.roll;
    }

    // Apply roll physics and effects
    if (isRolling) {
        // 360° barrel roll on Z axis
        const rollAngle = game.rollSystem.getRollAngle();
        if (rocket) {
            rocket.rotation.z = -Math.PI / 2 + rollAngle;
        }

        // Slight transparency during roll
        if (rocket) {
            rocket.traverse((child: any) => {
                if (child.isMesh && child.material) {
                    if (child.userData.originalOpacity === undefined) {
                        child.userData.originalOpacity = child.material.opacity;
                        child.userData.originalTransparent = child.material.transparent;
                    }
                    child.material.transparent = true;
                    child.material.opacity = 0.55;
                }
            });
        }

        // Afterimage trail particles
        const ghostPos = player.position.clone();
        ghostPos.x -= 0.3;
        game.particleSystem.emit(ghostPos, 0x00ffff, 1, 3.0, 0.4, 0.2);
        game.particleSystem.emit(ghostPos, 0xffffff, 1, 2.5, 0.3, 0.15);

        // Bright white + cyan burst ring effect
        if (Math.random() < 0.3) {
            const ringPos = player.position.clone();
            ringPos.x -= 0.2;
            game.particleSystem.emit(ringPos, 0x88ffff, 2, 5.0, 0.6, 0.2);
        }

        // Destroy small asteroids on contact
        const obstacles = game.obstacleSystem.getObstacles();
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            const radius = obs.userData.radius || 1.0;
            if (radius < 1.2 && player.position.distanceTo(obs.position) < radius + 1.5) {
                game.obstacleSystem.splitAsteroid(obs);
                game.particleSystem.emit(obs.position.clone(), 0xffaa44, 8, 6.0, 0.8, 1.0);
                game.audioSystem.play('explode', 0.5, 4);
            }
        }
    } else {
        // Restore opacity after roll
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

    // --- BARK BLAST SYSTEM ---
    game.barkBlastSystem.syncCores(playerState.cores);
    game.barkBlastSystem.update(delta);

    const canBark = game.barkBlastSystem.canBark();
    if (canBark) {
        if (game.wantsBark) {
            game.wantsBark = false;
            if (game.barkBlastSystem.activate(player.position)) {
                const result = game.obstacleSystem.applyBarkBlast(player.position, BARK_RADIUS);
                game.particleSystem.emit(player.position.clone(), 0xffcc88, 18, 10.0, 1.0, 1.4);
                game.particleSystem.emit(player.position.clone(), 0xffffff, 12, 8.0, 0.8, 1.2);
                if (result.cleared > 0) {
                    game.audioSystem.play('whoosh', 0.5, 4);
                }
                updateBarkDisplay();
            }
        }
    } else {
        game.wantsBark = false;
    }

    if (touchControls) {
        const touchInput = touchControls.getInput();
        if (touchInput.bark && !game.wasTouchBarking && canBark) {
            if (game.barkBlastSystem.activate(player.position)) {
                const result = game.obstacleSystem.applyBarkBlast(player.position, BARK_RADIUS);
                game.particleSystem.emit(player.position.clone(), 0xffcc88, 18, 10.0, 1.0, 1.4);
                if (result.cleared > 0) {
                    game.audioSystem.play('whoosh', 0.5, 4);
                }
                updateBarkDisplay();
            }
        }
        game.wasTouchBarking = touchInput.bark;
    }

    // Whine warning: off-screen threat approaching
    if (game.barkBlastSystem.canWhine()) {
        const threat = game.obstacleSystem.findOffscreenThreat(player.position.x, player.position.y);
        if (threat) {
            game.barkBlastSystem.markWhine();
            game.dogController.triggerAnimation(DogAnimationState.CURIOUS, 0.8);
            game.dogController.perkEars(0.9);
            game.audioSystem.playDogWhine();
        }
    }

    // --- TETHER SYSTEM ---
    const tetherForce = game.tetherSystem.update(delta, player.position);
    game.slingableObjectSystem.setLatchedTarget(game.tetherSystem.getLatchedTarget());

    // Apply spring force while latched
    if (game.tetherSystem.isLatched()) {
        playerState.currentSpeedY += tetherForce.y;
        playerState.currentSpeedY = THREE.MathUtils.clamp(
            playerState.currentSpeedY,
            -CONFIG.player.maxDescentSpeed * 1.5,
            CONFIG.player.maxSpeedY * 1.5
        );

        // Emit particles along the tether beam
        const anchorPos = game.tetherSystem.getAnchorPosition();
        if (anchorPos && Math.random() < 0.3) {
            const t = Math.random();
            const beamPoint = player.position.clone().lerp(anchorPos, t);
            game.particleSystem.emit(beamPoint, 0x00ffcc, 1, 2.5, 0.4, 0.15);
        }

        // Track full loops around a Tether Sprite for the "Crane Loop" bonus
        const latchedTarget = game.tetherSystem.getLatchedTarget();
        if (anchorPos && latchedTarget?.userData.kind === 'tetherSprite') {
            const angle = Math.atan2(player.position.y - anchorPos.y, player.position.x - anchorPos.x);
            if (game.tetherSpritePrevAngle !== null) {
                let dAngle = angle - game.tetherSpritePrevAngle;
                if (dAngle > Math.PI) dAngle -= Math.PI * 2;
                if (dAngle < -Math.PI) dAngle += Math.PI * 2;
                game.tetherSpriteSweep += dAngle;
            }
            game.tetherSpritePrevAngle = angle;
        } else {
            game.tetherSpriteSweep = 0;
            game.tetherSpritePrevAngle = null;
        }
    }

    // Activate tether: T or right-click pressed
    if (game.wantsTether) {
        game.wantsTether = false;
        if (game.tetherSystem.canTether() && !game.rollSystem.isRolling()) {
            game.tetherSystem.activate(
                [...gravityAnchors, ...game.slingableObjectSystem.getTetherTargets()],
                player.position
            );
        }
    }

    // Release tether: T or right-click released
    if (game.wantsReleaseTether) {
        game.wantsReleaseTether = false;
        if (game.tetherSystem.isLatched()) {
            const latchedTarget = game.tetherSystem.getLatchedTarget();
            const impulse = game.tetherSystem.release(player.position);
            const threwSlingable = latchedTarget
                ? game.slingableObjectSystem.applyTetherImpulse(latchedTarget, impulse)
                : false;

            // Crane Loop bonus: a full 360° swing around a Tether Sprite
            if (latchedTarget?.userData.kind === 'tetherSprite' && Math.abs(game.tetherSpriteSweep) >= Math.PI * 1.85) {
                game.hudManager.addScore(500);
                game.juiceManager.showFloatingText('Crane Loop! +500', player.position.clone(), '#ffaaee', 28);
                game.juiceManager.burstMagic(player.position.clone());
                game.dogController.triggerAnimation(DogAnimationState.VICTORY, 1.5);
                if (playerState.health < playerState.maxHealth) {
                    playerState.health++;
                    game.hudManager.updateHealth(playerState.health, playerState.maxHealth);
                    updateHealthDisplay(playerState);
                    game.juiceManager.showFloatingText('+1 Heart!', player.position.clone().add(new THREE.Vector3(0, 1.5, 0)), '#ff6699', 24);
                }
            }
            game.tetherSpriteSweep = 0;
            game.tetherSpritePrevAngle = null;

            if (threwSlingable) {
                playerState.currentSpeedY = THREE.MathUtils.clamp(
                    playerState.currentSpeedY + impulse.y * 0.35,
                    -CONFIG.player.maxDescentSpeed * 1.5,
                    CONFIG.player.maxSpeedY * 1.75
                );
                playerState.autoScrollSpeed = Math.min(
                    playerState.autoScrollSpeed + Math.abs(impulse.x) * 0.12,
                    30
                );
                game.particleSystem.emit(player.position.clone(), 0x8dffda, 10, 4.5, 0.7, 0.35);
                const tossLabel = latchedTarget?.userData.kind === 'toyRocket' ? 'Wreck Toss!' : 'Comet Toss!';
                game.juiceManager.showFloatingText(tossLabel, player.position.clone(), '#8dffda', 20);
            } else {
                // Apply sling impulse to vertical speed
                playerState.currentSpeedY = THREE.MathUtils.clamp(
                    playerState.currentSpeedY + impulse.y,
                    -CONFIG.player.maxDescentSpeed * 1.5,
                    CONFIG.player.maxSpeedY * 2.0
                );
                // Minor forward speed boost from X component
                const xBoost = Math.abs(impulse.x) * 0.25;
                playerState.autoScrollSpeed = Math.min(
                    playerState.autoScrollSpeed + xBoost,
                    30
                );
                // Burst particles at player position
                game.particleSystem.emit(player.position.clone(), 0x00ffcc, 16, 6.0, 0.9, 0.3);
            }

            game.slingableObjectSystem.setLatchedTarget(null);
            game.dogController.triggerAnimation(DogAnimationState.POWER_UP, 0.6);

            // ── Sling Combo: classify quality by impulse magnitude ──────────
            const impulseMag = impulse.length();
            const slungKind = latchedTarget?.userData.kind as string | undefined;
            const slingQuality = slungKind === 'toyRocket' && impulseMag >= 8
                ? 'perfect'
                : impulseMag >= 26 ? 'perfect' : impulseMag >= 14 ? 'good' : 'messy';
            const slipstreamBonus = game.slingableObjectSystem.isInSlipstream(player.position) ? 2 : 1;
            const toyRocketBonus = slungKind === 'toyRocket' ? 2.2 : 1;
            game.slingComboManager.recordSlingAction(slingQuality, player.position.clone(), slipstreamBonus * toyRocketBonus);
            game.slingObjectiveManager.recordSling(slingQuality);
            game.reportComboObjectiveProgress();
            if (slingQuality === 'perfect') {
                game.friendsManager.cheerFlotilla(player.position.clone());
            }
        }
    }

    // --- AUDIO SYSTEM ---
    game.audioSystem.updateEngineState(playerState.currentSpeedY, isMovingUp, isMovingDown, isBoosting);

    // Level Checking — prefetch next level chunk before boundary crossing.
    // Frozen while a Dream Portal room is open: the main run is paused in place,
    // so neither streaming nor a level transition should fire.
    if (!game.dreamPortalSystem?.isInRoom()) {
        maybePrefetchNextLevel(player.position.x, game.levelManager.currentLevel);
        game.levelManager.checkProgress(player.position.x);
    }

    // "Survive" objectives (e.g. L4 Rusty Gauntlet) don't have a running
    // counter - treat reaching 80% of the level's span as "survived" and
    // open the fast lane for the home stretch.
    {
        const currentCfg = game.levelManager.config[game.levelManager.currentLevel];
        if (currentCfg?.objective?.type === 'survive') {
            const levelStart = LEVEL_DISTANCE_BOUNDARIES[game.levelManager.currentLevel - 1] ?? 0;
            const levelEnd = LEVEL_DISTANCE_BOUNDARIES[game.levelManager.currentLevel] ?? (levelStart + currentCfg.distance);
            const span = levelEnd - levelStart;
            if (span > 0 && player.position.x - levelStart >= span * 0.8) {
                game.hudManager.updateObjectiveProgress(1, 1);
            }
        }
    }

    // Journey map: overall progress from Earth to the Moon across all 6 levels
    const journey = game.levelManager.getJourneyProgress(player.position.x);
    game.hudManager.updateJourneyProgress(journey.percent, journey.level);
}

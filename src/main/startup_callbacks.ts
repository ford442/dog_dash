import * as THREE from 'three';
import { player } from '../player_loader';
import { playerState, CONFIG, setIsGamePaused, isGamePaused } from '../game_config';
import { game } from '../game_runtime';
import { updateHealthDisplay } from '../ui_controls';
import { syncMagicalEffectsFromActive } from '../powerup_manager';
import { DogAnimationState } from '../dog_cockpit';
import { ShakeType } from '../juice_effects';
import { updateBoostDisplay, updateRollDisplay, updateTetherDisplay, showRollPopup } from './hud_displays';
import { getMaterialDisplayName, getMaterialColor } from '../resource_inventory';
import { recordChapterComplete } from '../journey_map';
import { openHubScreen } from './hub_integration';

export function reportComboObjectiveProgress(): void {
    const objective = game.levelManager.config[game.levelManager.currentLevel]?.objective;
    if (objective?.type === 'combo') {
        game.hudManager.updateObjectiveProgress(game.slingComboManager.getCombo(), objective.target);
    }
}

export function wireStartupCallbacks(): void {
    game.reportComboObjectiveProgress = reportComboObjectiveProgress;
    game.rewireSlingableCallbacks = wireSlingableCallbacks;
    if (!game.completedChaptersThisRun) {
        game.completedChaptersThisRun = [];
    }

    game.hudManager.getJourneyLevel = () => game.levelManager?.currentLevel ?? 1;
    game.hudManager.getRescuedFriendCount = () => game.friendsManager?.getRescuedCount?.() ?? 0;
    game.hudManager.getCompletedChapters = () => [...(game.completedChaptersThisRun || [])];
    game.hudManager.openHub = (mode) => openHubScreen(mode);

    game.resourceHarvester.onMaterialCollected = (evt) => {
        const name = getMaterialDisplayName(evt.id);
        const color = getMaterialColor(evt.id);
        game.hudManager.showResourcePop(name, evt.amount, color);
        const pos = evt.position ?? player?.position?.clone();
        if (pos) {
            game.juiceManager.showResourcePop(name, evt.amount, pos, color);
        }
        game.audioSystem.playCollect();
    };

    game.orbManager.onPowerUpReady = () => {
        const triggered = game.powerUpManager.collectOrb();
        if (triggered && player) {
            game.juiceManager.flashRainbow(0.5);
            game.juiceManager.burstMagic(player.position.clone());
            syncMagicalEffectsFromActive({
                effectManager: game.effectManager,
                audioSystem: game.audioSystem,
                dogController: game.dogController,
                juiceManager: game.juiceManager,
                powerUpManager: game.powerUpManager,
                getPlayerPosition: () => player?.position,
                onHudHealthUpdate: () => {
                    game.hudManager.updateHealth(playerState.health, playerState.maxHealth);
                },
            });
        }
    };

    game.orbManager.onScore = (points) => game.hudManager.addScore(points);
    game.orbManager.onHealthRestore = (amount) => {
        playerState.health = Math.min(playerState.health + amount, playerState.maxHealth);
        game.hudManager.updateHealth(playerState.health, playerState.maxHealth);
        updateHealthDisplay(playerState);
        game.audioSystem.playCollect();
    };

    game.powerUpManager.setDogController(game.dogController);

    const originalAddScore = game.hudManager.addScore.bind(game.hudManager);
    game.hudManager.addScore = (points: number) => {
        let scaled = points;
        if (game.powerUpManager.getCombinedModifiers().doubleValue) {
            scaled *= 2;
        }
        const mult = performance.now() < game.scoreMultiplierUntil ? game.scoreMultiplierValue : 1;
        originalAddScore(Math.round(scaled * mult));
    };

    game.discoveryManager.onSpeciesDiscovered = (speciesId, name, totalThisRun, _isNewEver) => {
        if (player) {
            game.juiceManager.showFloatingText(`Scanned: ${name}!`, player.position.clone(), '#00ffcc', 22);
            game.juiceManager.burstMagic(player.position.clone());
            // Scan-event craft material drops (Phase A drop tables)
            game.resourceHarvester.harvest(speciesId, 'scan', player.position.clone());
        }
        game.dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.2);
        game.audioSystem.playMagicSequence('star_collect');
        const objective = game.levelManager.config[game.levelManager.currentLevel]?.objective;
        if (objective?.type === 'scan') {
            game.hudManager.updateObjectiveProgress(totalThisRun, objective.target);
        }
    };

    game.creatureCatalogManager.onCreatureCataloged = (_id, name, isNewEver) => {
        if (player) {
            const label = isNewEver ? `New! Cataloged: ${name}` : `Cataloged: ${name}`;
            game.juiceManager.showFloatingText(label, player.position.clone(), '#aaffee', isNewEver ? 26 : 20);
            if (isNewEver) game.juiceManager.burstMagic(player.position.clone());
        }
        game.dogController.triggerAnimation(DogAnimationState.CURIOUS, 1.0);
        game.audioSystem.playMagicSequence('star_collect');
    };

    game.slingObjectiveManager.onProgress = (current, target) => {
        game.hudManager.updateObjectiveProgress(current, target);
        if (player) {
            game.juiceManager.showFloatingText(`Clean Sling! ${current}/${target}`, player.position.clone(), '#44aaff', 22);
        }
        game.audioSystem.playMagicSequence('star_collect');
    };
    game.slingObjectiveManager.onObjectiveComplete = () => {
        if (player) {
            game.juiceManager.showFloatingText('Slingshot Master!', player.position.clone(), '#ffcc00', 28);
            game.juiceManager.burstMagic(player.position.clone());
        }
        game.dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.5);
        game.audioSystem.playMagicSequence('power_up');
    };

    wireFriendsCallbacks();
    wireObjectiveComplete();
    wireSlingableCallbacks();
}

function wireFriendsCallbacks(): void {
    const { friendsManager, levelManager, hudManager, dogController, juiceManager, audioSystem,
        saveManager, creatureCatalogManager, playerState, orbManager, slingComboManager, clock } = game;

    friendsManager.onFriendRescued = (count, position, kind) => {
        const objective = levelManager.config[levelManager.currentLevel]?.objective;
        dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.2);
        juiceManager.burstMagic(position.clone());
        saveManager.addCores(15);
        if (kind === 'moonpup') {
            dogController.triggerAnimation(DogAnimationState.VICTORY, 1.8);
            const moonPupMemory = saveManager.hasMemory('moon_pup');
            game.scoreMultiplierValue = 2;
            game.scoreMultiplierUntil = performance.now() + (moonPupMemory ? 16000 : 10000);
            if (player) juiceManager.showFloatingText('Good Dog! Score x2!', player.position.clone(), '#ffe4b5', 26);
            audioSystem.playMagicSequence('power_up');
            creatureCatalogManager.catalog('moon_pup');
        }
        if (kind === 'sealpup') creatureCatalogManager.catalog('stellar_seal_pup');
        if (kind === 'astrobunny') creatureCatalogManager.catalog('astro_bunny');
        if (kind === 'lemur') creatureCatalogManager.catalog('lunar_lemur');
        if (objective?.type === 'rescue') {
            hudManager.updateObjectiveProgress(count, objective.target);
            if (player) juiceManager.showFloatingText(`Rescued! ${count}/${objective.target}`, player.position.clone(), '#ffaa44', 22);
            if (count >= objective.target) {
                if (player) {
                    juiceManager.showFloatingText('Flotilla Assembled!', player.position.clone(), '#ffcc00', 28);
                    juiceManager.burstMagic(player.position.clone());
                }
                audioSystem.playMagicSequence('power_up');
            }
        }
    };

    friendsManager.onOtterGift = (position, cores) => {
        const otterMemory = saveManager.hasMemory('cosmic_otter');
        const totalCores = cores + (otterMemory && Math.random() < 0.35 ? 1 : 0);
        playerState.cores += totalCores;
        saveManager.addCores(totalCores);
        creatureCatalogManager.catalog('cosmic_otter');
        if (player) {
            juiceManager.showFloatingText(`+${totalCores} Core${totalCores > 1 ? 's' : ''}!`, position.clone(), '#66ccff', 24);
            juiceManager.burstMagic(position.clone());
        }
        dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.2);
    };

    friendsManager.onPenguinSlide = (position, cores, slideAssistDuration) => {
        const penguinMemory = saveManager.hasMemory('astro_penguin');
        const assistDuration = slideAssistDuration + (penguinMemory ? 1.5 : 0);
        playerState.cores += cores;
        saveManager.addCores(cores);
        playerState.penguinSlideAssistTimer = Math.max(playerState.penguinSlideAssistTimer, assistDuration);
        creatureCatalogManager.catalog('astro_penguin');
        if (player) {
            juiceManager.showFloatingText('Slide Assist!', position.clone(), '#aaddff', 24);
            juiceManager.burstMagic(position.clone());
        }
        dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.0);
    };

    friendsManager.onSealClap = (position, healthRestore) => {
        const sealMemory = saveManager.hasMemory('stellar_seal_pup');
        const glowDuration = sealMemory ? 5.5 : 3.5;
        const glowMultiplier = sealMemory ? 2.2 : 1.7;
        const boosted = orbManager.boostGlowNearby(position, 14, glowMultiplier, glowDuration, game.clock.getElapsedTime());
        creatureCatalogManager.catalog('stellar_seal_pup');
        if (healthRestore && healthRestore > 0) {
            playerState.health = Math.min(playerState.health + healthRestore, playerState.maxHealth);
        }
        if (player) {
            if (boosted > 0) {
                juiceManager.showFloatingText(boosted > 1 ? `${boosted} stars cheering!` : 'Star cheer!', position.clone(), '#aaddff', 20);
            } else if (healthRestore) {
                juiceManager.showFloatingText('Happy clap!', position.clone(), '#ffccdd', 18);
            }
            juiceManager.burstMagic(position.clone());
        }
        dogController.triggerAnimation(DogAnimationState.DELIGHTED, 0.8);
    };

    friendsManager.onAstroBunnyLucky = (position, bonus) => {
        const bunnyMemory = saveManager.hasMemory('astro_bunny');
        const totalBonus = bonus + (bunnyMemory ? 4 : 0);
        hudManager.addScore(totalBonus);
        creatureCatalogManager.catalog('astro_bunny');
        slingComboManager.refreshComboTimer();
        if (player) {
            juiceManager.showFloatingText('Lucky Star!', position.clone(), '#ffd700', 22);
            juiceManager.burstMagic(position.clone());
        }
        dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.0);
    };

    friendsManager.onLemurHeartGift = (position) => {
        const lemurMemory = saveManager.hasMemory('lunar_lemur');
        orbManager.spawnHeartOrb(position.x, position.y, position.z);
        creatureCatalogManager.catalog('lunar_lemur');
        if (lemurMemory) orbManager.boostGlowNearby(position, 16, 2.0, 6.5, game.clock.getElapsedTime());
        if (player) {
            juiceManager.showFloatingText('Heart Fruit!', position.clone(), '#ff69b4', 22);
            juiceManager.burstMagic(position.clone());
        }
        dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.0);
    };
}

function wireObjectiveComplete(): void {
    game.hudManager.onObjectiveComplete = () => {
        if (!player) return;
        const level = game.levelManager.currentLevel;
        if (!game.completedChaptersThisRun.includes(level)) {
            game.completedChaptersThisRun.push(level);
        }
        recordChapterComplete(game.saveManager, level);

        game.dogController.triggerAnimation(DogAnimationState.DELIGHTED, 2.5);
        game.juiceManager.showFloatingText('Chapter Complete!', player.position.clone(), '#ffcc00', 32);
        game.juiceManager.flashRainbow(1.0);
        game.juiceManager.shakeScreen(ShakeType.MEDIUM, 0.5);
        game.juiceManager.burstMagic(player.position.clone());
        game.audioSystem.playMagicSequence('power_up');
        game.levelManager.enterFastLane();
        game.friendsManager.triggerVictoryFlyby(3.0);
        for (let i = 0; i < 5; i++) {
            const ox = player.position.x + 20 + i * 15 + Math.random() * 8;
            const oy = (Math.random() - 0.5) * 10;
            game.orbManager.spawnRandomOrb(ox, oy, 0);
        }

        // Moon journey map — 2D overlay after each chapter victory.
        const wasPaused = isGamePaused;
        if (!wasPaused) setIsGamePaused(true);
        game.hudManager.showJourneyMapOverlay('chapter', {
            completedChapter: level,
            onClose: () => {
                if (!wasPaused) setIsGamePaused(false);
            }
        });
    };
}

function wireSlingableCallbacks(): void {
    game.slingableObjectSystem.onDestroyed = (kind, position, speciesId) => {
        const tag = speciesId || kind;
        game.resourceHarvester.harvest(tag, 'sling', position);
    };

    game.slingableObjectSystem.onSpecialEffect = (effect) => {
        if (effect.type === 'puffballPop') {
            if (player) {
                playerState.currentSpeedY = THREE.MathUtils.clamp(
                    playerState.currentSpeedY + effect.liftAmount,
                    -CONFIG.player.maxDescentSpeed * 1.5,
                    CONFIG.player.maxSpeedY * 2.0
                );
                game.juiceManager.showFloatingText('Spore Pop!', player.position.clone(), '#99ffaa', 22);
                game.dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.0);
                game.audioSystem.playMagicSequence('power_up');
                game.slingComboManager.recordSlingAction('perfect', effect.position.clone());
                game.slingObjectiveManager.recordSling('perfect');
                reportComboObjectiveProgress();
                game.friendsManager.cheerFlotilla(effect.position.clone());
            }
        } else if (effect.type === 'chromaSlipstream') {
            if (player) game.juiceManager.showFloatingText('Rainbow Slipstream!', effect.position.clone(), '#ff66cc', 20);
        } else if (effect.type === 'toyRocketResolved') {
            const isNewLore = game.saveManager.discoverSpecies('toyRocketWreck_lore');
            if (isNewLore) {
                game.juiceManager.showFloatingText("Someone else's adventure...", effect.position.clone(), '#ffb6c1', 22);
                game.juiceManager.burstMagic(effect.position.clone());
                game.audioSystem.playMagicSequence('star_collect');
            }
            game.creatureCatalogManager.catalog('toy_wreck');
            if (effect.viaSling && player) {
                game.hudManager.addScore(140);
                game.juiceManager.showFloatingText('Wreck Rally!', effect.position.clone(), '#ff8fab', 24);
                game.dogController.triggerAnimation(DogAnimationState.CURIOUS, 1.0);
                game.friendsManager.cheerFlotilla(effect.position.clone());
            }
        }
    };
}

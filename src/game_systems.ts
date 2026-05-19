import * as THREE from 'three';
import { scene, camera } from './scene_setup';
import { player } from './player_loader';
import { playerState } from './game_config';
import { ParticleSystem, DebrisSystem } from './particles';
import { WeaponSystem } from './weapons';
import { WeaponLightManager } from './lighting';
import { ReEntrySystem } from './reentry';
import { WaterfallSystem } from './waterfall';
import { AsteroidFieldSystem } from './asteroid_field';
import { PlanetaryHorizonSystem } from './planetary_horizon';
import { MeteorShowerSystem } from './meteor_shower';
import { IndustrialBackgroundSystem } from './industrial_background';
import { GodRaySystem } from './godrays';
import { NebulaSystem } from './nebula';
import { CosmicDustSystem } from './cosmic_dust';
import { BiologicalBackgroundSystem } from './biological_background';
import { LiquidMetalSystem } from './geological';
import { BossManager } from './boss_system';
import { getAudioSystem, initAudioOnInteraction } from './audio_system';
import { UpgradeSystem, PickupManager, HeatSystem, UPGRADE_CONFIGS } from './upgrade_system';
import { getSaveManager } from './save_manager';
import { StarfieldSystem } from './stars';
import { OrbManager } from './collectibles';
import { PowerUpManager, PowerUpType } from './powerup_manager';
import { FriendsManager } from './space_friends';
import { DogCockpitController, DogAnimationState } from './dog_cockpit';
import { HUDManager } from './hud_system';
import { JuiceManager, ShakeType } from './juice_effects';
import { ConstellationManager } from './flower_constellations';
import { CandyBeltManager } from './candy_obstacles';
import { CastleBackgroundManager } from './cloud_castles';
import { EffectManager, MagicalEffectType } from './magical_effects';
import { VictorySystem } from './victory_system';
import { TutorialSystem, shouldShowTutorial } from './tutorial_system';
import { BoostSystem } from './boost_system';
import { RollSystem } from './roll_system';
import { updateHealthDisplay } from './ui_controls';

// PARTICLE SYSTEM (engine trails & explosions)
export const particleSystem = new ParticleSystem(scene);
export const debrisSystem = new DebrisSystem(scene);

// WEAPON SYSTEM (Dynamic Lighting Projectiles)
export const weaponSystem = new WeaponSystem(scene);
export const weaponLightManager = new WeaponLightManager();

// Enhanced fire function with heat and audio
const originalFire = weaponSystem.fire.bind(weaponSystem);
weaponSystem.fire = function(position: THREE.Vector3, direction: THREE.Vector3) {
    if (!heatSystem.canFire()) return;
    
    const heatGen = upgradeSystem.getModifiedHeatGeneration(8);
    if (!heatSystem.addHeat(heatGen)) return;
    
    audioSystem.playShoot(Math.random());
    
    const upgradeColor = upgradeSystem.getProjectileColor();
    if (upgradeColor) {
        this.setColor(upgradeColor);
    } else {
        this.setColor(0x00ffff);
    }
    
    originalFire(position, direction);
};

// RE-ENTRY SYSTEM (Atmospheric Heat Effects)
export const reEntrySystem = new ReEntrySystem(scene, camera);

// WATERFALL SYSTEM (Vertical Water Effects)
export const waterfallSystem = new WaterfallSystem(scene, camera);

// ASTEROID FIELD SYSTEM (Parallax Asteroids)
export const asteroidFieldSystem = new AsteroidFieldSystem(scene, weaponLightManager);

// PLANETARY HORIZON SYSTEM (Massive scrolling planet)
export const planetaryHorizonSystem = new PlanetaryHorizonSystem(scene);

// METEOR SHOWER SYSTEM
export const meteorShowerSystem = new MeteorShowerSystem(scene);

// INDUSTRIAL BACKGROUND SYSTEM (Megastructures)
export const industrialSystem = new IndustrialBackgroundSystem(scene, weaponLightManager);

// NEBULA SYSTEM (Volumetric Clouds & Particles)
export const godRaySystem = new GodRaySystem(scene);
export const nebulaSystem = new NebulaSystem(scene, weaponLightManager);
export const cosmicDustSystem = new CosmicDustSystem(scene);
nebulaSystem.setCamera(camera);

// BIOLOGICAL BACKGROUND SYSTEM (Space Whale Interior)
export const biologicalSystem = new BiologicalBackgroundSystem(scene);

// LIQUID METAL SYSTEM (Advanced Reflection & Physics)
export const liquidMetalSystem = new LiquidMetalSystem(scene);

// BOSS SYSTEM
export const bossManager = new BossManager(scene);

// AUDIO SYSTEM
export const audioSystem = getAudioSystem();
initAudioOnInteraction();

// UPGRADE SYSTEMS
export const upgradeSystem = new UpgradeSystem(scene, {
    onUpgradeStart: (type) => {
        console.log(`⚡ Upgrade started: ${UPGRADE_CONFIGS[type].name}`);
        audioSystem.play('powerup');
    },
    onUpgradeEnd: (type) => {
        console.log(`⚡ Upgrade ended: ${UPGRADE_CONFIGS[type].name}`);
    }
});

export const pickupManager = new PickupManager(scene);
export const heatSystem = new HeatSystem();

// MAGICAL SYSTEMS (from swarm)
export const starfield = new StarfieldSystem(scene);
export const orbManager = new OrbManager(scene, particleSystem, 4);
export const powerUpManager = new PowerUpManager({
    scene: scene,
    particleSystem: particleSystem,
    audioSystem: audioSystem,
    rocket: undefined,
    onPowerUpStart: (type, config) => {
        console.log(`Power-up started: ${config.name}`);
        switch(type) {
            case PowerUpType.RAINBOW_COMET_TAIL:
                effectManager.activateEffect(MagicalEffectType.RAINBOW_TRAIL, config.duration);
                audioSystem.playCometActivate();
                dogController.triggerAnimation(DogAnimationState.POWER_UP, 2.0);
                juiceManager.flashRainbow(0.8);
                break;
            case PowerUpType.FLOWER_CROWN_BOOST:
                effectManager.activateEffect(MagicalEffectType.STARDUST_FIELD, config.duration);
                audioSystem.playBoost();
                break;
            case PowerUpType.TWINKLE_STAR_MAGNET:
                effectManager.activateEffect(MagicalEffectType.STARDUST_FIELD, config.duration);
                audioSystem.playCollect();
                break;
            case PowerUpType.BUBBLEGUM_SHIELD:
                effectManager.activateEffect(MagicalEffectType.HEART_BUBBLE, config.duration);
                audioSystem.playShieldActivate();
                break;
            case PowerUpType.BUTTERFLY_ESCORT:
                effectManager.activateEffect(MagicalEffectType.BUTTERFLY_SWARM, config.duration);
                audioSystem.playCollect();
                break;
            case PowerUpType.UNICORN_HORN_BLAST:
                effectManager.activateEffect(MagicalEffectType.GLITTER_BEAM, config.duration);
                audioSystem.playBoost();
                break;
        }
    },
    onPowerUpEnd: (type, config) => {
        console.log(`Power-up ended: ${config.name}`);
        if (type === PowerUpType.BUBBLEGUM_SHIELD && player) {
            audioSystem.playShieldBreak();
            juiceManager.showFloatingText("Pop!", player.position, '#ff69b4', 24);
            juiceManager.burstMagic(player.position.clone());
        }
    }
});

// SPACE FRIENDS (cute companions for a 7-year-old girl)
export const friendsManager = new FriendsManager(scene, audioSystem, particleSystem);

// Connect orb collection to power-ups
orbManager.onPowerUpReady = () => {
    const triggered = powerUpManager.collectOrb();
    if (triggered && player) {
        dogController.triggerAnimation(DogAnimationState.POWER_UP, 2.0);
        juiceManager.flashRainbow(0.5);
        juiceManager.burstMagic(player.position.clone());
        
        const activeEffects = powerUpManager.getActiveEffects();
        activeEffects.forEach(effect => {
            switch(effect.type) {
                case PowerUpType.RAINBOW_COMET_TAIL:
                    effectManager.activateEffect(MagicalEffectType.RAINBOW_TRAIL, effect.duration);
                    break;
                case PowerUpType.FLOWER_CROWN_BOOST:
                    effectManager.activateEffect(MagicalEffectType.STARDUST_FIELD, effect.duration);
                    break;
                case PowerUpType.BUBBLEGUM_SHIELD:
                    effectManager.activateEffect(MagicalEffectType.HEART_BUBBLE, effect.duration);
                    break;
                case PowerUpType.TWINKLE_STAR_MAGNET:
                    effectManager.activateEffect(MagicalEffectType.STARDUST_FIELD, effect.duration);
                    break;
                case PowerUpType.BUTTERFLY_ESCORT:
                    effectManager.activateEffect(MagicalEffectType.BUTTERFLY_SWARM, effect.duration);
                    break;
                case PowerUpType.UNICORN_HORN_BLAST:
                    effectManager.activateEffect(MagicalEffectType.GLITTER_BEAM, effect.duration);
                    break;
            }
        });
    }
};

orbManager.onScore = (points) => {
    hudManager.addScore(points);
};

orbManager.onHealthRestore = (amount) => {
    playerState.health = Math.min(playerState.health + amount, playerState.maxHealth);
    hudManager.updateHealth(playerState.health, playerState.maxHealth);
    updateHealthDisplay(playerState);
    audioSystem.playCollect();
};

// SAVE SYSTEM
export const saveManager = getSaveManager();

// Apply save data to player state
playerState.maxHealth = saveManager.applyToHealth(3);
playerState.health = playerState.maxHealth + saveManager.getStartingHealthBonus();
playerState.autoScrollSpeed = saveManager.applyToSpeed(8);

// NEW MANAGERS (Swarm #2)
export const dogController = new DogCockpitController();
export const hudManager = new HUDManager(saveManager);
export const juiceManager = new JuiceManager(camera, scene, particleSystem);

// BOOST SYSTEM
export const boostSystem = new BoostSystem({
    maxCharges: 3,
    rechargeTime: 8,
    duration: 1.8,
    cooldown: 4,
    onActivate: () => {
        audioSystem.playBoost();
        dogController.triggerAnimation(DogAnimationState.POWER_UP, 1.8);
        juiceManager.shakeScreen(ShakeType.MEDIUM, 0.4);
    },
    onDeactivate: () => {},
    onRecharge: (charges) => {}
});

// ROLL SYSTEM
export const rollSystem = new RollSystem({
    duration: 0.5,
    cooldown: 2.6,
    onActivate: () => {
        audioSystem.playRoll();
        dogController.triggerAnimation(DogAnimationState.THRUST, 0.45);
        juiceManager.shakeScreen(ShakeType.HEAVY, 0.25);
    },
    onDeactivate: () => {
        playerState.invincible = false;
    }
});

// SWARM #3 - DREAMY ENVIRONMENTS
export const flowerManager = new ConstellationManager(scene, audioSystem, particleSystem);
export const candyManager = new CandyBeltManager(scene, audioSystem, particleSystem);
export const castleManager = new CastleBackgroundManager(scene);

// Effect manager - will set target when player loads
const tempTarget = new THREE.Group();
export const effectManager = new EffectManager(scene, audioSystem, tempTarget);

// SWARM #4: Victory and Tutorial Systems
export const victorySystem = new VictorySystem(scene, camera, audioSystem, hudManager, juiceManager);
export const tutorialSystem = new TutorialSystem(scene, hudManager, audioSystem, dogController);

// Check if we should show tutorial (first time players)
if (shouldShowTutorial(saveManager)) {
    tutorialSystem.onComplete(() => {
        console.log('Tutorial complete! Starting game...');
    });
}

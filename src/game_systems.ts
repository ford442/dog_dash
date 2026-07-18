import type { ChromaShiftSystem } from './chroma_shift';
import type { StormGeodeSystem } from './storm_geodes';
import { CrystalChimeManager } from './crystal_chimes';
import { LightningBoltSystem } from './lightning_bolt';
import * as THREE from 'three';
import { scene, camera } from './scene_context';
import { player } from './player_loader';
import { playerState } from './game_config';
import { ParticleSystem, DebrisSystem } from './particles';
import { WeaponSystem } from './weapons';
import { WeaponLightManager } from './lighting';
import { AsteroidFieldSystem } from './asteroid_field';
import { GodRaySystem } from './godrays';
import { AuroraSystem } from './aurora';
import { NebulaSystem } from './nebula';
import {
    createReEntrySystemStub,
    createWaterfallSystemStub,
    createMeteorShowerSystemStub,
    createIndustrialSystemStub,
    createBiologicalSystemStub,
    createCosmicDustSystemStub,
    createLiquidMetalSystemStub,
    createBossManagerStub,
    createPlanetaryHorizonSystemStub,
    createChromaShiftSystemStub,
    createStormGeodeSystemStub,
    createBlackHoleSystemStub
} from './deferred_system_stubs';
import type { ReEntrySystem } from './reentry';
import type { WaterfallSystem } from './waterfall';
import type { PlanetaryHorizonSystem } from './planetary_horizon';
import type { MeteorShowerSystem } from './meteor_shower';
import type { IndustrialBackgroundSystem } from './industrial_background';
import type { CosmicDustSystem } from './cosmic_dust';
import type { BlackHoleSystem } from './black_hole';
import { GravLensManager } from './grav_lens';
import { DerelictBuoyManager } from './derelict_buoy';
import { DataMonolithManager } from './data_monolith';
import type { BiologicalBackgroundSystem } from './biological_background';
import type { LiquidMetalSystem } from './geological';
import type { BossManager } from './boss_system';
import { getAudioSystem, initAudioOnInteraction } from './audio_system';
import { UpgradeSystem, PickupManager, HeatSystem, UPGRADE_CONFIGS } from './upgrade_system';
import { getSaveManager } from './save_manager';
import { StarfieldSystem } from './stars';
import { OrbManager } from './collectibles';
import { PowerUpManager, PowerUpType } from './powerup_manager';
import { DogCockpitController, DogAnimationState } from './dog_cockpit';
import { HUDManager } from './hud_system';
import { JuiceManager, ShakeType } from './juice_effects';
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

// Level-heavy environment systems — stubs until level_systems_loader installs real instances.
export let reEntrySystem: ReEntrySystem = createReEntrySystemStub();
export let waterfallSystem: WaterfallSystem = createWaterfallSystemStub();
export let planetaryHorizonSystem: PlanetaryHorizonSystem = createPlanetaryHorizonSystemStub();
export let meteorShowerSystem: MeteorShowerSystem = createMeteorShowerSystemStub();
export let industrialSystem: IndustrialBackgroundSystem = createIndustrialSystemStub();

// ASTEROID FIELD SYSTEM (Parallax Asteroids) — needed for Level 1
export const asteroidFieldSystem = new AsteroidFieldSystem(scene, weaponLightManager);

// NEBULA SYSTEM (Volumetric Clouds & Particles)
export const godRaySystem = new GodRaySystem(scene);
export const auroraSystem = new AuroraSystem(scene, weaponLightManager);
export const nebulaSystem = new NebulaSystem(scene, weaponLightManager);
export let cosmicDustSystem: CosmicDustSystem = createCosmicDustSystemStub();
nebulaSystem.setCamera(camera);

export let biologicalSystem: BiologicalBackgroundSystem = createBiologicalSystemStub();
export let liquidMetalSystem: LiquidMetalSystem = createLiquidMetalSystemStub();
export let bossManager: BossManager = createBossManagerStub();

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

// Space friends, dreamy environment managers, and butterfly swarm are created
// by main.ts through game_managers.ts so game_systems.ts never constructs
// orphan manager instances at module load time.

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
export const lightningBoltSystem = new LightningBoltSystem(scene, weaponLightManager);

export let chromaShiftSystem: ChromaShiftSystem = createChromaShiftSystemStub();
export let stormGeodeSystem: StormGeodeSystem = createStormGeodeSystemStub();
export const crystalChimeManager = new CrystalChimeManager(scene, particleSystem, audioSystem);

export let blackHoleSystem: BlackHoleSystem = createBlackHoleSystemStub();
export const gravLensManager = new GravLensManager(scene);
export const derelictBuoyManager = new DerelictBuoyManager(scene);
export const dataMonolithManager = new DataMonolithManager(scene);

export type LevelEnvironmentSystemExports = {
    reEntrySystem: ReEntrySystem;
    waterfallSystem: WaterfallSystem;
    meteorShowerSystem: MeteorShowerSystem;
    industrialSystem: IndustrialBackgroundSystem;
    biologicalSystem: BiologicalBackgroundSystem;
    cosmicDustSystem: CosmicDustSystem;
    liquidMetalSystem: LiquidMetalSystem;
    bossManager: BossManager;
    planetaryHorizonSystem: PlanetaryHorizonSystem;
    chromaShiftSystem: ChromaShiftSystem;
    stormGeodeSystem: StormGeodeSystem;
    blackHoleSystem: BlackHoleSystem;
};

/** Replace stub environment systems after the async level-heavy chunk loads. */
export function installLevelEnvironmentSystems(systems: LevelEnvironmentSystemExports): void {
    reEntrySystem = systems.reEntrySystem;
    waterfallSystem = systems.waterfallSystem;
    meteorShowerSystem = systems.meteorShowerSystem;
    industrialSystem = systems.industrialSystem;
    biologicalSystem = systems.biologicalSystem;
    cosmicDustSystem = systems.cosmicDustSystem;
    liquidMetalSystem = systems.liquidMetalSystem;
    bossManager = systems.bossManager;
    planetaryHorizonSystem = systems.planetaryHorizonSystem;
    chromaShiftSystem = systems.chromaShiftSystem;
    stormGeodeSystem = systems.stormGeodeSystem;
    blackHoleSystem = systems.blackHoleSystem;
}

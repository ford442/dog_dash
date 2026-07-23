import type { ChromaShiftSystem } from './chroma_shift';
import type { StormGeodeSystem } from './storm_geodes';
import { CrystalChimeManager } from './crystal_chimes';
import { LightningBoltSystem } from './lightning_bolt';
import * as THREE from 'three';
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
    createBossManagerStub,
    createPlanetaryHorizonSystemStub,
    createMoonPalaceSystemStub,
    createChromaShiftSystemStub,
    createStormGeodeSystemStub,
    createBlackHoleSystemStub,
    createWishLanternSystemStub
} from './deferred_system_stubs';
import type { ReEntrySystem } from './reentry';
import type { WaterfallSystem } from './waterfall';
import type { PlanetaryHorizonSystem } from './planetary_horizon';
import type { MoonPalaceSystem } from './moon_palace';
import type { MeteorShowerSystem } from './meteor_shower';
import type { IndustrialBackgroundSystem } from './industrial_background';
import type { CosmicDustSystem } from './cosmic_dust';
import { PastelNebulaSystem } from './pastel_nebula';
import type { BlackHoleSystem } from './black_hole';
import type { WishLanternSystem } from './wish_lanterns';
import { GravLensManager } from './grav_lens';
import { DerelictBuoyManager } from './derelict_buoy';
import { DataMonolithManager } from './data_monolith';
import type { BiologicalBackgroundSystem } from './biological_background';
import { LiquidMetalSystem } from './geological/liquid_metal';
import type { BossManager } from './boss_system';
import { getAudioSystem, initAudioOnInteraction, type AudioSystem } from './audio_system';
import { UpgradeSystem, PickupManager, HeatSystem, UPGRADE_CONFIGS } from './upgrade_system';
import { getSaveManager, type SaveManager } from './save_manager';
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
import { player } from './player_loader';
import { playerState as playerStateSingleton } from './game_config';

export type CreateGameSystemsDeps = {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    playerState: typeof playerStateSingleton;
};

/** Eager gameplay systems constructed once at bootstrap (stubs until level chunk loads). */
export type GameSystems = {
    particleSystem: ParticleSystem;
    debrisSystem: DebrisSystem;
    weaponSystem: WeaponSystem;
    weaponLightManager: WeaponLightManager;
    reEntrySystem: ReEntrySystem;
    waterfallSystem: WaterfallSystem;
    planetaryHorizonSystem: PlanetaryHorizonSystem;
    moonPalaceSystem: MoonPalaceSystem;
    meteorShowerSystem: MeteorShowerSystem;
    industrialSystem: IndustrialBackgroundSystem;
    asteroidFieldSystem: AsteroidFieldSystem;
    godRaySystem: GodRaySystem;
    auroraSystem: AuroraSystem;
    nebulaSystem: NebulaSystem;
    cosmicDustSystem: CosmicDustSystem;
    pastelNebulaSystem: PastelNebulaSystem;
    biologicalSystem: BiologicalBackgroundSystem;
    liquidMetalSystem: LiquidMetalSystem;
    bossManager: BossManager;
    audioSystem: AudioSystem;
    upgradeSystem: UpgradeSystem;
    pickupManager: PickupManager;
    heatSystem: HeatSystem;
    starfield: StarfieldSystem;
    orbManager: OrbManager;
    powerUpManager: PowerUpManager;
    saveManager: SaveManager;
    dogController: DogCockpitController;
    hudManager: HUDManager;
    juiceManager: JuiceManager;
    boostSystem: BoostSystem;
    rollSystem: RollSystem;
    effectManager: EffectManager;
    victorySystem: VictorySystem;
    tutorialSystem: TutorialSystem;
    lightningBoltSystem: LightningBoltSystem;
    chromaShiftSystem: ChromaShiftSystem;
    stormGeodeSystem: StormGeodeSystem;
    crystalChimeManager: CrystalChimeManager;
    blackHoleSystem: BlackHoleSystem;
    gravLensManager: GravLensManager;
    derelictBuoyManager: DerelictBuoyManager;
    dataMonolithManager: DataMonolithManager;
    wishLanternSystem: WishLanternSystem;
};

export type LevelEnvironmentSystemExports = {
    reEntrySystem: ReEntrySystem;
    waterfallSystem: WaterfallSystem;
    meteorShowerSystem: MeteorShowerSystem;
    industrialSystem: IndustrialBackgroundSystem;
    biologicalSystem: BiologicalBackgroundSystem;
    cosmicDustSystem: CosmicDustSystem;
    bossManager: BossManager;
    planetaryHorizonSystem: PlanetaryHorizonSystem;
    moonPalaceSystem: MoonPalaceSystem;
    chromaShiftSystem: ChromaShiftSystem;
    stormGeodeSystem: StormGeodeSystem;
    blackHoleSystem: BlackHoleSystem;
    wishLanternSystem: WishLanternSystem;
};

/**
 * Construct all composition-root gameplay systems. Call once from bootstrap — never at import time.
 */
export function createGameSystems(deps: CreateGameSystemsDeps): GameSystems {
    const { scene, camera, playerState } = deps;

    const particleSystem = new ParticleSystem(scene);
    const debrisSystem = new DebrisSystem(scene);
    const weaponSystem = new WeaponSystem(scene);
    const weaponLightManager = new WeaponLightManager();

    const reEntrySystem: ReEntrySystem = createReEntrySystemStub();
    const waterfallSystem: WaterfallSystem = createWaterfallSystemStub();
    const planetaryHorizonSystem: PlanetaryHorizonSystem = createPlanetaryHorizonSystemStub();
    const moonPalaceSystem: MoonPalaceSystem = createMoonPalaceSystemStub();
    const meteorShowerSystem: MeteorShowerSystem = createMeteorShowerSystemStub();
    const industrialSystem: IndustrialBackgroundSystem = createIndustrialSystemStub();

    const asteroidFieldSystem = new AsteroidFieldSystem(scene, weaponLightManager);
    const godRaySystem = new GodRaySystem(scene);
    const auroraSystem = new AuroraSystem(scene, weaponLightManager);
    const nebulaSystem = new NebulaSystem(scene, weaponLightManager);
    const cosmicDustSystem: CosmicDustSystem = createCosmicDustSystemStub();
    const pastelNebulaSystem = new PastelNebulaSystem(scene, weaponLightManager);
    nebulaSystem.setCamera(camera);

    const biologicalSystem: BiologicalBackgroundSystem = createBiologicalSystemStub();
    const liquidMetalSystem = new LiquidMetalSystem(scene);
    const bossManager: BossManager = createBossManagerStub();

    const audioSystem = getAudioSystem();
    initAudioOnInteraction();

    const upgradeSystem = new UpgradeSystem(scene, {
        onUpgradeStart: (type) => {
            console.log(`⚡ Upgrade started: ${UPGRADE_CONFIGS[type].name}`);
            audioSystem.play('powerup');
        },
        onUpgradeEnd: (type) => {
            console.log(`⚡ Upgrade ended: ${UPGRADE_CONFIGS[type].name}`);
        }
    });

    const pickupManager = new PickupManager(scene);
    const heatSystem = new HeatSystem();

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

    const starfield = new StarfieldSystem(scene);
    const orbManager = new OrbManager(scene, particleSystem, 4);

    const saveManager = getSaveManager();
    const dogController = new DogCockpitController();
    const hudManager = new HUDManager(saveManager);
    const juiceManager = new JuiceManager(camera, scene, particleSystem);

    const tempTarget = new THREE.Group();
    const effectManager = new EffectManager(scene, audioSystem, tempTarget);

    const powerUpManager = new PowerUpManager({
        scene,
        particleSystem,
        audioSystem,
        rocket: undefined,
        onPowerUpStart: (type, config) => {
            console.log(`Power-up started: ${config.name}`);
            switch (type) {
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
                juiceManager.showFloatingText('Pop!', player.position, '#ff69b4', 24);
                juiceManager.burstMagic(player.position.clone());
            }
        }
    });

    orbManager.onPowerUpReady = () => {
        const triggered = powerUpManager.collectOrb();
        if (triggered && player) {
            dogController.triggerAnimation(DogAnimationState.POWER_UP, 2.0);
            juiceManager.flashRainbow(0.5);
            juiceManager.burstMagic(player.position.clone());

            const activeEffects = powerUpManager.getActiveEffects();
            activeEffects.forEach((effect) => {
                switch (effect.type) {
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

    const boostSystem = new BoostSystem({
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
        onRecharge: (_charges) => {}
    });

    const rollSystem = new RollSystem({
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

    const victorySystem = new VictorySystem(scene, camera, audioSystem, hudManager, juiceManager);
    const tutorialSystem = new TutorialSystem(scene, hudManager, audioSystem, dogController);

    if (shouldShowTutorial(saveManager)) {
        tutorialSystem.onComplete(() => {
            console.log('Tutorial complete! Starting game...');
        });
    }

    const lightningBoltSystem = new LightningBoltSystem(scene, weaponLightManager);
    const chromaShiftSystem: ChromaShiftSystem = createChromaShiftSystemStub();
    const stormGeodeSystem: StormGeodeSystem = createStormGeodeSystemStub();
    const crystalChimeManager = new CrystalChimeManager(scene, particleSystem, audioSystem);
    const blackHoleSystem: BlackHoleSystem = createBlackHoleSystemStub();
    const wishLanternSystem: WishLanternSystem = createWishLanternSystemStub();
    const gravLensManager = new GravLensManager(scene);
    const derelictBuoyManager = new DerelictBuoyManager(scene);
    const dataMonolithManager = new DataMonolithManager(scene);

    return {
        particleSystem,
        debrisSystem,
        weaponSystem,
        weaponLightManager,
        reEntrySystem,
        waterfallSystem,
        planetaryHorizonSystem,
        moonPalaceSystem,
        meteorShowerSystem,
        industrialSystem,
        asteroidFieldSystem,
        godRaySystem,
        auroraSystem,
        nebulaSystem,
        cosmicDustSystem,
        pastelNebulaSystem,
        biologicalSystem,
        liquidMetalSystem,
        bossManager,
        audioSystem,
        upgradeSystem,
        pickupManager,
        heatSystem,
        starfield,
        orbManager,
        powerUpManager,
        saveManager,
        dogController,
        hudManager,
        juiceManager,
        boostSystem,
        rollSystem,
        effectManager,
        victorySystem,
        tutorialSystem,
        lightningBoltSystem,
        chromaShiftSystem,
        stormGeodeSystem,
        crystalChimeManager,
        blackHoleSystem,
        wishLanternSystem,
        gravLensManager,
        derelictBuoyManager,
        dataMonolithManager
    };
}

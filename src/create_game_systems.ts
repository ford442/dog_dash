import type { SpaceGardenSystem } from './space_garden';
import type { BouncePadsSystem } from './bounce_pads';
import type { AerialGuardPatrolSystem } from './aerial_guard_patrol';
import type { AirTokensSystem } from './air_tokens';
import type { SkyRailTerminalSystem } from './sky_rail_terminal';
import type { ChromaShiftSystem } from './chroma_shift';
import type { StormGeodeSystem } from './storm_geodes';
import type { CrystalChimeManager } from './crystal_chimes';
import type { LightningBoltSystem } from './lightning_bolt';
import * as THREE from 'three';
import { ParticleSystem, DebrisSystem } from './particles';
import { WeaponSystem } from './weapons';
import { WeaponLightManager } from './lighting';
import type { AsteroidFieldSystem } from './asteroid_field';
import type { GodRaySystem } from './godrays';
import type { AuroraSystem } from './aurora';
import type { NebulaSystem } from './nebula';
import {
    createReEntrySystemStub,
    createWaterfallSystemStub,
    createMeteorShowerSystemStub,
    createIndustrialSystemStub,
    createBiologicalSystemStub,
    createCosmicDustSystemStub,
    createTimeShiftZonesSystemStub,
    createBossManagerStub,
    createPlanetaryHorizonSystemStub,
    createMoonPalaceSystemStub,
    createChromaShiftSystemStub,
    createStormGeodeSystemStub,
    createBlackHoleSystemStub,
    createGalacticCoreSystemStub,
    createDreamPortalSystemStub,
    createWishLanternSystemStub,
    createSpacePetsSwarmSystemStub,
    createWeatherSystemStub,
    createDancingJellyMossSystemStub,
    createDynamicStarfieldSystemStub,
    createDayNightCycleSystemStub,
    createCloudCastlesSystemStub,
    createGrappleIslesSystemStub,
    createCandyFieldSystemStub,
    createSingingGeodeSystemStub,
    createWindCurrentsSystemStub,
    createFlowerConstellationsSystemStub,
    createBouncePadsSystemStub,
    createSpaceGardenSystemStub,
    createAerialGuardPatrolSystemStub,
    createAirTokensSystemStub,
    createShootingStarsSystemStub,
    createSkyRailTerminalSystemStub,
    createVictorySystemStub,
    createTutorialSystemStub,
    createPastelNebulaSystemStub,
    createNebulaSystemStub,
    createGodRaySystemStub,
    createAuroraSystemStub,
    createLightningBoltSystemStub,
    createAsteroidFieldSystemStub,
    createLiquidMetalSystemStub,
    createCrystalChimeManagerStub,
    createGravLensManagerStub,
    createDerelictBuoyManagerStub,
    createDataMonolithManagerStub,
    createMagicPaintbrushSystemStub
} from './deferred_system_stubs';
import type { ReEntrySystem } from './reentry';
import type { WaterfallSystem } from './waterfall';
import type { PlanetaryHorizonSystem } from './planetary_horizon';
import type { MoonPalaceSystem } from './moon_palace';
import type { MeteorShowerSystem } from './meteor_shower';
import type { IndustrialBackgroundSystem } from './industrial_background';
import type { CosmicDustSystem } from './cosmic_dust';
import type { PastelNebulaSystem } from './pastel_nebula';
import type { BlackHoleSystem } from './black_hole';
import type { GalacticCoreSystem } from './galactic_core';
import type { DreamPortalSystem } from './dream_portal';
import type { WishLanternSystem } from './wish_lanterns';
import type { SpacePetsSwarmSystem } from './space_pets_swarm';
import type { WeatherSystem } from './weather_system';
import type { DancingJellyMossSystem } from './dancing_jelly_moss';
import type { DynamicStarfieldSystem } from './dynamic_starfield';
import type { DayNightCycleSystem } from './day_night_cycle';
import type { CloudCastlesSystem } from './cloud_castles_system';
import type { GrappleIslesSystem } from './grapple_isles';
import type { CandyFieldSystem } from './candy_obstacles';
import type { SingingGeodeSystem } from './singing_geodes';
import type { FlowerConstellationsSystem } from './flower_constellations_system';
import type { GravLensManager } from './grav_lens';
import type { DerelictBuoyManager } from './derelict_buoy';
import type { DataMonolithManager } from './data_monolith';
import type { BiologicalBackgroundSystem } from './biological_background';
import type { LiquidMetalSystem } from './geological/liquid_metal';
import type { BossManager } from './boss_system';
import { getAudioSystem, initAudioOnInteraction, type AudioSystem } from './audio_system';
import { loadAndApplyAudioSettings } from './audio_settings';
import { UpgradeSystem, PickupManager, HeatSystem, UPGRADE_CONFIGS } from './upgrade_system';
import { getSaveManager, type SaveManager } from './save_manager';
import { StarfieldSystem } from './stars';
import { OrbManager } from './collectibles';
import { PowerUpManager, PowerUpType, handlePowerUpStart, handlePowerUpEnd, syncMagicalEffectsFromActive } from './powerup_manager';
import { DogCockpitController, DogAnimationState } from './dog_cockpit';
import { HUDManager } from './hud_system';
import { JuiceManager, ShakeType } from './juice_effects';
import { EffectManager } from './magical_effects';
import type { MagicPaintbrushSystem } from './magic_paintbrush';
import type { VictorySystem } from './victory_system';
import type { TutorialSystem } from './tutorial_system';
import { BoostSystem } from './boost_system';
import { RollSystem } from './roll_system';
import { BarkBlastSystem } from './bark_blast_system';
import { updateHealthDisplay } from './ui_controls';
import { player } from './player_loader';
import { playerState as playerStateSingleton } from './game_config';
import { game } from './game_runtime';

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
    barkBlastSystem: BarkBlastSystem;
    effectManager: EffectManager;
    magicPaintbrushSystem: MagicPaintbrushSystem;
    victorySystem: VictorySystem;
    tutorialSystem: TutorialSystem;
    lightningBoltSystem: LightningBoltSystem;
    chromaShiftSystem: ChromaShiftSystem;
    stormGeodeSystem: StormGeodeSystem;
    crystalChimeManager: CrystalChimeManager;
    blackHoleSystem: BlackHoleSystem;
    galacticCoreSystem: GalacticCoreSystem;
    dreamPortalSystem: DreamPortalSystem;
    gravLensManager: GravLensManager;
    derelictBuoyManager: DerelictBuoyManager;
    dataMonolithManager: DataMonolithManager;
    wishLanternSystem: WishLanternSystem;
    spacePetsSwarmSystem: SpacePetsSwarmSystem;
    weatherSystem: WeatherSystem;
    dancingJellyMossSystem: DancingJellyMossSystem;
    dynamicStarfieldSystem: DynamicStarfieldSystem;
    dayNightCycleSystem: DayNightCycleSystem;
    cloudCastlesSystem: CloudCastlesSystem;
    grappleIslesSystem: GrappleIslesSystem;
    windCurrentsSystem: import('./wind_currents').WindCurrentsSystem;
    timeShiftZonesSystem: import('./time_shift_zones').TimeShiftZonesSystem;

    candyFieldSystem: CandyFieldSystem;
    singingGeodeSystem: SingingGeodeSystem;
    flowerConstellationsSystem: FlowerConstellationsSystem;
    bouncePadsSystem: BouncePadsSystem;
    aerialGuardPatrolSystem: AerialGuardPatrolSystem;
    airTokensSystem: AirTokensSystem;
    shootingStarsSystem: import('./shooting_stars').ShootingStarsSystem;
    spaceGardenSystem: SpaceGardenSystem;
    skyRailTerminalSystem: SkyRailTerminalSystem;
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
    galacticCoreSystem: GalacticCoreSystem;
    wishLanternSystem: WishLanternSystem;
    spacePetsSwarmSystem: SpacePetsSwarmSystem;
    dynamicStarfieldSystem: DynamicStarfieldSystem;
    dayNightCycleSystem: DayNightCycleSystem;
    cloudCastlesSystem: CloudCastlesSystem;
    grappleIslesSystem: GrappleIslesSystem;
    windCurrentsSystem: import('./wind_currents').WindCurrentsSystem;

    candyFieldSystem: CandyFieldSystem;
    singingGeodeSystem: SingingGeodeSystem;
    flowerConstellationsSystem: FlowerConstellationsSystem;
    skyRailTerminalSystem: SkyRailTerminalSystem;
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

    const asteroidFieldSystem: AsteroidFieldSystem = createAsteroidFieldSystemStub();
    const godRaySystem: GodRaySystem = createGodRaySystemStub();
    const auroraSystem: AuroraSystem = createAuroraSystemStub();
    const nebulaSystem: NebulaSystem = createNebulaSystemStub();
    const cosmicDustSystem: CosmicDustSystem = createCosmicDustSystemStub();
    const pastelNebulaSystem: PastelNebulaSystem = createPastelNebulaSystemStub();

    const biologicalSystem: BiologicalBackgroundSystem = createBiologicalSystemStub();
    const liquidMetalSystem: LiquidMetalSystem = createLiquidMetalSystemStub();
    const bossManager: BossManager = createBossManagerStub();

    const audioSystem = getAudioSystem();
    initAudioOnInteraction();
    // Restore persisted master/music/SFX levels and the reduced-audio choice.
    loadAndApplyAudioSettings();

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
    const orbManager = new OrbManager(scene, particleSystem, audioSystem, 4);

    const saveManager = getSaveManager();
    const dogController = new DogCockpitController();
    const hudManager = new HUDManager(saveManager, audioSystem);
    const juiceManager = new JuiceManager(camera, scene, particleSystem);

    const tempTarget = new THREE.Group();
    const effectManager = new EffectManager(scene, audioSystem, tempTarget);
    const magicPaintbrushSystem: MagicPaintbrushSystem = createMagicPaintbrushSystemStub();

    const powerUpHookCtx = {
        effectManager,
        audioSystem,
        dogController,
        juiceManager,
        powerUpManager: null as unknown as PowerUpManager,
        getPlayerPosition: () => player?.position,
        onHudHealthUpdate: () => {
            hudManager.updateHealth(playerState.health, playerState.maxHealth);
        },
        onHeal: () => {
            if (playerState.health >= playerState.maxHealth) return false;
            playerState.health++;
            hudManager.updateHealth(playerState.health, playerState.maxHealth);
            updateHealthDisplay(playerState);
            return true;
        },
    };

    const powerUpManager = new PowerUpManager({
        scene,
        particleSystem,
        audioSystem,
        rocket: undefined,
        onPowerUpStart: (type, config) => {
            console.log(`Power-up started: ${config.name}`);
            handlePowerUpStart(powerUpHookCtx, type, config);
        },
        onPowerUpEnd: (type, config) => {
            console.log(`Power-up ended: ${config.name}`);
            handlePowerUpEnd(powerUpHookCtx, type, config);
            if (type === PowerUpType.MAGIC_PAINTBRUSH) {
                // Read from the live GameContext, not the closed-over local: by
                // the time this fires, deferred loading may have replaced
                // `magicPaintbrushSystem` with the real (non-stub) instance.
                game.magicPaintbrushSystem.clear();
            }
        }
    });
    powerUpHookCtx.powerUpManager = powerUpManager;

    orbManager.onPowerUpReady = () => {
        const triggered = powerUpManager.collectOrb();
        if (triggered && player) {
            juiceManager.flashRainbow(0.5);
            juiceManager.burstMagic(player.position.clone());
            syncMagicalEffectsFromActive(powerUpHookCtx);
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

    const barkBlastSystem = new BarkBlastSystem({
        getCores: () => playerState.cores,
        spendCores: (amount) => {
            if (playerState.cores < amount) return false;
            playerState.cores -= amount;
            return true;
        },
        getOrbChargeProgress: () => orbManager.getPowerUpProgress(),
        spendOrbCharge: () => orbManager.spendOrbCharge(),
        onActivate: (position) => {
            // A bark blast is the dog's big moment — the excited triple yip.
            audioSystem.playDogBarkVariant('excited');
            dogController.triggerAnimation(DogAnimationState.BARK, 0.65);
            juiceManager.shakeScreen(ShakeType.MEDIUM, 0.35);
            juiceManager.burstMagic(position);
        }
    });

    const victorySystem = createVictorySystemStub();
    const tutorialSystem = createTutorialSystemStub();

    const lightningBoltSystem: LightningBoltSystem = createLightningBoltSystemStub();
    const chromaShiftSystem: ChromaShiftSystem = createChromaShiftSystemStub();
    const stormGeodeSystem: StormGeodeSystem = createStormGeodeSystemStub();
    const crystalChimeManager: CrystalChimeManager = createCrystalChimeManagerStub();
    const blackHoleSystem: BlackHoleSystem = createBlackHoleSystemStub();
    const galacticCoreSystem: GalacticCoreSystem = createGalacticCoreSystemStub();
    const dreamPortalSystem: DreamPortalSystem = createDreamPortalSystemStub();
    const wishLanternSystem: WishLanternSystem = createWishLanternSystemStub();
    const spacePetsSwarmSystem: SpacePetsSwarmSystem = createSpacePetsSwarmSystemStub();
    const weatherSystem: WeatherSystem = createWeatherSystemStub();
    const dancingJellyMossSystem: DancingJellyMossSystem = createDancingJellyMossSystemStub();
    const dynamicStarfieldSystem: DynamicStarfieldSystem = createDynamicStarfieldSystemStub();
    const dayNightCycleSystem: DayNightCycleSystem = createDayNightCycleSystemStub();
    const cloudCastlesSystem = createCloudCastlesSystemStub();
    const grappleIslesSystem = createGrappleIslesSystemStub();
    const windCurrentsSystem = createWindCurrentsSystemStub();
    const timeShiftZonesSystem = createTimeShiftZonesSystemStub();
    const candyFieldSystem: CandyFieldSystem = createCandyFieldSystemStub();
    const singingGeodeSystem: SingingGeodeSystem = createSingingGeodeSystemStub();
    const flowerConstellationsSystem: FlowerConstellationsSystem = createFlowerConstellationsSystemStub();
    const bouncePadsSystem = createBouncePadsSystemStub();
    const aerialGuardPatrolSystem = createAerialGuardPatrolSystemStub();
    const airTokensSystem = createAirTokensSystemStub();
    const spaceGardenSystem = createSpaceGardenSystemStub();
    const shootingStarsSystem = createShootingStarsSystemStub();
    const skyRailTerminalSystem = createSkyRailTerminalSystemStub();
    const gravLensManager: GravLensManager = createGravLensManagerStub();
    const derelictBuoyManager: DerelictBuoyManager = createDerelictBuoyManagerStub();
    const dataMonolithManager: DataMonolithManager = createDataMonolithManagerStub();

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
        barkBlastSystem,
        effectManager,
        magicPaintbrushSystem,
        victorySystem,
        tutorialSystem,
        lightningBoltSystem,
        chromaShiftSystem,
        stormGeodeSystem,
        crystalChimeManager,
        blackHoleSystem,
        galacticCoreSystem,
        dreamPortalSystem,
        wishLanternSystem,
        spacePetsSwarmSystem,
        weatherSystem,
        dancingJellyMossSystem,
        dynamicStarfieldSystem,
        dayNightCycleSystem,
        cloudCastlesSystem,
        grappleIslesSystem,
        windCurrentsSystem,
        timeShiftZonesSystem,
        candyFieldSystem,
        singingGeodeSystem,
        flowerConstellationsSystem,
        bouncePadsSystem,
        aerialGuardPatrolSystem,
        airTokensSystem,
        spaceGardenSystem,
        shootingStarsSystem,
        gravLensManager,
        derelictBuoyManager,
        dataMonolithManager,
        skyRailTerminalSystem
    };
}

import { scene, camera } from './scene_context';
import { weaponLightManager } from './game_systems';
import { ReEntrySystem } from './reentry';
import { WaterfallSystem } from './waterfall';
import { MeteorShowerSystem } from './meteor_shower';
import { IndustrialBackgroundSystem } from './industrial_background';
import { BiologicalBackgroundSystem } from './biological_background';
import { CosmicDustSystem } from './cosmic_dust';
import { PastelNebulaSystem } from './pastel_nebula';
import { LiquidMetalSystem } from './geological';
import { BossManager } from './boss_system';
import { PlanetaryHorizonSystem } from './planetary_horizon';
import { MoonPalaceSystem } from './moon_palace';
import { ChromaShiftSystem } from './chroma_shift';
import { StormGeodeSystem } from './storm_geodes';
import { BlackHoleSystem } from './black_hole';

export interface LevelEnvironmentSystems {
    reEntrySystem: ReEntrySystem;
    waterfallSystem: WaterfallSystem;
    meteorShowerSystem: MeteorShowerSystem;
    industrialSystem: IndustrialBackgroundSystem;
    biologicalSystem: BiologicalBackgroundSystem;
    cosmicDustSystem: CosmicDustSystem;
    pastelNebulaSystem: PastelNebulaSystem;
    liquidMetalSystem: LiquidMetalSystem;
    bossManager: BossManager;
    planetaryHorizonSystem: PlanetaryHorizonSystem;
    moonPalaceSystem: MoonPalaceSystem;
    chromaShiftSystem: ChromaShiftSystem;
    stormGeodeSystem: StormGeodeSystem;
    blackHoleSystem: BlackHoleSystem;
}

/** Construct level-heavy environment systems (async chunk entry). */
export function createLevelEnvironmentSystems(): LevelEnvironmentSystems {
    const reEntrySystem = new ReEntrySystem(scene, camera);
    const waterfallSystem = new WaterfallSystem(scene, camera, weaponLightManager);
    const meteorShowerSystem = new MeteorShowerSystem(scene, weaponLightManager);
    const industrialSystem = new IndustrialBackgroundSystem(scene, weaponLightManager);
    const biologicalSystem = new BiologicalBackgroundSystem(scene);
    const cosmicDustSystem = new CosmicDustSystem(scene, weaponLightManager);
    const pastelNebulaSystem = new PastelNebulaSystem(scene, weaponLightManager);
    const liquidMetalSystem = new LiquidMetalSystem(scene);
    const bossManager = new BossManager(scene);
    const planetaryHorizonSystem = new PlanetaryHorizonSystem(scene, camera);
    const moonPalaceSystem = new MoonPalaceSystem(scene, camera, weaponLightManager);
    const chromaShiftSystem = new ChromaShiftSystem(scene);
    const stormGeodeSystem = new StormGeodeSystem(scene);
    const blackHoleSystem = new BlackHoleSystem(scene);

    return {
        reEntrySystem,
        waterfallSystem,
        meteorShowerSystem,
        industrialSystem,
        biologicalSystem,
        cosmicDustSystem,
        pastelNebulaSystem,
        liquidMetalSystem,
        bossManager,
        planetaryHorizonSystem,
        moonPalaceSystem,
        chromaShiftSystem,
        stormGeodeSystem,
        blackHoleSystem
    };
}

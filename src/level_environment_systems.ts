import { scene, camera } from './scene_context';
import type { WeaponLightManager } from './lighting';
import type { AudioSystem } from './audio_system';
import type { LightningBoltSystem } from './lightning_bolt';
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
import { ChromaShiftSystem } from './chroma_shift';
import { StormGeodeSystem } from './storm_geodes';
import { BlackHoleSystem } from './black_hole';

export type LevelEnvironmentSystemsDeps = {
    weaponLightManager: WeaponLightManager;
    audioSystem: AudioSystem;
    lightningBoltSystem: LightningBoltSystem;
};

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
    chromaShiftSystem: ChromaShiftSystem;
    stormGeodeSystem: StormGeodeSystem;
    blackHoleSystem: BlackHoleSystem;
}

/** Construct level-heavy environment systems (async chunk entry). */
export function createLevelEnvironmentSystems(deps: LevelEnvironmentSystemsDeps): LevelEnvironmentSystems {
    const { weaponLightManager, audioSystem, lightningBoltSystem } = deps;
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
    const chromaShiftSystem = new ChromaShiftSystem(scene);
    const stormGeodeSystem = new StormGeodeSystem(scene, {
        playHit: () => audioSystem.play('hit'),
        onBoltStrike: (pos, color) => lightningBoltSystem.onBoltStrike?.(pos, color)
    });
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
        chromaShiftSystem,
        stormGeodeSystem,
        blackHoleSystem
    };
}

import { scene } from './scene_context';
import { GhostDebrisSystem } from './ghost_debris';
import { VoidJellyfishSystem } from './void_jellyfish';
import { IndustrialGeometryManager } from './industrial_geometry';
import { AquaticLifeManager } from './aquatic_life';
import { StarlightKoiManager } from './starlight_koi';
import { RainbowBubbleCoralManager } from './bubble_coral';
import { SlingableObjectSystem } from './slingable_objects';
import { ToyRocketSpawnManager } from './toy_rockets';
import type { ParticleSystem, DebrisSystem } from './particles';

export interface DeferredManagers {
    ghostDebrisSystem: GhostDebrisSystem;
    voidJellyfishSystem: VoidJellyfishSystem;
    industrialGeometryManager: IndustrialGeometryManager;
    aquaticLifeManager: AquaticLifeManager;
    starlightKoiManager: StarlightKoiManager;
    bubbleCoralManager: RainbowBubbleCoralManager;
    slingableObjectSystem: SlingableObjectSystem;
    toyRocketSpawnManager: ToyRocketSpawnManager;
}

export function createDeferredManagers(
    particleSystem: ParticleSystem,
    debrisSystem: DebrisSystem
): DeferredManagers {
    const slingableObjectSystem = new SlingableObjectSystem(scene, particleSystem, debrisSystem);

    return {
        ghostDebrisSystem: new GhostDebrisSystem(scene),
        voidJellyfishSystem: new VoidJellyfishSystem(scene),
        industrialGeometryManager: new IndustrialGeometryManager(scene),
        aquaticLifeManager: new AquaticLifeManager(scene),
        starlightKoiManager: new StarlightKoiManager(scene, particleSystem),
        bubbleCoralManager: new RainbowBubbleCoralManager(scene, particleSystem),
        slingableObjectSystem,
        toyRocketSpawnManager: new ToyRocketSpawnManager(slingableObjectSystem)
    };
}

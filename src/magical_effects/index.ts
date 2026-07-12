export {
    MagicalShaders,
    MagicalEffectType,
    MagicalEffect,
    PASTEL_RAINBOW,
    BUTTERFLY_COLORS,
    STARDUST_COLORS,
    getRainbowColor,
    lerp,
    randomRange,
    heartSDF
} from './shared';

export { RainbowTrailEffect } from './rainbow_trail';
export { ButterflySwarmEffect } from './butterfly_swarm_effect';
export { StardustFieldEffect } from './stardust_field';
export { HeartBubbleEffect } from './heart_bubble';
export { GlitterBeamEffect } from './glitter_beam';
export {
    ConfettiBurstEffect,
    HeartRainEffect,
    StarCascadeEffect,
    RainbowSpiralEffect,
    SparkleFieldEffect
} from './burst_effects';
export { EffectManager } from './effect_manager';
export {
    createRainbowTrail,
    createButterflySwarm,
    createHeartBubble,
    spawnConfettiBurst,
    spawnHeartRain,
    spawnStarCascade,
    spawnRainbowSpiral,
    spawnSparkleField,
    createHeartShape,
    sparkleNoise,
    rainbowShift,
    softGlow,
    heartShape,
    getEffectForPowerUp
} from './factories';

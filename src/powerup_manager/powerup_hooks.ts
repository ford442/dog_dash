import * as THREE from 'three';
import { PowerUpType, POWER_UP_CONFIGS, type PowerUpConfig } from './types';
import { getEffectForPowerUp } from '../magical_effects/factories';
import { MagicalEffectType } from '../magical_effects';
import { DogAnimationState } from '../dog_cockpit';
import type { EffectManager } from '../magical_effects/effect_manager';
import type { AudioPort, JuicePort } from '../ports';
import type { DogCockpitController } from '../dog_cockpit';
import type { PowerUpManager } from './manager';

export interface PowerUpHookContext {
    effectManager: EffectManager;
    audioSystem: AudioPort;
    dogController: DogCockpitController;
    juiceManager: JuicePort;
    powerUpManager: PowerUpManager;
    getPlayerPosition: () => THREE.Vector3 | undefined;
    onHudHealthUpdate?: () => void;
    /** Called when PUPPY_HUG_HUG grants +1 heart (caller owns playerState). */
    onHeal?: () => boolean;
}

const AMBIENT_EFFECTS = new Set<MagicalEffectType>([
    MagicalEffectType.CONFETTI_BURST,
    MagicalEffectType.HEART_RAIN,
    MagicalEffectType.STAR_CASCADE,
    MagicalEffectType.RAINBOW_SPIRAL,
    MagicalEffectType.SPARKLE_FIELD,
]);

const DOG_REACTIONS: Partial<Record<PowerUpType, DogAnimationState>> = {
    [PowerUpType.PUPPY_HUG_HUG]: DogAnimationState.DELIGHTED,
    [PowerUpType.FAIRY_GODMOTHER_SPARKLE]: DogAnimationState.DELIGHTED,
    [PowerUpType.BEST_FRIEND_FOREVER_AURA]: DogAnimationState.DELIGHTED,
    [PowerUpType.LULLABY_LANTERN]: DogAnimationState.CURIOUS,
    [PowerUpType.MAGIC_PAINTBRUSH]: DogAnimationState.CURIOUS,
};

function activateMagicalEffect(ctx: PowerUpHookContext, type: PowerUpType, duration: number): void {
    const magicalType = getEffectForPowerUp(type);
    if (!magicalType) return;

    if (AMBIENT_EFFECTS.has(magicalType)) {
        const pos = ctx.getPlayerPosition();
        if (!pos) return;
        switch (magicalType) {
            case MagicalEffectType.CONFETTI_BURST:
                ctx.effectManager.spawnConfettiBurst(pos);
                break;
            case MagicalEffectType.HEART_RAIN:
                ctx.effectManager.spawnHeartRain(pos, duration);
                break;
            case MagicalEffectType.STAR_CASCADE:
                ctx.effectManager.spawnStarCascade(pos, duration);
                break;
            case MagicalEffectType.RAINBOW_SPIRAL:
                ctx.effectManager.spawnRainbowSpiral(pos, duration);
                break;
            case MagicalEffectType.SPARKLE_FIELD:
                ctx.effectManager.spawnSparkleField(pos, duration);
                break;
        }
        return;
    }

    ctx.effectManager.activateEffect(magicalType, duration);
}

function grantFairyGodmotherBonus(ctx: PowerUpHookContext): void {
    const tiers: (1 | 2)[] = [1, 2];
    const tier = tiers[Math.floor(Math.random() * tiers.length)];
    const available = Object.values(POWER_UP_CONFIGS)
        .filter((c) => c.tier === tier && c.type !== PowerUpType.FAIRY_GODMOTHER_SPARKLE)
        .map((c) => c.type);

    if (available.length === 0) return;

    const grant = available[Math.floor(Math.random() * available.length)];
    window.setTimeout(() => {
        ctx.powerUpManager.activatePowerUp(grant);
        const pos = ctx.getPlayerPosition();
        if (pos) {
            ctx.juiceManager.showFloatingText('A gift!', pos, '#ffd700', 22);
        }
    }, 500);
}

export function handlePowerUpStart(ctx: PowerUpHookContext, type: PowerUpType, config: PowerUpConfig): void {
    activateMagicalEffect(ctx, type, config.duration);

    switch (type) {
        case PowerUpType.RAINBOW_COMET_TAIL:
            ctx.audioSystem.playCometActivate?.();
            ctx.juiceManager.flashRainbow?.(0.8);
            break;
        case PowerUpType.BUBBLEGUM_SHIELD:
            ctx.audioSystem.playShieldActivate?.();
            break;
        case PowerUpType.FLOWER_CROWN_BOOST:
        case PowerUpType.TWINKLE_STAR_MAGNET:
        case PowerUpType.UNICORN_HORN_BLAST:
        case PowerUpType.BUTTERFLY_ESCORT:
            break;
        case PowerUpType.PUPPY_HUG_HUG:
            if (ctx.onHeal?.()) {
                const pos = ctx.getPlayerPosition();
                if (pos) {
                    ctx.juiceManager.showFloatingText('+1 Heart!', pos.clone().add(new THREE.Vector3(0, 1.5, 0)), '#ff6699', 24);
                }
            }
            break;
        case PowerUpType.FAIRY_GODMOTHER_SPARKLE:
            grantFairyGodmotherBonus(ctx);
            ctx.juiceManager.flashRainbow?.(0.6);
            break;
        case PowerUpType.BEST_FRIEND_FOREVER_AURA:
            ctx.audioSystem.activateMagicMusic?.(config.duration * 1000);
            break;
        case PowerUpType.MAGIC_PAINTBRUSH: {
            const paintPos = ctx.getPlayerPosition();
            if (paintPos) {
                ctx.juiceManager.showFloatingText('Paint a rainbow path!', paintPos, '#ff69b4', 20);
            }
            break;
        }
        default:
            break;
    }

    ctx.audioSystem.playPowerUpCue?.(config.soundEffect);

    const dogAnim = DOG_REACTIONS[type] ?? DogAnimationState.POWER_UP;
    ctx.dogController.triggerAnimation(dogAnim, 2.0);
}

export function handlePowerUpEnd(ctx: PowerUpHookContext, type: PowerUpType, _config: PowerUpConfig): void {
    if (type === PowerUpType.BUBBLEGUM_SHIELD) {
        const pos = ctx.getPlayerPosition();
        if (pos) {
            ctx.audioSystem.playShieldBreak?.();
            ctx.juiceManager.showFloatingText('Pop!', pos, '#ff69b4', 24);
            ctx.juiceManager.burstMagic?.(pos.clone());
        }
    }
}

/** Re-activate magical effects after orb-triggered power-up (mirrors start hooks). */
export function syncMagicalEffectsFromActive(ctx: PowerUpHookContext): void {
    const active = ctx.powerUpManager.getActiveEffects();
    for (const effect of active) {
        activateMagicalEffect(ctx, effect.type, effect.duration);
    }
}

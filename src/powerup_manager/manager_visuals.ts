import * as THREE from 'three';
import { ParticleSystem } from '../particles';
import {
    PowerUpType,
    POWER_UP_CONFIGS,
    TRAIL_CONFIGS,
    mapEntriesToArray,
    mapKeysToArray,
    type PowerUpConfig,
} from './types';
import { PowerUpEffect } from './powerup_effect';
import { buildPowerUpRig, type PowerUpRig, type PowerUpRigState } from '../pickup_art/powerup_rigs';
import { decorationBudget } from '../decoration_budget';
import { disposeObject } from '../utils';

export interface PowerUpManagerVisualContext {
    scene: THREE.Scene;
    particleSystem: ParticleSystem;
    rocket?: THREE.Group;
    effectMeshes: Map<PowerUpType, THREE.Group>;
    effectLights: Map<PowerUpType, THREE.PointLight>;
    shieldMesh?: THREE.Mesh;
    flowerCrownMesh?: THREE.Group;
    starLines: THREE.Line[];
    butterflies: THREE.Group[];
    cometGlowMesh?: THREE.Mesh;
    cometTrailParticles: THREE.Mesh[];
    fairyWingsMesh?: THREE.Group;
    shieldBounceTime: number;
    /** Visual clock for the rigs (seconds, advanced by the manager's dt). */
    visualTime: number;
    activeEffects: Map<PowerUpType, PowerUpEffect>;
    hasPowerUp: (type: PowerUpType) => boolean;
}

/**
 * Attach the power-up's rig (pickup_art/powerup_rigs.ts) to the rocket.
 * Each of the 16 types has its own object and tells; see that module.
 */
export function createEffectVisuals(ctx: PowerUpManagerVisualContext, type: PowerUpType): void {
    const config = POWER_UP_CONFIGS[type];
    if (!ctx.rocket) return;

    // Re-activation refreshes the timer; keep the existing rig.
    if (ctx.effectMeshes.has(type)) return;

    const rig = buildPowerUpRig(type);
    ctx.rocket.add(rig.root);
    ctx.effectMeshes.set(type, rig.root);

    switch (type) {
        case PowerUpType.BUBBLEGUM_SHIELD:
            ctx.shieldMesh = rig.primary as THREE.Mesh;
            break;
        case PowerUpType.FLOWER_CROWN_BOOST:
            ctx.flowerCrownMesh = rig.root;
            break;
        case PowerUpType.RAINBOW_COMET_TAIL:
            ctx.cometGlowMesh = rig.primary as THREE.Mesh;
            break;
        case PowerUpType.FAIRY_DOG_WINGS:
            ctx.fairyWingsMesh = rig.root;
            break;
        case PowerUpType.BUTTERFLY_ESCORT:
            // In place: `ctx.butterflies` is the manager's own array (charges pop from it).
            ctx.butterflies.length = 0;
            ctx.butterflies.push(...(rig.butterflies ?? []));
            break;
        case PowerUpType.TWINKLE_STAR_MAGNET:
            createStarMagnetEffect(ctx, config);
            break;
    }

    createEffectLight(ctx, type, config.color);
    decorationBudget.syncCount('powerup_attachments', ctx.effectMeshes.size);
}

export function createStarMagnetEffect(ctx: PowerUpManagerVisualContext, _config: PowerUpConfig): void {
    ctx.starLines.length = 0;
}

export function createEffectLight(ctx: PowerUpManagerVisualContext, type: PowerUpType, color: number): void {
    if (!ctx.rocket) return;

    const light = new THREE.PointLight(color, 1, 10);
    light.position.set(0, 0, 0);
    ctx.rocket.add(light);
    ctx.effectLights.set(type, light);
}

/** Pose the rig for this frame: timer (expiry blink, gauges) and shield bounce. */
export function updateEffectPosition(
    ctx: PowerUpManagerVisualContext,
    type: PowerUpType,
    _rocketPosition: THREE.Vector3,
    dt = 1 / 60
): void {
    const root = ctx.effectMeshes.get(type);
    const rig = root?.userData.powerUpRig as PowerUpRig | undefined;
    if (!rig) return;
    const effect = ctx.activeEffects.get(type);
    const state: PowerUpRigState = {
        dt,
        t: ctx.visualTime,
        timeLeft: effect?.timeRemaining ?? 0,
        duration: effect?.duration ?? 1,
        bounce: type === PowerUpType.BUBBLEGUM_SHIELD ? ctx.shieldBounceTime : 0
    };
    rig.update(state);
    if (type === PowerUpType.BUBBLEGUM_SHIELD && ctx.shieldBounceTime > 0) {
        ctx.shieldBounceTime = Math.max(0, ctx.shieldBounceTime - dt);
    }
}

export function emitTrailParticles(ctx: PowerUpManagerVisualContext, rocketPosition: THREE.Vector3): void {
    mapEntriesToArray(ctx.activeEffects).forEach(([type, effect]) => {
        if (!effect.isActive) return;

        const trailConfig = TRAIL_CONFIGS[type];

        const emitPos = rocketPosition.clone();
        emitPos.x -= 1;

        let color = trailConfig.color;
        if (trailConfig.rainbow) {
            if (type === PowerUpType.RAINBOW_COMET_TAIL) {
                const rainbowColors = [0xff6b6b, 0xfeca57, 0x48dbfb, 0xff9ff3, 0x54a0ff];
                const colorIndex = Math.floor((Date.now() * 0.003) % rainbowColors.length);
                color = rainbowColors[colorIndex];
            } else {
                const hue = (Date.now() * 0.001) % 1;
                const rainbowColor = new THREE.Color().setHSL(hue, 1, 0.5);
                color = rainbowColor.getHex();
            }
        }

        ctx.particleSystem.emit(
            emitPos,
            color,
            Math.floor(trailConfig.particleCount / 10),
            1.0,
            trailConfig.particleSize,
            0.5
        );

        if (type === PowerUpType.RAINBOW_COMET_TAIL) {
            const secondaryPos = rocketPosition.clone();
            secondaryPos.x -= 1.5;
            secondaryPos.y += (Math.random() - 0.5) * 0.5;
            const pastelColors = [0xff6b6b, 0xfeca57, 0x48dbfb, 0xff9ff3, 0x54a0ff];
            const secColor = pastelColors[Math.floor((Date.now() * 0.003 + 2) % pastelColors.length)];
            ctx.particleSystem.emit(secondaryPos, secColor, 2, 0.8, 0.35, 0.4);
        }
    });
}

export function updateStarMagnetLines(ctx: PowerUpManagerVisualContext, rocketPosition?: THREE.Vector3): void {
    if (!rocketPosition) return;
    if (!ctx.hasPowerUp(PowerUpType.TWINKLE_STAR_MAGNET)) {
        ctx.starLines.forEach(line => ctx.scene.remove(line));
        ctx.starLines = [];
        return;
    }

    const config = POWER_UP_CONFIGS[PowerUpType.TWINKLE_STAR_MAGNET];

    if (ctx.starLines.length > 5) {
        const oldLine = ctx.starLines.shift();
        if (oldLine) ctx.scene.remove(oldLine);
    }

    if (Math.random() < 0.1) {
        const angle = Math.random() * Math.PI * 2;
        const length = 3 + Math.random() * 5;
        const endPos = new THREE.Vector3(
            rocketPosition.x + Math.cos(angle) * length,
            rocketPosition.y + Math.sin(angle) * length,
            rocketPosition.z
        );

        const geometry = new THREE.BufferGeometry().setFromPoints([
            rocketPosition.clone(),
            endPos
        ]);

        const material = new THREE.LineBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: 0.5
        });

        const line = new THREE.Line(geometry, material);
        ctx.scene.add(line);
        ctx.starLines.push(line);
    }

    ctx.starLines.forEach((line, index) => {
        const mat = line.material as THREE.LineBasicMaterial;
        mat.opacity -= 0.02;
        if (mat.opacity <= 0) {
            ctx.scene.remove(line);
            ctx.starLines.splice(index, 1);
        }
    });
}

export function removeEffectVisuals(ctx: PowerUpManagerVisualContext, type: PowerUpType): void {
    const mesh = ctx.effectMeshes.get(type);
    if (mesh) {
        mesh.removeFromParent();
        // Rig geometry is shared (never freed); its materials go with it.
        disposeObject(mesh);
    }
    ctx.effectMeshes.delete(type);

    const light = ctx.effectLights.get(type);
    if (light) {
        light.removeFromParent();
        light.dispose();
        ctx.effectLights.delete(type);
    }

    switch (type) {
        case PowerUpType.BUBBLEGUM_SHIELD:
            ctx.shieldMesh = undefined;
            break;
        case PowerUpType.FLOWER_CROWN_BOOST:
            ctx.flowerCrownMesh = undefined;
            break;
        case PowerUpType.RAINBOW_COMET_TAIL:
            ctx.cometGlowMesh = undefined;
            ctx.cometTrailParticles.forEach(p => {
                if (p.parent) p.parent.remove(p);
            });
            ctx.cometTrailParticles.length = 0;
            break;
        case PowerUpType.BUTTERFLY_ESCORT:
            ctx.butterflies.length = 0;
            break;
        case PowerUpType.FAIRY_DOG_WINGS:
            ctx.fairyWingsMesh = undefined;
            break;
    }
    decorationBudget.syncCount('powerup_attachments', ctx.effectMeshes.size);
}

export function cleanupAllVisuals(ctx: PowerUpManagerVisualContext): void {
    mapKeysToArray(ctx.effectMeshes).forEach((type) => {
        removeEffectVisuals(ctx, type);
    });
    ctx.starLines.forEach(line => ctx.scene.remove(line));
    ctx.starLines = [];
}

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
    shieldBounceTime: number;
    activeEffects: Map<PowerUpType, PowerUpEffect>;
    hasPowerUp: (type: PowerUpType) => boolean;
}

export function createEffectVisuals(ctx: PowerUpManagerVisualContext, type: PowerUpType): void {
    const config = POWER_UP_CONFIGS[type];

    switch (type) {
        case PowerUpType.BUBBLEGUM_SHIELD:
            createBubblegumShield(ctx, config);
            break;
        case PowerUpType.FLOWER_CROWN_BOOST:
            createFlowerCrown(ctx, config);
            break;
        case PowerUpType.TWINKLE_STAR_MAGNET:
            createStarMagnetEffect(ctx, config);
            break;
        case PowerUpType.BUTTERFLY_ESCORT:
            createButterflyEscort(ctx, config);
            break;
        case PowerUpType.RAINBOW_COMET_TAIL:
            createRainbowCometGlow(ctx, config);
            break;
        case PowerUpType.STARLIGHT_TIARA:
            createStarlightTiara(ctx, config);
            break;
    }

    createEffectLight(ctx, type, config.color);
}

export function createBubblegumShield(ctx: PowerUpManagerVisualContext, config: PowerUpConfig): void {
    if (!ctx.rocket) return;

    const geometry = new THREE.SphereGeometry(1.8, 32, 32);
    const material = new THREE.MeshPhysicalMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.4,
        roughness: 0.1,
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        side: THREE.DoubleSide
    });

    ctx.shieldMesh = new THREE.Mesh(geometry, material);
    ctx.shieldMesh.scale.set(1, 1, 0.7);

    const shieldGroup = new THREE.Group();
    shieldGroup.add(ctx.shieldMesh);
    ctx.rocket.add(shieldGroup);

    ctx.effectMeshes.set(PowerUpType.BUBBLEGUM_SHIELD, shieldGroup);
}

export function createFlowerCrown(ctx: PowerUpManagerVisualContext, config: PowerUpConfig): void {
    if (!ctx.rocket) return;

    const crownGroup = new THREE.Group();

    const petalCount = 8;
    for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2;
        const petal = new THREE.Mesh(
            new THREE.SphereGeometry(0.3, 8, 8),
            new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? config.color : config.secondaryColor,
                transparent: true,
                opacity: 0.8
            })
        );
        petal.position.set(
            Math.cos(angle) * 1.2,
            Math.sin(angle) * 1.2,
            0.5
        );
        crownGroup.add(petal);
    }

    ctx.flowerCrownMesh = crownGroup;
    ctx.rocket.add(crownGroup);

    ctx.effectMeshes.set(PowerUpType.FLOWER_CROWN_BOOST, crownGroup);
}

export function createStarMagnetEffect(ctx: PowerUpManagerVisualContext, _config: PowerUpConfig): void {
    ctx.starLines = [];
}

export function createButterflyEscort(ctx: PowerUpManagerVisualContext, config: PowerUpConfig): void {
    if (!ctx.rocket) return;

    const butterflyCount = 6;
    for (let i = 0; i < butterflyCount; i++) {
        const butterfly = new THREE.Group();

        const wingGeo = new THREE.CircleGeometry(0.2, 6);
        const wingMat = new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? config.color : config.secondaryColor,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });

        const leftWing = new THREE.Mesh(wingGeo, wingMat);
        leftWing.position.x = -0.15;
        leftWing.rotation.y = 0.3;

        const rightWing = new THREE.Mesh(wingGeo, wingMat);
        rightWing.position.x = 0.15;
        rightWing.rotation.y = -0.3;

        butterfly.add(leftWing);
        butterfly.add(rightWing);

        const angle = (i / butterflyCount) * Math.PI * 2;
        butterfly.userData = {
            orbitAngle: angle,
            orbitRadius: 2 + Math.random() * 0.5,
            orbitSpeed: 1 + Math.random() * 0.5,
            wingSpeed: 10 + Math.random() * 5
        };

        ctx.rocket.add(butterfly);
        ctx.butterflies.push(butterfly);
    }

    if (ctx.butterflies.length > 0 && ctx.butterflies[0].parent) {
        const parentGroup = new THREE.Group();
        parentGroup.name = 'butterfly_escort_container';
        ctx.effectMeshes.set(PowerUpType.BUTTERFLY_ESCORT, parentGroup);
    }
}

export function createStarlightTiara(ctx: PowerUpManagerVisualContext, config: PowerUpConfig): void {
    if (!ctx.rocket) return;

    const tiaraGroup = new THREE.Group();

    const spikeCount = 5;
    for (let i = 0; i < spikeCount; i++) {
        const height = i === 2 ? 0.6 : 0.3;
        const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.1, height, 8),
            new THREE.MeshBasicMaterial({
                color: config.color,
                transparent: true,
                opacity: 0.9
            })
        );
        spike.position.set((i - 2) * 0.3, 1.5 + height / 2, 0);
        tiaraGroup.add(spike);

        const gem = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.08),
            new THREE.MeshBasicMaterial({ color: config.secondaryColor })
        );
        gem.position.set((i - 2) * 0.3, 1.5 + height, 0);
        tiaraGroup.add(gem);
    }

    ctx.rocket.add(tiaraGroup);
    ctx.effectMeshes.set(PowerUpType.STARLIGHT_TIARA, tiaraGroup);
}

export function createRainbowCometGlow(ctx: PowerUpManagerVisualContext, config: PowerUpConfig): void {
    if (!ctx.rocket) return;

    const geometry = new THREE.SphereGeometry(1.5, 16, 16);
    const material = new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });

    ctx.cometGlowMesh = new THREE.Mesh(geometry, material);
    ctx.rocket.add(ctx.cometGlowMesh);

    const glowGroup = new THREE.Group();
    glowGroup.add(ctx.cometGlowMesh);
    ctx.effectMeshes.set(PowerUpType.RAINBOW_COMET_TAIL, glowGroup);
}

export function createEffectLight(ctx: PowerUpManagerVisualContext, type: PowerUpType, color: number): void {
    if (!ctx.rocket) return;

    const light = new THREE.PointLight(color, 1, 10);
    light.position.set(0, 0, 0);
    ctx.rocket.add(light);
    ctx.effectLights.set(type, light);
}

export function updateEffectPosition(ctx: PowerUpManagerVisualContext, type: PowerUpType, _rocketPosition: THREE.Vector3): void {
    switch (type) {
        case PowerUpType.BUBBLEGUM_SHIELD:
            if (ctx.shieldMesh) {
                const now = Date.now() * 0.001;
                let scale = 1 + Math.sin(now * 3) * 0.06;
                ctx.shieldMesh.rotation.z = Math.sin(now * 2.5) * 0.08;
                ctx.shieldMesh.rotation.x = Math.cos(now * 1.8) * 0.05;
                if (ctx.shieldBounceTime > 0) {
                    const bounce = Math.sin(ctx.shieldBounceTime * Math.PI * 8) * 0.25 * ctx.shieldBounceTime;
                    scale += bounce;
                    ctx.shieldBounceTime -= 0.016;
                    if (ctx.shieldBounceTime < 0) ctx.shieldBounceTime = 0;
                }
                ctx.shieldMesh.scale.set(scale, scale, scale * 0.7);
            }
            break;
        case PowerUpType.FLOWER_CROWN_BOOST:
            if (ctx.flowerCrownMesh) {
                ctx.flowerCrownMesh.rotation.z += 0.02;
            }
            break;
        case PowerUpType.RAINBOW_COMET_TAIL:
            if (ctx.cometGlowMesh) {
                const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.15;
                ctx.cometGlowMesh.scale.set(pulse, pulse, pulse);
                const pastelColors = [0xff6b6b, 0xfeca57, 0x48dbfb, 0xff9ff3, 0x54a0ff];
                const colorIndex = Math.floor((Date.now() * 0.002) % pastelColors.length);
                (ctx.cometGlowMesh.material as THREE.MeshBasicMaterial).color.setHex(pastelColors[colorIndex]);
            }
            break;
        case PowerUpType.BUTTERFLY_ESCORT:
            ctx.butterflies.forEach(butterfly => {
                const data = butterfly.userData;
                data.orbitAngle += data.orbitSpeed * 0.02;
                butterfly.position.x = Math.cos(data.orbitAngle) * data.orbitRadius;
                butterfly.position.y = Math.sin(data.orbitAngle) * data.orbitRadius;
                butterfly.position.z = Math.sin(data.orbitAngle * 2) * 0.5;

                butterfly.children[0].rotation.y = 0.3 + Math.sin(Date.now() * 0.01 * data.wingSpeed) * 0.3;
                butterfly.children[1].rotation.y = -0.3 - Math.sin(Date.now() * 0.01 * data.wingSpeed) * 0.3;
            });
            break;
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
    if (mesh && ctx.rocket) {
        ctx.rocket.remove(mesh);
    }
    ctx.effectMeshes.delete(type);

    const light = ctx.effectLights.get(type);
    if (light && ctx.rocket) {
        ctx.rocket.remove(light);
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
            ctx.cometTrailParticles = [];
            break;
        case PowerUpType.BUTTERFLY_ESCORT:
            ctx.butterflies.forEach(b => {
                if (b.parent) b.parent.remove(b);
            });
            ctx.butterflies = [];
            break;
    }
}

export function cleanupAllVisuals(ctx: PowerUpManagerVisualContext): void {
    mapKeysToArray(ctx.effectMeshes).forEach((type) => {
        removeEffectVisuals(ctx, type);
    });
    ctx.starLines.forEach(line => ctx.scene.remove(line));
    ctx.starLines = [];
}

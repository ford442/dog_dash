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
    fairyWingsMesh?: THREE.Group;
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
        case PowerUpType.FAIRY_DOG_WINGS:
            createFairyDogWings(ctx, config);
            break;
        case PowerUpType.DREAM_CLOUD_CARPET:
            createDreamCloudCarpet(ctx, config);
            break;
        case PowerUpType.LULLABY_LANTERN:
            createLullabyLantern(ctx, config);
            break;
        case PowerUpType.PUPPY_HUG_HUG:
            createPuppyHugAura(ctx, config);
            break;
        case PowerUpType.MOONBEAM_SLIDE:
            createMoonbeamSlide(ctx, config);
            break;
        case PowerUpType.FAIRY_GODMOTHER_SPARKLE:
            createFairyGodmotherSparkle(ctx, config);
            break;
        case PowerUpType.CANDY_CANE_VORTEX:
            createCandyCaneVortex(ctx, config);
            break;
        case PowerUpType.MAGIC_PAINTBRUSH:
            createMagicPaintbrush(ctx, config);
            break;
        case PowerUpType.BEST_FRIEND_FOREVER_AURA:
            createBestFriendAura(ctx, config);
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

// Cache geometry and material for fairy wings to prevent VRAM leaks
let sharedFairyWingGeometry: THREE.ShapeGeometry | null = null;
let sharedFairyWingMaterial: THREE.MeshBasicMaterial | null = null;

export function createFairyDogWings(ctx: PowerUpManagerVisualContext, config: PowerUpConfig): void {
    if (!ctx.rocket) return;

    const wingsGroup = new THREE.Group();
    wingsGroup.position.set(-0.5, 0.5, 0); // Position slightly behind and above

    if (!sharedFairyWingGeometry) {
        // Basic procedural butterfly wing shapes
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(1.5, 1.5, 1.5, 0.5);
        shape.quadraticCurveTo(2.0, -0.5, 1.0, -1.0);
        shape.quadraticCurveTo(0.2, -1.5, 0, 0);
        sharedFairyWingGeometry = new THREE.ShapeGeometry(shape);
    }

    if (!sharedFairyWingMaterial) {
        sharedFairyWingMaterial = new THREE.MeshBasicMaterial({
            color: config.color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
            depthWrite: false
        });
    }

    // Left wing
    const leftWing = new THREE.Mesh(sharedFairyWingGeometry, sharedFairyWingMaterial);
    leftWing.position.set(0, 0, 0.5);
    leftWing.rotation.x = Math.PI / 4;
    leftWing.scale.set(0.6, 0.6, 0.6);
    wingsGroup.add(leftWing);

    // Right wing
    const rightWing = new THREE.Mesh(sharedFairyWingGeometry, sharedFairyWingMaterial);
    rightWing.position.set(0, 0, -0.5);
    rightWing.rotation.x = -Math.PI / 4;
    rightWing.scale.set(0.6, 0.6, 0.6);
    wingsGroup.add(rightWing);

    ctx.fairyWingsMesh = wingsGroup;
    ctx.rocket.add(wingsGroup);
    ctx.effectMeshes.set(PowerUpType.FAIRY_DOG_WINGS, wingsGroup);
}

export function createDreamCloudCarpet(ctx: PowerUpManagerVisualContext, config: PowerUpConfig): void {
    if (!ctx.rocket) return;

    const carpetGroup = new THREE.Group();
    carpetGroup.position.set(0, -1.2, 0);

    const puffCount = 5;
    for (let i = 0; i < puffCount; i++) {
        const puff = new THREE.Mesh(
            new THREE.SphereGeometry(0.5 + Math.random() * 0.2, 8, 8),
            new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? config.color : config.secondaryColor,
                transparent: true,
                opacity: 0.7,
            })
        );
        puff.position.set((i - 2) * 0.55, Math.sin(i) * 0.1, (Math.random() - 0.5) * 0.3);
        carpetGroup.add(puff);
    }

    const rainbowStrip = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 0.25),
        new THREE.MeshBasicMaterial({
            color: 0xffb6c1,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
        })
    );
    rainbowStrip.rotation.x = -Math.PI / 2;
    rainbowStrip.position.y = 0.15;
    carpetGroup.add(rainbowStrip);

    ctx.rocket.add(carpetGroup);
    ctx.effectMeshes.set(PowerUpType.DREAM_CLOUD_CARPET, carpetGroup);
}

export function createLullabyLantern(ctx: PowerUpManagerVisualContext, config: PowerUpConfig): void {
    if (!ctx.rocket) return;

    const lanternGroup = new THREE.Group();
    lanternGroup.position.set(0.8, 1.2, 0.5);

    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.3, 0.5, 8),
        new THREE.MeshBasicMaterial({ color: config.color, transparent: true, opacity: 0.9 })
    );
    lanternGroup.add(body);

    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 8),
        new THREE.MeshBasicMaterial({
            color: config.secondaryColor,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
        })
    );
    glow.position.y = 0.1;
    lanternGroup.add(glow);

    const tassel = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.25, 6),
        new THREE.MeshBasicMaterial({ color: 0xff4500 })
    );
    tassel.position.y = -0.35;
    lanternGroup.add(tassel);

    ctx.rocket.add(lanternGroup);
    ctx.effectMeshes.set(PowerUpType.LULLABY_LANTERN, lanternGroup);
}

export function createPuppyHugAura(ctx: PowerUpManagerVisualContext, config: PowerUpConfig): void {
    if (!ctx.rocket) return;

    const auraGroup = new THREE.Group();
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.6, 0.12, 8, 24),
        new THREE.MeshBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
        })
    );
    auraGroup.add(ring);

    const heart = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 8, 8),
        new THREE.MeshBasicMaterial({ color: config.secondaryColor })
    );
    heart.position.set(0, 1.4, 0.3);
    heart.scale.set(1.2, 1, 0.8);
    auraGroup.add(heart);

    ctx.rocket.add(auraGroup);
    ctx.effectMeshes.set(PowerUpType.PUPPY_HUG_HUG, auraGroup);
}

export function createMoonbeamSlide(ctx: PowerUpManagerVisualContext, config: PowerUpConfig): void {
    if (!ctx.rocket) return;

    const slideGroup = new THREE.Group();
    slideGroup.position.set(-1.5, -0.3, 0);

    const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.25, 3, 8),
        new THREE.MeshBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
        })
    );
    beam.rotation.z = Math.PI / 2;
    slideGroup.add(beam);

    const tip = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.2),
        new THREE.MeshBasicMaterial({ color: config.secondaryColor })
    );
    tip.position.set(-1.6, 0, 0);
    slideGroup.add(tip);

    ctx.rocket.add(slideGroup);
    ctx.effectMeshes.set(PowerUpType.MOONBEAM_SLIDE, slideGroup);
}

export function createFairyGodmotherSparkle(ctx: PowerUpManagerVisualContext, config: PowerUpConfig): void {
    if (!ctx.rocket) return;

    const fairyGroup = new THREE.Group();
    fairyGroup.position.set(1.2, 1.5, 0.4);

    const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshBasicMaterial({ color: config.secondaryColor })
    );
    fairyGroup.add(body);

    const wings = new THREE.Mesh(
        new THREE.CircleGeometry(0.35, 6),
        new THREE.MeshBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
        })
    );
    wings.rotation.y = Math.PI / 2;
    fairyGroup.add(wings);

    const wand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffd700 })
    );
    wand.position.set(0.25, -0.1, 0);
    wand.rotation.z = -0.5;
    fairyGroup.add(wand);

    ctx.rocket.add(fairyGroup);
    ctx.effectMeshes.set(PowerUpType.FAIRY_GODMOTHER_SPARKLE, fairyGroup);
}

export function createCandyCaneVortex(ctx: PowerUpManagerVisualContext, config: PowerUpConfig): void {
    if (!ctx.rocket) return;

    const vortexGroup = new THREE.Group();

    const stripeCount = 6;
    for (let i = 0; i < stripeCount; i++) {
        const angle = (i / stripeCount) * Math.PI * 2;
        const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 1.8, 0.15),
            new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? config.color : config.secondaryColor,
                transparent: true,
                opacity: 0.8,
            })
        );
        stripe.position.set(Math.cos(angle) * 1.2, Math.sin(angle) * 1.2, 0);
        stripe.rotation.z = angle;
        vortexGroup.add(stripe);
    }

    ctx.rocket.add(vortexGroup);
    ctx.effectMeshes.set(PowerUpType.CANDY_CANE_VORTEX, vortexGroup);
}

export function createMagicPaintbrush(ctx: PowerUpManagerVisualContext, config: PowerUpConfig): void {
    if (!ctx.rocket) return;

    const brushGroup = new THREE.Group();
    brushGroup.position.set(0.6, 0.2, 0.8);

    const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6),
        new THREE.MeshBasicMaterial({ color: 0x8b4513 })
    );
    handle.rotation.z = Math.PI / 4;
    brushGroup.add(handle);

    const bristles = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.2, 8),
        new THREE.MeshBasicMaterial({ color: config.color })
    );
    bristles.position.set(0.2, 0.2, 0);
    bristles.rotation.z = Math.PI / 4;
    brushGroup.add(bristles);

    const tipGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 6),
        new THREE.MeshBasicMaterial({
            color: config.secondaryColor,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
        })
    );
    tipGlow.position.set(0.28, 0.28, 0);
    brushGroup.add(tipGlow);

    ctx.rocket.add(brushGroup);
    ctx.effectMeshes.set(PowerUpType.MAGIC_PAINTBRUSH, brushGroup);
}

export function createBestFriendAura(ctx: PowerUpManagerVisualContext, config: PowerUpConfig): void {
    if (!ctx.rocket) return;

    const auraGroup = new THREE.Group();

    const innerRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.4, 0.08, 8, 32),
        new THREE.MeshBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
        })
    );
    auraGroup.add(innerRing);

    const outerRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.9, 0.05, 8, 32),
        new THREE.MeshBasicMaterial({
            color: config.secondaryColor,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
        })
    );
    auraGroup.add(outerRing);

    ctx.rocket.add(auraGroup);
    ctx.effectMeshes.set(PowerUpType.BEST_FRIEND_FOREVER_AURA, auraGroup);
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
        case PowerUpType.FAIRY_DOG_WINGS:
            if (ctx.fairyWingsMesh) {
                const now = Date.now() * 0.008;
                const leftWing = ctx.fairyWingsMesh.children[0];
                const rightWing = ctx.fairyWingsMesh.children[1];

                if (leftWing && rightWing) {
                    const flapAngle = Math.sin(now) * 0.6;
                    leftWing.rotation.x = Math.PI / 4 + flapAngle;
                    rightWing.rotation.x = -(Math.PI / 4 + flapAngle);
                }
            }
            break;
        case PowerUpType.STARLIGHT_TIARA: {
            const tiara = ctx.effectMeshes.get(PowerUpType.STARLIGHT_TIARA);
            if (tiara) {
                const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.08;
                tiara.scale.set(pulse, pulse, pulse);
                tiara.rotation.y = Math.sin(Date.now() * 0.002) * 0.15;
            }
            break;
        }
        case PowerUpType.DREAM_CLOUD_CARPET: {
            const carpet = ctx.effectMeshes.get(PowerUpType.DREAM_CLOUD_CARPET);
            if (carpet) {
                carpet.position.y = -1.2 + Math.sin(Date.now() * 0.003) * 0.15;
            }
            break;
        }
        case PowerUpType.LULLABY_LANTERN: {
            const lantern = ctx.effectMeshes.get(PowerUpType.LULLABY_LANTERN);
            if (lantern) {
                lantern.rotation.z = Math.sin(Date.now() * 0.002) * 0.12;
                const glow = lantern.children[1];
                if (glow) {
                    const s = 1 + Math.sin(Date.now() * 0.005) * 0.15;
                    glow.scale.set(s, s, s);
                }
            }
            break;
        }
        case PowerUpType.PUPPY_HUG_HUG:
        case PowerUpType.BEST_FRIEND_FOREVER_AURA: {
            const aura = ctx.effectMeshes.get(type);
            if (aura) {
                const pulse = 1 + Math.sin(Date.now() * 0.004) * 0.1;
                aura.scale.set(pulse, pulse, pulse);
                aura.rotation.z += 0.015;
            }
            break;
        }
        case PowerUpType.MOONBEAM_SLIDE: {
            const slide = ctx.effectMeshes.get(PowerUpType.MOONBEAM_SLIDE);
            if (slide) {
                slide.children[0].scale.x = 1 + Math.sin(Date.now() * 0.008) * 0.2;
            }
            break;
        }
        case PowerUpType.FAIRY_GODMOTHER_SPARKLE: {
            const fairy = ctx.effectMeshes.get(PowerUpType.FAIRY_GODMOTHER_SPARKLE);
            if (fairy) {
                fairy.position.y = 1.5 + Math.sin(Date.now() * 0.005) * 0.2;
                fairy.rotation.y += 0.03;
            }
            break;
        }
        case PowerUpType.CANDY_CANE_VORTEX: {
            const vortex = ctx.effectMeshes.get(PowerUpType.CANDY_CANE_VORTEX);
            if (vortex) {
                vortex.rotation.z += 0.06;
            }
            break;
        }
        case PowerUpType.MAGIC_PAINTBRUSH: {
            const brush = ctx.effectMeshes.get(PowerUpType.MAGIC_PAINTBRUSH);
            if (brush) {
                brush.rotation.z = Math.sin(Date.now() * 0.006) * 0.2;
            }
            break;
        }
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
        case PowerUpType.FAIRY_DOG_WINGS:
            if (ctx.fairyWingsMesh && ctx.fairyWingsMesh.parent) {
                ctx.fairyWingsMesh.parent.remove(ctx.fairyWingsMesh);
            }
            ctx.fairyWingsMesh = undefined;
            break;
        case PowerUpType.STARLIGHT_TIARA:
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

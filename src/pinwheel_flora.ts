/**
 * Twirling Pinwheel Flowers / Star Windmills
 * Decorative mid-ground flora with spinning pastel blades, wind gusts,
 * and optional playful pushes when the player clips through.
 */

import * as THREE from 'three';
import { ParticleSystem } from './particles';
import { DEPTH_LAYERS, randomZInRange } from './depth_layers';
import { createCandyGloss, setCandyBaseColor, setCandyEmissive } from './candy_materials';

const PASTEL_PALETTES = [
    [0xffb6c1, 0xffc0cb, 0xffe4e1, 0xfff0f5], // pink candy
    [0xb6e3ff, 0xc8f0ff, 0xe6f7ff, 0xf0f8ff], // sky blue
    [0xffe4b5, 0xfff8dc, 0xffefd5, 0xfffacd], // buttercream
    [0xd8b4fe, 0xe9d5ff, 0xf3e8ff, 0xfae8ff], // lavender
    [0xa7f3d0, 0xbbf7d0, 0xd1fae5, 0xecfdf5], // mint
    [0xfde68a, 0xfef08a, 0xfff7ae, 0xffffe0]  // star yellow
] as const;

const _color = new THREE.Color();
const _tipColor = new THREE.Color();
const _force = new THREE.Vector3();

/** Shared meshes — cloned materials per instance for hue cycling. */
const BLADE_GEOMETRY = new THREE.PlaneGeometry(0.42, 2.0, 1, 3);
BLADE_GEOMETRY.translate(0, 1.0, 0);
const HUB_GEOMETRY = new THREE.SphereGeometry(0.2, 10, 10);
const STEM_GEOMETRY = new THREE.CylinderGeometry(0.035, 0.055, 1.0, 6);
const HEART_GEOMETRY = new THREE.SphereGeometry(0.1, 8, 8);

export interface PinwheelInteraction {
    type: 'blade_clip' | 'wind_gust' | 'hub_collect';
    position: THREE.Vector3;
    force: THREE.Vector3;
    scoreBonus?: number;
}

interface BladePart {
    mesh: THREE.Mesh;
    baseColor: number;
    tipColor: number;
}

export class PinwheelFlower {
    readonly group: THREE.Group;
    readonly position: THREE.Vector3;
    readonly outerRadius: number;
    readonly hubRadius: number;
    readonly spinSpeed: number;
    readonly hasHubCollectible: boolean;

    private bobGroup: THREE.Group;
    private rotator: THREE.Group;
    private blades: BladePart[] = [];
    private hubMesh: THREE.Mesh;
    private heartMesh: THREE.Mesh | null = null;
    private scene: THREE.Scene;
    private time = 0;
    private spinAngle = 0;
    private gustTimer = 0;
    private clipCooldown = 0;
    private hubCollected = false;
    private baseY: number;
    private phase: number;
    private wobblePhase: number;

    constructor(
        scene: THREE.Scene,
        x: number,
        y: number,
        z: number,
        options?: {
            bladeCount?: number;
            scale?: number;
            spinSpeed?: number;
            paletteIndex?: number;
            hasHubCollectible?: boolean;
        }
    ) {
        this.scene = scene;
        this.position = new THREE.Vector3(x, y, z);
        this.baseY = y;
        this.phase = Math.random() * Math.PI * 2;
        this.wobblePhase = Math.random() * Math.PI * 2;

        const scale = options?.scale ?? (0.85 + Math.random() * 0.55);
        const bladeCount = options?.bladeCount ?? (4 + Math.floor(Math.random() * 3));
        this.spinSpeed = options?.spinSpeed ?? (0.6 + Math.random() * 2.8) * (Math.random() < 0.5 ? 1 : -1);
        this.outerRadius = 1.05 * scale;
        this.hubRadius = 0.22 * scale;
        this.hasHubCollectible = options?.hasHubCollectible ?? Math.random() < 0.15;

        const palette = PASTEL_PALETTES[options?.paletteIndex ?? Math.floor(Math.random() * PASTEL_PALETTES.length)];

        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.scale.setScalar(scale);
        this.group.userData.speciesId = 'pinwheelFlower';

        this.bobGroup = new THREE.Group();
        this.group.add(this.bobGroup);

        const stemMat = new THREE.MeshStandardMaterial({
            color: 0x7cb87c,
            roughness: 0.85,
            metalness: 0.05
        });
        const stem = new THREE.Mesh(STEM_GEOMETRY, stemMat);
        stem.position.y = -0.55;
        this.bobGroup.add(stem);

        this.rotator = new THREE.Group();
        this.bobGroup.add(this.rotator);

        for (let i = 0; i < bladeCount; i++) {
            const angle = (i / bladeCount) * Math.PI * 2;
            const baseColor = palette[i % palette.length];
            const tipColor = palette[(i + 1) % palette.length];

            const bladeMat = createCandyGloss(baseColor, {
                emissive: baseColor,
                emissiveIntensity: 0.35,
                roughness: 0.45,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.92
            });

            const blade = new THREE.Mesh(BLADE_GEOMETRY, bladeMat);
            blade.rotation.z = angle;
            blade.scale.set(0.75 + Math.random() * 0.2, 0.9 + Math.random() * 0.25, 1);
            this.rotator.add(blade);
            this.blades.push({ mesh: blade, baseColor, tipColor });
        }

        const hubMat = createCandyGloss(0xfff5ee, {
            emissive: 0xffd9a8,
            emissiveIntensity: 0.5,
            roughness: 0.35,
            cacheKey: 'pinwheel_hub'
        });
        this.hubMesh = new THREE.Mesh(HUB_GEOMETRY, hubMat);
        this.rotator.add(this.hubMesh);

        if (this.hasHubCollectible) {
            const heartMat = new THREE.MeshStandardMaterial({
                color: 0xff69b4,
                emissive: 0xff1493,
                emissiveIntensity: 0.9,
                roughness: 0.25
            });
            this.heartMesh = new THREE.Mesh(HEART_GEOMETRY, heartMat);
            this.heartMesh.scale.set(1.1, 0.9, 0.5);
            this.hubMesh.add(this.heartMesh);
        }

        const glow = new THREE.PointLight(0xffeedd, 0.35, 5);
        glow.position.set(0, 0.2, 0.3);
        this.bobGroup.add(glow);

        scene.add(this.group);
    }

    update(dt: number, time: number): PinwheelInteraction | null {
        this.time += dt;
        this.clipCooldown = Math.max(0, this.clipCooldown - dt);
        this.gustTimer += dt;

        this.spinAngle += this.spinSpeed * dt;
        this.rotator.rotation.z = this.spinAngle;

        const bob = Math.sin(time * 1.1 + this.phase) * 0.22;
        const wobbleX = Math.sin(time * 0.85 + this.wobblePhase) * 0.06;
        const wobbleZ = Math.cos(time * 0.7 + this.phase) * 0.05;
        this.bobGroup.position.set(wobbleX, bob, wobbleZ);
        this.bobGroup.rotation.x = Math.sin(time * 0.6 + this.phase) * 0.05;
        this.bobGroup.rotation.y = Math.cos(time * 0.5 + this.wobblePhase) * 0.04;

        const hueShift = (Math.sin(time * 0.9 + this.phase) + 1) * 0.5;
        for (const blade of this.blades) {
            _color.setHex(blade.baseColor);
            _tipColor.setHex(blade.tipColor);
            _color.lerp(_tipColor, hueShift);
            setCandyBaseColor(blade.mesh.material, _color.getHex());
            setCandyEmissive(blade.mesh.material, _color.getHex(), 0.28 + hueShift * 0.35);
        }

        if (this.heartMesh && !this.hubCollected) {
            const pulse = 1 + Math.sin(time * 5 + this.phase) * 0.15;
            this.heartMesh.scale.set(1.1 * pulse, 0.9 * pulse, 0.5);
        }

        let interaction: PinwheelInteraction | null = null;
        if (this.gustTimer >= 1.4 + (Math.abs(this.spinSpeed) * 0.15)) {
            this.gustTimer = 0;
            const gustPos = this.group.position.clone();
            gustPos.y += bob;
            const tangent = this.spinSpeed > 0 ? 1 : -1;
            interaction = {
                type: 'wind_gust',
                position: gustPos,
                force: new THREE.Vector3(1.2, tangent * 0.8, 0)
            };
        }

        return interaction;
    }

    /** Distance-based blade clip — returns push force if player intersects the spin disc. */
    checkPlayerClip(playerPos: THREE.Vector3): PinwheelInteraction | null {
        if (this.clipCooldown > 0) return null;

        const worldY = this.group.position.y + this.bobGroup.position.y;
        const dy = playerPos.y - worldY;
        const dz = playerPos.z - this.position.z;
        const dx = playerPos.x - this.position.x;

        const planarDist = Math.sqrt(dy * dy + dz * dz);
        const depthOk = Math.abs(dx) < 2.8;

        if (!depthOk || planarDist > this.outerRadius * this.group.scale.x || planarDist < this.hubRadius * 0.35) {
            return null;
        }

        this.clipCooldown = 0.35;

        const spinDir = Math.sign(this.spinSpeed) || 1;
        const falloff = 1 - planarDist / (this.outerRadius * this.group.scale.x);
        _force.set(
            -spinDir * 1.8 * falloff,
            spinDir * 5.5 * falloff,
            -dz * 1.2 * falloff
        );

        const hitPos = playerPos.clone();

        if (this.hasHubCollectible && !this.hubCollected && planarDist < this.hubRadius * 1.4) {
            this.hubCollected = true;
            if (this.heartMesh) this.heartMesh.visible = false;
            return {
                type: 'hub_collect',
                position: this.group.position.clone(),
                force: _force.clone(),
                scoreBonus: 12
            };
        }

        return {
            type: 'blade_clip',
            position: hitPos,
            force: _force.clone()
        };
    }

    getWorldPosition(): THREE.Vector3 {
        const p = this.group.position.clone();
        p.y += this.bobGroup.position.y;
        return p;
    }

    destroy(): void {
        this.scene.remove(this.group);
        this.group.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material?.dispose();
                }
            }
        });
    }
}

/**
 * Manages twirling pinwheel flowers across a level span.
 * Density is "per 100 world units" (same spirit as gummyRingDensity).
 */
export class PinwheelFloraManager {
    private scene: THREE.Scene;
    private particles: ParticleSystem | null;
    private pinwheels: PinwheelFlower[] = [];

    constructor(scene: THREE.Scene, particles: ParticleSystem | null = null) {
        this.scene = scene;
        this.particles = particles;
    }

    /** Seed pinwheels across a level segment. */
    spawnField(
        startX: number,
        length: number,
        density: number,
        yRange: [number, number] = [-16, 16],
        zRange: [number, number] = [DEPTH_LAYERS.MIDGROUND.min, DEPTH_LAYERS.NEAR.max]
    ): void {
        const count = Math.max(0, Math.floor(length * density * 0.14));
        for (let i = 0; i < count; i++) {
            const x = startX + 30 + Math.random() * Math.max(40, length - 60);
            const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
            const z = randomZInRange(zRange);
            this.spawnPinwheel(x, y, z);
        }
    }

    /** Stream a chunk ahead of the player (called from level populateZone). */
    streamChunk(
        startX: number,
        width: number,
        density: number,
        yRange: [number, number] = [-16, 16]
    ): void {
        if (density <= 0 || width <= 0) return;
        const count = Math.max(0, Math.floor(width * density * 0.12));
        for (let i = 0; i < count; i++) {
            const x = startX + Math.random() * width;
            const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
            const layerRoll = Math.random();
            const z = layerRoll < 0.35
                ? randomZInRange([DEPTH_LAYERS.BACKGROUND.min, DEPTH_LAYERS.BACKGROUND.max])
                : layerRoll < 0.75
                    ? randomZInRange([DEPTH_LAYERS.MIDGROUND.min, DEPTH_LAYERS.MIDGROUND.max])
                    : randomZInRange([DEPTH_LAYERS.NEAR.min, DEPTH_LAYERS.NEAR.max]);
            this.spawnPinwheel(x, y, z);
        }
    }

    spawnPinwheel(x: number, y: number, z: number): PinwheelFlower {
        const flower = new PinwheelFlower(this.scene, x, y, z);
        this.pinwheels.push(flower);
        return flower;
    }

    update(dt: number, time: number, playerPos?: THREE.Vector3): PinwheelInteraction[] {
        const results: PinwheelInteraction[] = [];

        for (const pinwheel of this.pinwheels) {
            const ambient = pinwheel.update(dt, time);
            if (ambient) {
                if (ambient.type === 'wind_gust' && this.particles) {
                    const tangent = pinwheel.spinSpeed > 0 ? 1 : -1;
                    this.particles.emit(ambient.position, 0xffe4f3, 4, 2.2, 0.15, 0.5);
                    this.particles.emit(
                        ambient.position.clone().add(new THREE.Vector3(0.4, tangent * 0.3, 0)),
                        0xffffff,
                        3,
                        1.8,
                        0.1,
                        0.35
                    );
                }
            }

            if (playerPos) {
                const clip = pinwheel.checkPlayerClip(playerPos);
                if (clip) {
                    results.push(clip);
                    if (this.particles) {
                        const swirlColor = clip.type === 'hub_collect' ? 0xff69b4 : 0xffd9ec;
                        this.particles.emit(clip.position, swirlColor, 10, 3.5, 0.35, 1.0);
                        this.particles.emit(clip.position, 0xffffff, 6, 2.5, 0.2, 0.7);
                    }
                }
            }
        }

        return results;
    }

    cleanupFarBehind(playerX: number, buffer: number = 90): void {
        for (let i = this.pinwheels.length - 1; i >= 0; i--) {
            if (this.pinwheels[i].position.x < playerX - buffer) {
                this.pinwheels[i].destroy();
                this.pinwheels.splice(i, 1);
            }
        }
    }

    clear(): void {
        for (const p of this.pinwheels) {
            p.destroy();
        }
        this.pinwheels = [];
    }

    getCount(): number {
        return this.pinwheels.length;
    }
}

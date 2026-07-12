import * as THREE from 'three';
import { CandyFlavor, CANDY_COLORS } from './shared';

function createGummyStripeTexture(primary: number, secondary: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const bands = 6;
    for (let i = 0; i < bands; i++) {
        ctx.fillStyle = i % 2 === 0
            ? '#' + primary.toString(16).padStart(6, '0')
            : '#' + secondary.toString(16).padStart(6, '0');
        ctx.fillRect(0, (i / bands) * 128, 128, 128 / bands);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    return tex;
}

export class GummyRing {
    group: THREE.Group;
    position: THREE.Vector3;
    flavor: CandyFlavor;
    active = true;

    readonly innerRadius: number;
    readonly outerRadius: number;
    readonly tubeRadius: number;

    health = 2;
    threadAwarded = false;
    private time = 0;
    private baseY: number;
    private baseScale = new THREE.Vector3(1, 1, 1);
    private squashTimer = 0;
    private squashActive = false;
    private rotSpeedY: number;
    private rotSpeedZ: number;
    private scene: THREE.Scene;

    constructor(
        scene: THREE.Scene,
        x: number,
        y: number,
        z: number,
        flavor: CandyFlavor = CandyFlavor.STRAWBERRY
    ) {
        this.scene = scene;
        this.flavor = flavor;
        this.position = new THREE.Vector3(x, y, z);
        this.baseY = y;

        this.tubeRadius = 0.55 + Math.random() * 0.15;
        const torusRadius = 1.65 + Math.random() * 0.35;
        this.innerRadius = torusRadius - this.tubeRadius;
        this.outerRadius = torusRadius + this.tubeRadius;

        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.rotation.y = Math.PI / 2;

        const colors = CANDY_COLORS[flavor];
        const mat = new THREE.MeshPhysicalMaterial({
            map: createGummyStripeTexture(colors.primary, colors.secondary),
            color: 0xffffff,
            emissive: colors.highlight,
            emissiveIntensity: 0.12,
            metalness: 0,
            roughness: 0.18,
            transmission: 0.35,
            thickness: 1.2,
            clearcoat: 1.0,
            clearcoatRoughness: 0.08,
            transparent: true,
            opacity: 0.92,
            ior: 1.42
        });

        const torus = new THREE.Mesh(
            new THREE.TorusGeometry(torusRadius, this.tubeRadius, 14, 28),
            mat
        );
        torus.castShadow = true;
        torus.receiveShadow = true;
        this.group.add(torus);

        // Soft sugar speckles on the gummy surface
        const speckleMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: colors.highlight,
            emissiveIntensity: 0.4,
            roughness: 0.2,
            transparent: true,
            opacity: 0.7
        });
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const speckle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), speckleMat);
            speckle.position.set(
                Math.cos(angle) * torusRadius,
                Math.sin(angle) * torusRadius * 0.35,
                Math.sin(angle * 2) * this.tubeRadius * 0.5
            );
            this.group.add(speckle);
        }

        this.rotSpeedY = 0.25 + Math.random() * 0.2;
        this.rotSpeedZ = 0.15 + Math.random() * 0.1;
        scene.add(this.group);
    }

    getCandyColor(): number {
        return CANDY_COLORS[this.flavor].primary;
    }

    /** Radial distance in the YZ plane (flight threads along +X). */
    radialDistTo(point: THREE.Vector3): number {
        const dy = point.y - this.position.y;
        const dz = point.z - this.position.z;
        return Math.sqrt(dy * dy + dz * dz);
    }

    triggerSquash(intensity: number = 1): void {
        this.squashActive = true;
        this.squashTimer = 0;
        this.squashIntensity = intensity;
    }

    private squashIntensity = 1;

    update(dt: number): void {
        if (!this.active) return;
        this.time += dt;

        this.group.position.y = this.baseY + Math.sin(this.time * 1.6) * 0.35;
        this.position.y = this.group.position.y;
        this.group.rotation.y += this.rotSpeedY * dt;
        this.group.rotation.z = Math.sin(this.time * 0.9) * 0.12 + this.rotSpeedZ * this.time * 0.02;

        if (this.squashActive) {
            this.squashTimer += dt;
            const t = this.squashTimer / 0.4;
            let sy = 1;
            if (t < 0.25) {
                sy = THREE.MathUtils.lerp(1, 0.6, t / 0.25);
            } else if (t < 0.55) {
                sy = THREE.MathUtils.lerp(0.6, 1.4, (t - 0.25) / 0.3);
            } else if (t < 1) {
                sy = THREE.MathUtils.lerp(1.4, 1, (t - 0.55) / 0.45);
            } else {
                this.squashActive = false;
                sy = 1;
            }
            const sx = 1 + (1 - sy) * 0.35 * this.squashIntensity;
            const sz = 1 + (1 - sy) * 0.35 * this.squashIntensity;
            this.group.scale.set(sx * this.baseScale.x, sy * this.baseScale.y, sz * this.baseScale.z);
        } else {
            const breath = 1 + Math.sin(this.time * 2.4) * 0.03;
            this.group.scale.setScalar(breath);
        }
    }

    takeDamage(): boolean {
        this.health--;
        this.triggerSquash(1.3);
        return this.health <= 0;
    }

    destroy(): void {
        if (!this.active) return;
        this.active = false;
        this.scene.remove(this.group);
        this.group.traverse((child) => {
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


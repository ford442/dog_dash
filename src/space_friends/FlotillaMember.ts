import * as THREE from 'three';
import type { TrappedFriendKind } from './types';

export class FlotillaMember {
    group: THREE.Group;
    index: number;
    kind: TrappedFriendKind;
    private time: number;
    /** While > 0, the member swoops ahead of the rocket for a victory fly-by. */
    private flybyTimer: number = 0;
    private propeller?: THREE.Mesh;

    constructor(scene: THREE.Scene, color: number, index: number, kind: TrappedFriendKind = 'kitty') {
        this.index = index;
        this.kind = kind;
        this.time = Math.random() * Math.PI * 2;
        this.group = new THREE.Group();
        this.group.userData.speciesId = kind === 'moonpup'
            ? 'rescuedMoonPup'
            : kind === 'otter'
                ? 'rescuedOtter'
                : kind === 'sealpup'
                    ? 'rescuedSealPup'
                    : kind === 'astrobunny'
                        ? 'rescuedAstroBunny'
                        : kind === 'lemur'
                            ? 'rescuedLemur'
                            : `rescued${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;

        const bodyGeo = new THREE.SphereGeometry(0.35, 12, 12);
        const bodyMat = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.35,
            roughness: 0.6
        });
        this.group.add(new THREE.Mesh(bodyGeo, bodyMat));

        // Species-flavored decorations so each rescued friend stays
        // recognizable in the flotilla behind the rocket.
        switch (kind) {
            case 'kitty': {
                const earMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
                for (const side of [-1, 1]) {
                    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 8), earMat);
                    ear.position.set(0.12, 0.32, side * 0.18);
                    ear.rotation.z = -0.3;
                    this.group.add(ear);
                }
                break;
            }
            case 'bunny': {
                const earMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
                for (const side of [-1, 1]) {
                    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.45, 4, 8), earMat);
                    ear.position.set(0.05, 0.42, side * 0.14);
                    ear.rotation.z = side * 0.25;
                    this.group.add(ear);
                }
                break;
            }
            case 'tarsier': {
                const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
                const pupilMat = new THREE.MeshStandardMaterial({
                    color: 0x221133,
                    emissive: 0xb088ff,
                    emissiveIntensity: 0.6,
                    roughness: 0.3
                });
                for (const side of [-1, 1]) {
                    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), eyeMat);
                    eye.position.set(0.28, 0.1, side * 0.18);
                    this.group.add(eye);
                    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), pupilMat);
                    pupil.position.set(0.08, 0, 0);
                    eye.add(pupil);
                }
                break;
            }
            case 'moonpup': {
                // Fishbowl helmet
                const helmetMat = new THREE.MeshPhysicalMaterial({
                    color: 0xaaddff,
                    transmission: 0.9,
                    roughness: 0.05,
                    transparent: true,
                    opacity: 0.35
                });
                const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), helmetMat);
                this.group.add(helmet);

                // Spinning propeller on top
                const propMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6, roughness: 0.3 });
                this.propeller = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.08), propMat);
                this.propeller.position.set(0, 0.42, 0);
                this.group.add(this.propeller);
                break;
            }
            case 'otter': {
                const tailMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
                const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.35, 4, 6), tailMat);
                tail.position.set(0, -0.1, -0.28);
                tail.rotation.x = 0.5;
                this.group.add(tail);
                const orbMat = new THREE.MeshStandardMaterial({
                    color: 0x44ddff,
                    emissive: 0x44ddff,
                    emissiveIntensity: 0.8,
                    roughness: 0.2
                });
                const miniOrb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), orbMat);
                miniOrb.position.set(0.2, 0.25, 0.15);
                this.group.add(miniOrb);
                break;
            }
            case 'penguin': {
                const bellyMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.7 });
                const belly = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), bellyMat);
                belly.position.set(0, -0.05, 0.12);
                belly.scale.set(0.8, 0.7, 0.4);
                this.group.add(belly);
                const beak = new THREE.Mesh(
                    new THREE.ConeGeometry(0.05, 0.1, 6),
                    new THREE.MeshStandardMaterial({ color: 0xff7722, roughness: 0.5 })
                );
                beak.position.set(0.22, 0.05, 0.1);
                beak.rotation.z = -Math.PI / 2;
                this.group.add(beak);
                break;
            }
            case 'sealpup': {
                for (const side of [-1, 1]) {
                    const flipper = new THREE.Mesh(
                        new THREE.SphereGeometry(0.1, 8, 8),
                        new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
                    );
                    flipper.scale.set(0.5, 1.1, 0.7);
                    flipper.position.set(0.05, -0.05, side * 0.22);
                    this.group.add(flipper);
                }
                const bubbleMat = new THREE.MeshPhysicalMaterial({
                    color: 0xaaddff,
                    transmission: 0.85,
                    roughness: 0.05,
                    transparent: true,
                    opacity: 0.3
                });
                const miniBubble = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 10), bubbleMat);
                this.group.add(miniBubble);
                break;
            }
            case 'astrobunny': {
                const earMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
                for (const side of [-1, 1]) {
                    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), earMat);
                    ear.position.set(0.12, 0.28, side * 0.14);
                    ear.rotation.z = side * 0.2;
                    this.group.add(ear);
                }
                const miniHelmet = new THREE.Mesh(
                    new THREE.SphereGeometry(0.38, 10, 10),
                    new THREE.MeshPhysicalMaterial({
                        color: 0xaaddff,
                        transmission: 0.88,
                        roughness: 0.05,
                        transparent: true,
                        opacity: 0.28
                    })
                );
                this.group.add(miniHelmet);
                break;
            }
            case 'lemur': {
                const ringMat = new THREE.MeshStandardMaterial({ color: 0x9988aa, roughness: 0.85 });
                const tail = new THREE.Group();
                tail.position.set(0, -0.05, -0.28);
                for (let i = 0; i < 3; i++) {
                    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 5), ringMat);
                    seg.rotation.x = Math.PI / 2;
                    seg.position.z = -i * 0.12;
                    tail.add(seg);
                }
                this.group.add(tail);
                break;
            }
        }

        // Tiny thruster glow trailing behind the rescued friend
        const glowGeo = new THREE.ConeGeometry(0.15, 0.5, 8);
        const glowMat = new THREE.MeshStandardMaterial({
            color: 0x88ddff,
            emissive: 0x88ddff,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.7
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.rotation.z = Math.PI / 2;
        glow.position.x = -0.4;
        this.group.add(glow);

        scene.add(this.group);
    }

    /** Briefly swoop ahead of the rocket in celebration (e.g. chapter complete). */
    triggerFlyby(duration: number = 2.5): void {
        this.flybyTimer = duration;
    }

    /** Quick happy bounce - used when the flotilla cheers (clean sling, near miss, ...). */
    cheer(): void {
        this.group.scale.setScalar(1.4);
    }

    update(dt: number, playerPos: THREE.Vector3): void {
        this.time += dt;

        if (this.propeller) {
            this.propeller.rotation.y += dt * 25;
        }

        // Ease the cheer bounce back to normal size
        if (this.group.scale.x > 1.0) {
            this.group.scale.setScalar(Math.max(1.0, this.group.scale.x - dt * 3));
        }

        const row = Math.floor(this.index / 2) + 1;
        const side = (this.index % 2 === 0) ? 1 : -1;

        let targetX: number;
        let targetY: number;
        let targetZ: number;

        if (this.flybyTimer > 0) {
            this.flybyTimer -= dt;
            // Swoop out ahead of the rocket in a spread formation
            targetX = playerPos.x + 3 + row * 1.5;
            targetY = playerPos.y + side * row * 1.2 + Math.sin(this.time * 4 + this.index) * 0.5;
            targetZ = playerPos.z + side * 0.5;
        } else {
            // V-formation behind the rocket, alternating sides per index
            targetX = playerPos.x - 2.5 - row * 1.8;
            targetY = playerPos.y + side * row * 1.4 + Math.sin(this.time * 2 + this.index) * 0.3;
            targetZ = playerPos.z + side * 0.5;
        }

        const followRate = Math.min(1, dt * 4);
        this.group.position.x += (targetX - this.group.position.x) * followRate;
        this.group.position.y += (targetY - this.group.position.y) * followRate;
        this.group.position.z += (targetZ - this.group.position.z) * followRate;

        this.group.rotation.z = Math.sin(this.time * 3) * 0.1;
    }

    destroy(scene: THREE.Scene): void {
        scene.remove(this.group);
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

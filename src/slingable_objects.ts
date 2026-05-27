import * as THREE from 'three';
import { DebrisSystem, ParticleSystem } from './particles';
import { disposeObject } from './utils';

const _collisionNormal = new THREE.Vector3();
const _impactVelocity = new THREE.Vector3();
const _trailColor = new THREE.Color();

export interface SlingableObjectConfig {
    radius?: number;
    mass?: number;
    velocity?: THREE.Vector3;
    color?: number;
    emissive?: number;
}

export interface SlingableObjectInstance {
    group: THREE.Group;
    velocity: THREE.Vector3;
    mass: number;
    radius: number;
    active: boolean;
    health: number;
    trailTimer: number;
    spin: THREE.Vector3;
    shellMaterial: THREE.MeshBasicMaterial;
    bodyMaterial: THREE.MeshPhysicalMaterial;
}

export class SlingableObjectSystem {
    readonly objects: SlingableObjectInstance[] = [];

    constructor(
        private readonly scene: THREE.Scene,
        private readonly particleSystem: ParticleSystem,
        private readonly debrisSystem: DebrisSystem
    ) {}

    createObject(position: THREE.Vector3, config: SlingableObjectConfig = {}): SlingableObjectInstance {
        const radius = config.radius ?? (1.0 + Math.random() * 0.7);
        const mass = config.mass ?? (1.4 + Math.random() * 1.3);
        const velocity = config.velocity?.clone() ?? new THREE.Vector3(
            -1.0 - Math.random() * 1.4,
            (Math.random() - 0.5) * 1.8,
            (Math.random() - 0.5) * 0.8
        );

        const bodyColor = config.color ?? 0x7dd3ff;
        const emissive = config.emissive ?? 0x66ffee;

        const group = new THREE.Group();
        group.position.copy(position);

        const body = new THREE.Mesh(
            new THREE.IcosahedronGeometry(radius, 0),
            new THREE.MeshPhysicalMaterial({
                color: bodyColor,
                emissive,
                emissiveIntensity: 0.55,
                roughness: 0.28,
                metalness: 0.25,
                clearcoat: 0.8,
                clearcoatRoughness: 0.15,
                flatShading: true
            })
        );
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        const shell = new THREE.Mesh(
            new THREE.IcosahedronGeometry(radius * 1.25, 0),
            new THREE.MeshBasicMaterial({
                color: emissive,
                transparent: true,
                opacity: 0.16,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.BackSide
            })
        );
        group.add(shell);

        const instance: SlingableObjectInstance = {
            group,
            velocity,
            mass,
            radius,
            active: true,
            health: Math.max(1, Math.round(radius * 1.5)),
            trailTimer: Math.random() * 0.08,
            spin: new THREE.Vector3(
                (Math.random() - 0.5) * 1.4,
                (Math.random() - 0.5) * 1.2,
                (Math.random() - 0.5) * 1.4
            ),
            shellMaterial: shell.material as THREE.MeshBasicMaterial,
            bodyMaterial: body.material as THREE.MeshPhysicalMaterial
        };

        group.userData = {
            type: 'slingableObject',
            parent: instance,
            tetherable: true,
            slingable: true,
            mass,
            radius,
            velocity
        };

        this.scene.add(group);
        this.objects.push(instance);
        return instance;
    }

    getTetherTargets(): THREE.Object3D[] {
        return this.objects
            .filter(obj => obj.active)
            .map(obj => obj.group);
    }

    setLatchedTarget(target: THREE.Object3D | null): void {
        for (const obj of this.objects) {
            if (!obj.active) continue;
            const tethered = obj.group === target;
            obj.group.userData.isTethered = tethered;
            obj.bodyMaterial.emissiveIntensity = tethered ? 1.8 : 0.55;
            obj.shellMaterial.opacity = tethered ? 0.42 : 0.16;
        }
    }

    applyTetherImpulse(target: THREE.Object3D, impulse: THREE.Vector3): boolean {
        const slingable = target.userData.parent as SlingableObjectInstance | undefined;
        if (!slingable || !slingable.active) return false;

        const impulseScale = THREE.MathUtils.clamp(1.9 / slingable.mass, 0.65, 1.5);
        slingable.velocity.addScaledVector(impulse, impulseScale);
        slingable.trailTimer = 0;

        this.particleSystem.emit(
            slingable.group.position.clone(),
            slingable.bodyMaterial.emissive.getHex(),
            12,
            6.5,
            0.9,
            slingable.radius * 0.7
        );

        return true;
    }

    update(delta: number, cameraX: number): void {
        const cutoff = cameraX - 100;

        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            if (!obj.active) continue;

            obj.group.position.addScaledVector(obj.velocity, delta);
            obj.group.rotation.x += obj.spin.x * delta;
            obj.group.rotation.y += obj.spin.y * delta;
            obj.group.rotation.z += obj.spin.z * delta;
            obj.velocity.multiplyScalar(Math.pow(0.992, delta * 60));

            const speed = obj.velocity.length();
            if (obj.group.userData.isTethered || speed > 5) {
                obj.trailTimer -= delta;
                if (obj.trailTimer <= 0) {
                    obj.trailTimer = obj.group.userData.isTethered ? 0.04 : 0.06;
                    _trailColor.copy(obj.bodyMaterial.color).lerp(obj.bodyMaterial.emissive, 0.55);
                    this.particleSystem.emit(
                        obj.group.position.clone(),
                        _trailColor.getHex(),
                        obj.group.userData.isTethered ? 2 : 1,
                        Math.min(speed * 0.45, 5.5),
                        THREE.MathUtils.clamp(obj.radius * 0.55, 0.45, 1.2),
                        obj.radius * 0.45
                    );
                }
            }

            if (obj.group.position.x < cutoff) {
                this.removeObjectAtIndex(i);
            }
        }
    }

    cleanupBehind(cameraX: number): void {
        const cutoff = cameraX - 100;
        for (let i = this.objects.length - 1; i >= 0; i--) {
            if (this.objects[i].group.position.x < cutoff) {
                this.removeObjectAtIndex(i);
            }
        }
    }

    handleAsteroidCollisions(
        obstacles: THREE.Mesh[],
        splitAsteroid: (asteroid: THREE.Mesh) => void,
        onImpact?: (position: THREE.Vector3, heavyHit?: boolean) => void
    ): void {
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            if (!obj.active) continue;

            for (let j = obstacles.length - 1; j >= 0; j--) {
                const asteroid = obstacles[j];
                const asteroidRadius = asteroid.userData.radius || 1.0;
                const collisionRadius = obj.radius + asteroidRadius;

                if (obj.group.position.distanceToSquared(asteroid.position) > collisionRadius * collisionRadius) {
                    continue;
                }

                _collisionNormal.subVectors(asteroid.position, obj.group.position);
                if (_collisionNormal.lengthSq() < 0.0001) {
                    _collisionNormal.set(1, 0, 0);
                } else {
                    _collisionNormal.normalize();
                }

                _impactVelocity.copy(obj.velocity);
                const impactSpeed = _impactVelocity.length();
                const destroysAsteroid = impactSpeed > 7 || asteroidRadius <= obj.radius * 1.2;

                this.particleSystem.emit(asteroid.position.clone(), 0x9fe7ff, 10, 5.0, 0.9, obj.radius);

                if (destroysAsteroid) {
                    splitAsteroid(asteroid);
                    obj.velocity.addScaledVector(_collisionNormal, -Math.max(impactSpeed * 0.18, 1.2));
                    obj.health -= asteroidRadius > obj.radius ? 1 : 0;
                    onImpact?.(asteroid.position.clone(), impactSpeed > 10);
                } else {
                    obj.velocity.reflect(_collisionNormal).multiplyScalar(0.6);
                    obj.health -= 1;
                    onImpact?.(obj.group.position.clone(), true);
                }

                if (obj.health <= 0) {
                    this.destroyObjectAtIndex(i);
                }

                break;
            }
        }
    }

    dispose(): void {
        for (let i = this.objects.length - 1; i >= 0; i--) {
            this.removeObjectAtIndex(i);
        }
    }

    private destroyObjectAtIndex(index: number): void {
        const obj = this.objects[index];
        this.debrisSystem.emit(obj.group.position.clone(), 8, 5.5, obj.radius * 0.8);
        this.particleSystem.emit(obj.group.position.clone(), 0xffffff, 14, 6.0, 1.0, obj.radius);
        this.removeObjectAtIndex(index);
    }

    private removeObjectAtIndex(index: number): void {
        const obj = this.objects[index];
        obj.active = false;
        this.scene.remove(obj.group);
        disposeObject(obj.group);
        this.objects.splice(index, 1);
    }
}

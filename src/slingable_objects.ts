import * as THREE from 'three';
import { DebrisSystem, ParticleSystem } from './particles';
import { disposeObject } from './utils';
import {
    buildToyRocketGroup,
    TOY_ROCKET_MATERIALS,
    TOY_ROCKET_SPECIES_ID,
    type ToyRocketVariant
} from './toy_rockets';

import { CollisionLayer, type SpatialIndex } from './spatial_index';
import { gameplayRandom } from './run_seed';
import { decorationBudget } from './decoration_budget';
import {
    buildSlingableRig,
    getSlingableHintRingGeometry,
    getSlingableShellGeometry,
    slingableUsesFlatShading,
    updateSlingableRig,
    SLINGABLE_CREATURES,
    type SlingableArtKind,
    type SlingableRig
} from './pickup_art/slingable_art';

const _collisionNormal = new THREE.Vector3();
const _impactVelocity = new THREE.Vector3();
const _trailColor = new THREE.Color();
const _hueColor = new THREE.Color();

/** Personality archetypes for slingable targets. */
export type SlingableKind = 'rock' | 'puffball' | 'chromaRock' | 'tetherSprite' | 'wreckingBall' | 'toyRocket';

/** Seconds the puffball spends inflating before it pops into spore confetti. */
const PUFFBALL_INFLATE_DURATION = 0.45;
/** Upward speed granted to the player when a puffball pops. */
const PUFFBALL_LIFT_AMOUNT = 16;
/** Radius (multiple of object radius) of the rainbow slipstream left by a chroma rock. */
const CHROMA_SLIPSTREAM_RADIUS_SCALE = 4.5;
/** Lifetime of a chroma slipstream zone, in seconds. */
const CHROMA_SLIPSTREAM_DURATION = 5.0;
/** World distance within which the "grab me" highlight appears. */
const GRAB_HINT_RANGE = 16;
/** Puffballs and sprites keep their faces toward the camera: only a gentle roll. */
const CREATURE_SPIN = new THREE.Vector3(0, 0, 0.25);
const FREE_SPIN = new THREE.Vector3(1, 1, 1);
/** Tether-state shell: faint at rest so the body's shape reads, bright once latched. */
const SHELL_REST_OPACITY = 0.07;
const SHELL_TETHERED_OPACITY = 0.38;

/** Resting self-glow per kind (the tether flare is 1.8 for all). Steel shouldn't glow orange. */
function restEmissiveFor(kind: SlingableKind): number {
    switch (kind) {
        case 'wreckingBall': return 0.12;
        case 'rock':
        case 'puffball': return 0.3;
        default: return 0.55;
    }
}

export interface SlingableObjectConfig {
    radius?: number;
    mass?: number;
    velocity?: THREE.Vector3;
    color?: number;
    emissive?: number;
    kind?: SlingableKind;
    toyVariant?: ToyRocketVariant;
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
    kind: SlingableKind;
    highlightGroup: THREE.Group;
    highlightMaterial: THREE.MeshBasicMaterial;
    /** Set while a puffball is inflating toward its pop. */
    inflateTimer?: number;
    /** Rolling hue (0-1) used by chroma rocks to cycle their shell color. */
    chromaHue?: number;
    toyVariant?: ToyRocketVariant;
    /** Gentle idle wobble timer for toy rockets when player is near. */
    idlePhase?: number;
    /** Body, details and animated parts (all kinds except the toy rocket). */
    rig?: SlingableRig;
}

/** A temporary rainbow trail left behind by a slung chroma rock. */
export interface ChromaSlipstreamZone {
    position: THREE.Vector3;
    radius: number;
    timeLeft: number;
}

export type SlingableSpecialEffect =
    | { type: 'puffballPop'; position: THREE.Vector3; liftAmount: number }
    | { type: 'chromaSlipstream'; position: THREE.Vector3; radius: number }
    | { type: 'toyRocketResolved'; position: THREE.Vector3; viaSling: boolean };

export class SlingableObjectSystem {
    readonly objects: SlingableObjectInstance[] = [];
    readonly slipstreams: ChromaSlipstreamZone[] = [];

    /** Fired for kind-specific moments (puffball pops, chroma slipstreams). */
    onSpecialEffect?: (effect: SlingableSpecialEffect) => void;

    /** Fired when a slingable is destroyed (asteroid smash / health depleted). */
    onDestroyed?: (kind: SlingableKind, position: THREE.Vector3, speciesId?: string) => void;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly particleSystem: ParticleSystem,
        private readonly debrisSystem: DebrisSystem
    ) {}

    createObject(position: THREE.Vector3, config: SlingableObjectConfig = {}): SlingableObjectInstance {
        const kind: SlingableKind = config.kind ?? 'rock';
        const radius = config.radius ?? (1.0 + gameplayRandom('slingables') * 0.7);
        const mass = config.mass ?? (1.4 + gameplayRandom('slingables') * 1.3);
        const velocity = config.velocity?.clone() ?? new THREE.Vector3(
            -1.0 - gameplayRandom('slingables') * 1.4,
            (gameplayRandom('slingables') - 0.5) * 1.8,
            (gameplayRandom('slingables') - 0.5) * 0.8
        );

        // Per-kind palette defaults (still overridable via config)
        const KIND_COLORS: Record<SlingableKind, { color: number; emissive: number }> = {
            rock: { color: 0x7dd3ff, emissive: 0x66ffee },
            puffball: { color: 0xffd9f0, emissive: 0x99ffaa },
            chromaRock: { color: 0xbb88ff, emissive: 0xff66cc },
            tetherSprite: { color: 0xfff0cc, emissive: 0xffaaee },
            wreckingBall: { color: 0x554433, emissive: 0xff8844 },
            toyRocket: { color: 0xff6b8a, emissive: 0xff4466 }
        };
        const palette = KIND_COLORS[kind];
        const bodyColor = config.color ?? palette.color;
        const emissive = config.emissive ?? palette.emissive;

        const group = new THREE.Group();
        group.position.copy(position);

        let bodyMaterial: THREE.MeshPhysicalMaterial;
        let rig: SlingableRig | undefined;

        if (kind === 'toyRocket') {
            bodyMaterial = TOY_ROCKET_MATERIALS.hull.clone();
            bodyMaterial.color.setHex(bodyColor);
            bodyMaterial.emissive.setHex(emissive);

            const toyVariant = config.toyVariant ?? 'bentFin';
            const toyGroup = buildToyRocketGroup(radius, toyVariant, bodyMaterial);
            group.add(toyGroup);
        } else {
            // Body shape per personality (pickup_art/slingable_art.ts): pet rock,
            // geode, puffball, tether sprite, wrecking ball. Shared unit geometry
            // scaled by radius; this material is the instance's own (tether glow,
            // geode hue cycle) and multiplies the baked vertex shading.
            bodyMaterial = new THREE.MeshPhysicalMaterial({
                color: bodyColor,
                emissive,
                emissiveIntensity: restEmissiveFor(kind),
                roughness: kind === 'wreckingBall' ? 0.35 : 0.28,
                metalness: kind === 'wreckingBall' ? 0.6 : 0.25,
                clearcoat: 0.8,
                clearcoatRoughness: 0.15,
                vertexColors: true,
                flatShading: slingableUsesFlatShading(kind as SlingableArtKind)
            });
            rig = buildSlingableRig(kind as SlingableArtKind, radius, bodyMaterial);
            group.add(rig.root);
        }

        const shell = new THREE.Mesh(
            getSlingableShellGeometry(),
            new THREE.MeshBasicMaterial({
                color: emissive,
                transparent: true,
                opacity: SHELL_REST_OPACITY,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.BackSide
            })
        );
        shell.scale.setScalar(radius);
        group.add(shell);

        // --- "Grab me" highlight: an orbiting glow ring, hidden until needed ---
        const highlightGroup = new THREE.Group();
        const highlightMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const highlightRing = new THREE.Mesh(getSlingableHintRingGeometry(), highlightMaterial);
        highlightRing.scale.setScalar(radius);
        highlightGroup.add(highlightRing);
        // A couple of orbiting sparkle motes
        for (let i = 0; i < 3; i++) {
            const sparkle = new THREE.Mesh(
                new THREE.SphereGeometry(radius * 0.1, 6, 6),
                new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.0,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                })
            );
            sparkle.userData.orbitOffset = (i / 3) * Math.PI * 2;
            sparkle.userData.isSparkle = true;
            highlightGroup.add(sparkle);
        }
        group.add(highlightGroup);

        const instance: SlingableObjectInstance = {
            group,
            velocity,
            mass,
            radius,
            active: true,
            health: kind === 'wreckingBall'
                ? Math.max(3, Math.round(radius * 3))
                : kind === 'toyRocket'
                    ? Math.max(2, Math.round(radius * 2))
                    : Math.max(1, Math.round(radius * 1.5)),
            trailTimer: Math.random() * 0.08, // visual-only
            spin: new THREE.Vector3(
                (Math.random() - 0.5) * 1.4, // visual-only
                (Math.random() - 0.5) * 1.2, // visual-only
                (Math.random() - 0.5) * 1.4 // visual-only
            ).multiply(SLINGABLE_CREATURES.has(kind) ? CREATURE_SPIN : FREE_SPIN),
            shellMaterial: shell.material as THREE.MeshBasicMaterial,
            bodyMaterial,
            kind,
            highlightGroup,
            highlightMaterial,
            chromaHue: kind === 'chromaRock' ? Math.random() : undefined, // visual-only
            toyVariant: kind === 'toyRocket' ? (config.toyVariant ?? 'bentFin') : undefined,
            idlePhase: kind === 'toyRocket' ? Math.random() * Math.PI * 2 : undefined, // visual-only
            rig
        };
        if (rig) rig.t = Math.random() * 10; // visual-only

        group.userData = {
            type: 'slingableObject',
            parent: instance,
            tetherable: true,
            slingable: true,
            kind,
            mass,
            radius,
            velocity,
            speciesId: kind === 'toyRocket' ? TOY_ROCKET_SPECIES_ID : undefined,
            scanPosition: kind === 'toyRocket' ? position.clone() : undefined
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

    /** Scannable toy wrecks for the discovery log. */
    getScannables(): THREE.Object3D[] {
        return this.objects
            .filter(obj => obj.active && obj.kind === 'toyRocket')
            .map(obj => obj.group);
    }

    clearByKind(kind: SlingableKind): void {
        for (let i = this.objects.length - 1; i >= 0; i--) {
            if (this.objects[i].kind === kind) {
                this.removeObjectAtIndex(i);
            }
        }
    }

    setLatchedTarget(target: THREE.Object3D | null): void {
        for (const obj of this.objects) {
            if (!obj.active) continue;
            const tethered = obj.group === target;
            obj.group.userData.isTethered = tethered;
            obj.bodyMaterial.emissiveIntensity = tethered ? 1.8 : restEmissiveFor(obj.kind);
            obj.shellMaterial.opacity = tethered ? SHELL_TETHERED_OPACITY : SHELL_REST_OPACITY;
        }
    }

    applyTetherImpulse(target: THREE.Object3D, impulse: THREE.Vector3): boolean {
        const slingable = target.userData.parent as SlingableObjectInstance | undefined;
        if (!slingable || !slingable.active) return false;

        // Puffballs don't fly off — they inflate in place, then pop with a lift.
        if (slingable.kind === 'puffball') {
            if (slingable.inflateTimer !== undefined) return true;
            slingable.inflateTimer = 0;
            slingable.velocity.set(0, 0, 0);
            slingable.trailTimer = 0;
            this.particleSystem.emit(
                slingable.group.position.clone(),
                0x99ffaa,
                8,
                3.0,
                0.6,
                slingable.radius * 0.5
            );
            return true;
        }

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

        // Chroma rocks leave behind a temporary rainbow slipstream.
        if (slingable.kind === 'chromaRock') {
            const zone: ChromaSlipstreamZone = {
                position: slingable.group.position.clone(),
                radius: slingable.radius * CHROMA_SLIPSTREAM_RADIUS_SCALE,
                timeLeft: CHROMA_SLIPSTREAM_DURATION
            };
            this.slipstreams.push(zone);
            this.onSpecialEffect?.({ type: 'chromaSlipstream', position: zone.position.clone(), radius: zone.radius });
            this.particleSystem.emit(zone.position.clone(), 0xff66cc, 18, 5.0, 1.2, zone.radius * 0.5);
        }

        if (slingable.kind === 'toyRocket') {
            this._resolveToyRocket(slingable, true);
        }

        return true;
    }

    private _resolveToyRocket(obj: SlingableObjectInstance, viaSling: boolean): void {
        const pos = obj.group.position.clone();
        this._emitCandyHeartBurst(pos);
        this.onSpecialEffect?.({ type: 'toyRocketResolved', position: pos, viaSling });
    }

    private _emitCandyHeartBurst(position: THREE.Vector3): void {
        const heartColors = [0xffb6c1, 0xff69b4, 0xffc0cb, 0xff8fab, 0xffffff];
        for (let i = 0; i < heartColors.length; i++) {
            this.particleSystem.emit(
                position.clone(),
                heartColors[i],
                3,
                3.5 + Math.random() * 2, // visual-only
                0.75,
                0.35 + Math.random() * 0.2 // visual-only
            );
        }
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3): void {
        const cutoff = cameraX - 100;

        // Age out rainbow slipstream zones
        for (let i = this.slipstreams.length - 1; i >= 0; i--) {
            this.slipstreams[i].timeLeft -= delta;
            if (this.slipstreams[i].timeLeft <= 0) this.slipstreams.splice(i, 1);
        }

        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            if (!obj.active) continue;

            // Chroma rocks continuously cycle their shell/emissive hue
            if (obj.kind === 'chromaRock' && obj.chromaHue !== undefined) {
                obj.chromaHue = (obj.chromaHue + delta * 0.25) % 1;
                _hueColor.setHSL(obj.chromaHue, 0.9, 0.6);
                obj.bodyMaterial.emissive.copy(_hueColor);
                obj.shellMaterial.color.copy(_hueColor);
            }

            // Puffball inflate-and-pop sequence
            if (obj.inflateTimer !== undefined) {
                obj.inflateTimer += delta;
                const t = Math.min(obj.inflateTimer / PUFFBALL_INFLATE_DURATION, 1);
                const scale = 1 + t * 0.8;
                obj.group.scale.setScalar(scale);
                if (t >= 1) {
                    this.onSpecialEffect?.({
                        type: 'puffballPop',
                        position: obj.group.position.clone(),
                        liftAmount: PUFFBALL_LIFT_AMOUNT
                    });
                    // Spore confetti burst
                    for (let c = 0; c < 5; c++) {
                        const hue = Math.random(); // visual-only
                        _hueColor.setHSL(hue, 0.8, 0.65);
                        this.particleSystem.emit(
                            obj.group.position.clone(),
                            _hueColor.getHex(),
                            6, 4.0, 0.8, obj.radius * 0.6
                        );
                    }
                    this.debrisSystem.emit(obj.group.position.clone(), 6, 3.5, obj.radius * 0.7);
                    this.removeObjectAtIndex(i);
                    continue;
                }
            }

            // Toy rocket: gentle idle wobble only when the player is nearby
            if (obj.kind === 'toyRocket' && obj.idlePhase !== undefined) {
                const near = playerPos && obj.group.position.distanceTo(playerPos) < GRAB_HINT_RANGE * 1.4;
                if (near) {
                    obj.idlePhase += delta * 1.6;
                    obj.group.rotation.z = Math.sin(obj.idlePhase) * 0.06;
                    obj.group.rotation.y = Math.sin(obj.idlePhase * 0.7) * 0.04;
                    for (const child of obj.group.children) {
                        child.traverse((sub) => {
                            if (sub.userData.isFlag) {
                                sub.rotation.y = Math.sin(obj.idlePhase! * 2.2) * 0.35;
                            }
                        });
                    }
                } else if (obj.group.rotation.z !== 0 || obj.group.rotation.y !== 0) {
                    obj.group.rotation.z *= 0.92;
                    obj.group.rotation.y *= 0.92;
                }
                if (playerPos) {
                    obj.group.userData.scanPosition = obj.group.position.clone();
                }
            }

            // "Grab me" highlight: glow ring + orbiting sparkles
            const isTethered = !!obj.group.userData.isTethered;
            const dist = playerPos ? obj.group.position.distanceTo(playerPos) : Infinity;
            const showHighlight = isTethered || dist < GRAB_HINT_RANGE;
            if (showHighlight) {
                const pulse = isTethered
                    ? 0.55 + Math.sin(performance.now() * 0.012) * 0.25
                    : THREE.MathUtils.clamp((GRAB_HINT_RANGE - dist) / GRAB_HINT_RANGE, 0, 1) * 0.4;
                obj.highlightMaterial.opacity = pulse;
                obj.highlightGroup.rotation.z += delta * (isTethered ? 2.2 : 1.0);
                for (const child of obj.highlightGroup.children) {
                    if (child.userData.isSparkle) {
                        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
                        mat.opacity = pulse;
                        const angle = obj.highlightGroup.rotation.z + child.userData.orbitOffset;
                        const orbitRadius = obj.radius * 1.7;
                        child.position.set(Math.cos(angle) * orbitRadius, Math.sin(angle) * orbitRadius, 0);
                    }
                }
            } else if (obj.highlightMaterial.opacity !== 0) {
                obj.highlightMaterial.opacity = 0;
                for (const child of obj.highlightGroup.children) {
                    if (child.userData.isSparkle) {
                        ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0;
                    }
                }
            }

            if (obj.rig) {
                updateSlingableRig(obj.rig, delta, {
                    near: THREE.MathUtils.clamp((GRAB_HINT_RANGE - dist) / GRAB_HINT_RANGE, 0, 1),
                    tethered: isTethered,
                    inflate: obj.inflateTimer !== undefined ? obj.inflateTimer / PUFFBALL_INFLATE_DURATION : 0,
                    speed: obj.velocity.length()
                });
            }

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
        decorationBudget.syncCount('slingable_objects', this.objects.length);
    }

    /** Returns true if `position` falls inside an active rainbow slipstream zone. */
    isInSlipstream(position: THREE.Vector3): boolean {
        for (const zone of this.slipstreams) {
            if (zone.position.distanceTo(position) <= zone.radius) return true;
        }
        return false;
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
        onImpact?: (position: THREE.Vector3, heavyHit?: boolean) => void,
        spatial?: SpatialIndex | null
    ): void {
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            if (!obj.active) continue;

            let asteroid: THREE.Mesh | null = null;
            if (spatial) {
                const hits = spatial.query(
                    obj.group.position.x,
                    obj.group.position.y,
                    obj.group.position.z,
                    obj.radius,
                    CollisionLayer.Obstacle
                );
                for (const hit of hits) {
                    if (hit.kind !== 'obstacle') continue;
                    const mesh = hit.ref instanceof THREE.Mesh ? hit.ref : obstacles[hit.index];
                    if (mesh) {
                        asteroid = mesh;
                        break;
                    }
                }
            } else {
                for (let j = obstacles.length - 1; j >= 0; j--) {
                    const candidate = obstacles[j];
                    const asteroidRadius = candidate.userData.radius || 1.0;
                    const collisionRadius = obj.radius + asteroidRadius;
                    if (obj.group.position.distanceToSquared(candidate.position) > collisionRadius * collisionRadius) {
                        continue;
                    }
                    asteroid = candidate;
                    break;
                }
            }
            if (!asteroid) continue;

            const asteroidRadius = asteroid.userData.radius || 1.0;
            _collisionNormal.subVectors(asteroid.position, obj.group.position);
            if (_collisionNormal.lengthSq() < 0.0001) {
                _collisionNormal.set(1, 0, 0);
            } else {
                _collisionNormal.normalize();
            }

            _impactVelocity.copy(obj.velocity);
            const impactSpeed = _impactVelocity.length();
            const destroysAsteroid = obj.kind === 'wreckingBall'
                ? (impactSpeed > 3 || asteroidRadius <= obj.radius * 1.6)
                : obj.kind === 'toyRocket'
                    ? (impactSpeed > 5 || asteroidRadius <= obj.radius * 1.35)
                    : (impactSpeed > 7 || asteroidRadius <= obj.radius * 1.2);

            this.particleSystem.emit(asteroid.position.clone(), 0x9fe7ff, 10, 5.0, 0.9, obj.radius);

            if (destroysAsteroid) {
                splitAsteroid(asteroid);
                const drag = obj.kind === 'wreckingBall' ? 0.05 : 0.18;
                obj.velocity.addScaledVector(_collisionNormal, -Math.max(impactSpeed * drag, 1.2));
                obj.health -= (asteroidRadius > obj.radius && obj.kind !== 'wreckingBall') ? 1 : 0;
                onImpact?.(asteroid.position.clone(), impactSpeed > 10);
            } else {
                obj.velocity.reflect(_collisionNormal).multiplyScalar(0.6);
                obj.health -= 1;
                onImpact?.(obj.group.position.clone(), true);
            }

            if (obj.health <= 0) {
                this.destroyObjectAtIndex(i);
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
        const pos = obj.group.position.clone();
        const speciesId = obj.group.userData?.speciesId as string | undefined;
        if (obj.kind === 'toyRocket') {
            this._resolveToyRocket(obj, false);
        } else {
            this.debrisSystem.emit(obj.group.position.clone(), 8, 5.5, obj.radius * 0.8);
            this.particleSystem.emit(obj.group.position.clone(), 0xffffff, 14, 6.0, 1.0, obj.radius);
        }
        this.onDestroyed?.(obj.kind, pos, speciesId);
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

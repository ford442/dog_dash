/**
 * Moon Snail — house-sized spiral-shelled drifter for late levels (L5–L6).
 * Decorative set-piece with a faint glitter trail, gentle shell bumps,
 * and a calm-approach blessing (slow-fall or star magnet).
 *
 * Perf budget: ≤2 active, one merged shell mesh (~200 tris), shared candy materials.
 */

import * as THREE from 'three';
import { ParticleSystem, DebrisSystem } from './particles';
import { AudioSystem } from './audio_system';
import { CreatureInteractionResult } from './creature_types';
import { PowerUpType } from './powerup_manager';
import { createGummyTranslucent, createIridescentCrystal } from './candy_materials';
import { markShared, noteGeometryCreated } from './gpu_resources';

type SnailState = 'drifting' | 'blessing' | 'blessed';

interface ProjectileLike {
    mesh: THREE.Object3D;
    active: boolean;
}

const TRAIL_COLORS = [0xffd6f0, 0xc8e8ff, 0xfff5ee, 0xffffff];

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];

    for (const geo of geometries) {
        geo.computeVertexNormals();
        const pos = geo.attributes.position;
        const norm = geo.attributes.normal;
        for (let i = 0; i < pos.count; i++) {
            positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
            normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
        }
        geo.dispose();
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return merged;
}

let sharedShellGeometry: THREE.BufferGeometry | null = null;

function getSpiralShellGeometry(): THREE.BufferGeometry {
    if (sharedShellGeometry) return sharedShellGeometry;

    const parts: THREE.BufferGeometry[] = [];
    const dome = new THREE.SphereGeometry(6.5, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
    dome.translate(0, 1.4, 0);
    parts.push(dome);

    const turns = 2.15;
    for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const angle = t * Math.PI * 2 * turns;
        const ringR = 2.0 + t * 4.6;
        const tube = 0.26 + t * 0.14;
        const torus = new THREE.TorusGeometry(ringR, tube, 4, 8, Math.PI * 0.9);
        torus.rotateX(Math.PI / 2);
        torus.rotateZ(angle);
        torus.translate(
            Math.cos(angle) * ringR * 0.12,
            0.6 + t * 2.6,
            Math.sin(angle) * ringR * 0.12
        );
        parts.push(torus);
    }

    const lip = new THREE.TorusGeometry(5.0, 0.42, 4, 10, Math.PI * 1.02);
    lip.rotateX(Math.PI / 2);
    lip.translate(0, -0.15, 0);
    parts.push(lip);

    sharedShellGeometry = markShared(mergeGeometries(parts));
    noteGeometryCreated();
    return sharedShellGeometry;
}

const SHELL_MATERIAL = createIridescentCrystal(0xe8c8ff, 1.35, {
    cacheKey: 'moon_snail_shell',
    opacity: 0.96,
    emissiveIntensity: 0.28,
    depthWrite: true
});

const BODY_MATERIAL = createGummyTranslucent(0xffc8e8, {
    cacheKey: 'moon_snail_body',
    emissive: 0xffb6d9,
    emissiveIntensity: 0.42,
    transmission: 0.18,
    roughness: 0.22
});

export class MoonSnail {
    group: THREE.Group;
    position: THREE.Vector3;
    isDestroyed = false;

    private state: SnailState = 'drifting';
    private stateTimer = 0;
    private time = 0;
    private calmTimer = 0;
    private trailTimer = 0;
    private bumpCooldown = 0;
    private hasBlessed = false;
    private phase = Math.random() * Math.PI * 2;
    private crawlSpeed = 0.32 + Math.random() * 0.12;
    private lastPlayerPos = new THREE.Vector3();
    private hasLastPlayer = false;

    private bodyGroup: THREE.Group;
    private leftStalk: THREE.Group;
    private rightStalk: THREE.Group;
    private leftEye: THREE.Mesh;
    private rightEye: THREE.Mesh;
    private shellMesh: THREE.Mesh;

    readonly SHELL_RADIUS = 7.2;
    readonly CALM_DISTANCE = 20;
    readonly TOO_CLOSE = 5.5;
    readonly CALM_SPEED = 10;
    readonly BLESS_TIME = 2.4;
    readonly PROJECTILE_SAFE_RADIUS = 30;

    constructor(scene: THREE.Scene, x: number, y: number, z: number, tintColor?: number) {
        this.position = new THREE.Vector3(x, y, z);
        this.phase = Math.random() * Math.PI * 2;

        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.userData.speciesId = 'moonSnail';

        const shellMat = tintColor
            ? createIridescentCrystal(tintColor, 1.35, {
                cacheKey: `moon_snail_shell_${tintColor.toString(16)}`,
                opacity: 0.96,
                emissiveIntensity: 0.28,
                depthWrite: true
            })
            : SHELL_MATERIAL;

        this.shellMesh = new THREE.Mesh(getSpiralShellGeometry(), shellMat);
        this.shellMesh.rotation.y = Math.PI * 0.5;
        this.group.add(this.shellMesh);

        this.bodyGroup = new THREE.Group();
        this.bodyGroup.position.set(-4.8, -1.6, 0);
        this.group.add(this.bodyGroup);

        const foot = new THREE.Mesh(
            new THREE.SphereGeometry(2.4, 8, 6),
            BODY_MATERIAL
        );
        foot.scale.set(1.35, 0.45, 1.1);
        this.bodyGroup.add(foot);

        const head = new THREE.Mesh(
            new THREE.SphereGeometry(1.35, 8, 6),
            BODY_MATERIAL
        );
        head.position.set(-1.1, 0.55, 0);
        head.scale.set(1.1, 0.95, 0.9);
        this.bodyGroup.add(head);

        const stalkMat = new THREE.MeshStandardMaterial({
            color: 0xffb6d9,
            roughness: 0.55,
            emissive: 0xff88cc,
            emissiveIntensity: 0.25
        });
        const eyeMat = new THREE.MeshStandardMaterial({
            color: 0x1a1030,
            roughness: 0.15,
            emissive: 0x6644aa,
            emissiveIntensity: 0.35
        });

        this.leftStalk = this.createEyeStalk(stalkMat, eyeMat, -0.55);
        this.rightStalk = this.createEyeStalk(stalkMat, eyeMat, 0.55);
        head.add(this.leftStalk);
        head.add(this.rightStalk);

        this.leftEye = this.leftStalk.children[1] as THREE.Mesh;
        this.rightEye = this.rightStalk.children[1] as THREE.Mesh;

        const glow = new THREE.PointLight(0xffd6f0, 0.55, 22);
        glow.position.set(-2, 1, 1.5);
        this.group.add(glow);

        this.group.userData.moonSnail = this;
        scene.add(this.group);
    }

    private createEyeStalk(
        stalkMat: THREE.MeshStandardMaterial,
        eyeMat: THREE.MeshStandardMaterial,
        zOffset: number
    ): THREE.Group {
        const stalk = new THREE.Group();
        stalk.position.set(0.15, 0.75, zOffset);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.85, 5), stalkMat);
        stem.position.y = 0.42;
        stalk.add(stem);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), eyeMat);
        eye.position.y = 0.92;
        stalk.add(eye);
        return stalk;
    }

    getPosition(): THREE.Vector3 {
        return this.position;
    }

    getRadius(): number {
        return this.SHELL_RADIUS;
    }

    private getApproachSpeed(playerPos: THREE.Vector3, dt: number): number {
        if (!this.hasLastPlayer || dt <= 0) return 0;
        return playerPos.distanceTo(this.lastPlayerPos) / dt;
    }

    private hasNearbyProjectiles(projectiles: ProjectileLike[]): boolean {
        for (const proj of projectiles) {
            if (!proj.active) continue;
            if (proj.mesh.position.distanceTo(this.position) < this.PROJECTILE_SAFE_RADIUS) {
                return true;
            }
        }
        return false;
    }

    private pickBlessing(): PowerUpType {
        return Math.random() < 0.5
            ? PowerUpType.FLOWER_CROWN_BOOST
            : PowerUpType.TWINKLE_STAR_MAGNET;
    }

    private updateEyeStalks(dist: number): void {
        const stalkScale = dist < this.CALM_DISTANCE
            ? THREE.MathUtils.clamp(
                (dist - this.TOO_CLOSE) / (this.CALM_DISTANCE - this.TOO_CLOSE),
                0.22,
                1
            )
            : 1;
        this.leftStalk.scale.set(1, stalkScale, 1);
        this.rightStalk.scale.set(1, stalkScale, 1);
        const blink = Math.sin(this.time * 0.4 + this.phase) > 0.92 ? 0.15 : 1;
        this.leftEye.scale.setScalar(blink);
        this.rightEye.scale.setScalar(blink);
    }

    private emitTrail(particleSystem?: ParticleSystem): void {
        if (!particleSystem) return;
        const trailPos = this.position.clone();
        trailPos.x += 5.5;
        trailPos.y += Math.sin(this.time * 0.8 + this.phase) * 0.4;
        trailPos.z += (Math.random() - 0.5) * 1.2;
        const color = TRAIL_COLORS[Math.floor(Math.random() * TRAIL_COLORS.length)];
        particleSystem.emit(trailPos, color, 2, 1.8, 0.2, 0.55);
    }

    update(
        dt: number,
        playerPos: THREE.Vector3,
        particleSystem?: ParticleSystem,
        _debrisSystem?: DebrisSystem,
        audioSystem?: AudioSystem,
        projectiles: ProjectileLike[] = []
    ): CreatureInteractionResult | null {
        this.time += dt;
        this.stateTimer += dt;
        this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);

        const dist = playerPos.distanceTo(this.position);
        const approachSpeed = this.getApproachSpeed(playerPos, dt);
        let result: CreatureInteractionResult | null = null;

        this.position.x -= dt * this.crawlSpeed;
        this.position.y += Math.sin(this.time * 0.55 + this.phase) * dt * 0.22;
        this.group.position.copy(this.position);
        this.group.rotation.z = Math.sin(this.time * 0.35 + this.phase) * 0.03;

        this.trailTimer -= dt;
        if (this.trailTimer <= 0) {
            this.trailTimer = 0.42 + Math.random() * 0.18;
            this.emitTrail(particleSystem);
        }

        this.updateEyeStalks(dist);

        if (
            this.bumpCooldown <= 0 &&
            dist < this.SHELL_RADIUS + 1.2 &&
            dist > this.TOO_CLOSE
        ) {
            const push = playerPos.clone().sub(this.position).normalize();
            if (push.lengthSq() > 0.01) {
                this.bumpCooldown = 0.35;
                result = {
                    type: 'moon_snail_bump',
                    position: this.position.clone(),
                    playerNudge: {
                        x: push.x * 2.8,
                        y: push.y * 2.2 + 0.8
                    }
                };
            }
        }

        const weaponsQuiet = !this.hasNearbyProjectiles(projectiles);

        switch (this.state) {
            case 'drifting': {
                const bodyBreath = 1 + Math.sin(this.time * 1.4 + this.phase) * 0.03;
                this.bodyGroup.scale.setScalar(bodyBreath);

                if (
                    !this.hasBlessed &&
                    weaponsQuiet &&
                    dist < this.CALM_DISTANCE &&
                    dist > this.TOO_CLOSE &&
                    approachSpeed < this.CALM_SPEED
                ) {
                    this.calmTimer += dt;
                    if (this.calmTimer >= this.BLESS_TIME) {
                        this.state = 'blessing';
                        this.stateTimer = 0;
                        this.hasBlessed = true;
                        audioSystem?.playMagicSequence('spell_complete');
                        particleSystem?.emit(this.position.clone(), 0xffd6f0, 22, 4.5, 0.8, 2.5);
                        particleSystem?.emit(this.position.clone(), 0xffffff, 12, 3.5, 0.5, 1.2);
                    }
                } else if (dist > this.CALM_DISTANCE + 4 || !weaponsQuiet || approachSpeed >= this.CALM_SPEED) {
                    this.calmTimer = Math.max(0, this.calmTimer - dt * 0.5);
                }
                break;
            }
            case 'blessing': {
                this.bodyGroup.scale.setScalar(1 + Math.sin(this.stateTimer * 5) * 0.04);
                if (this.stateTimer >= 0.9) {
                    const blessing = this.pickBlessing();
                    const label = blessing === PowerUpType.FLOWER_CROWN_BOOST
                        ? 'Moon Snail — Soft Drift!'
                        : 'Moon Snail — Star Whisper!';
                    result = {
                        type: 'moon_snail_blessing',
                        position: this.position.clone(),
                        cores: 12,
                        label,
                        blessingPowerUp: blessing
                    };
                    this.state = 'blessed';
                    this.stateTimer = 0;
                }
                break;
            }
            case 'blessed':
                break;
        }

        this.hasLastPlayer = true;
        this.lastPlayerPos.copy(playerPos);
        return result;
    }

    destroy(scene: THREE.Scene): void {
        scene.remove(this.group);
        this.group.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            if (child.geometry && child.geometry !== sharedShellGeometry) {
                child.geometry.dispose();
            }
            const mat = child.material;
            if (mat === SHELL_MATERIAL || mat === BODY_MATERIAL) return;
            if (Array.isArray(mat)) {
                mat.forEach((m) => m.dispose());
            } else {
                mat?.dispose();
            }
        });
        this.isDestroyed = true;
    }
}

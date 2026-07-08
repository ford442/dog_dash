import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    time,
    vec3,
    vec4,
    float,
    sin,
    cos,
    mix,
    smoothstep,
    length,
    positionLocal,
    attribute
} from 'three/tsl';
import { DEPTH_LAYERS, randomZInRange } from './depth_layers';
import type { ParticleSystem } from './particles';

export type StarlightKoiEvent =
    | { type: 'breach'; position: THREE.Vector3; color: number };

export type StarlightKoiEnvironmentConfig = {
    density?: number;
};

const MAX_FISH_PER_SCHOOL = 15;
const MIN_FISH_PER_SCHOOL = 8;
const MAX_TOTAL_FISH = 100;
const MAX_SCHOOLS = 8;

const KOI_PALETTE = [0xffc8a8, 0xff9ec4, 0xc8e8ff, 0xffe8b0, 0xe8c8ff, 0xa8ffe8];

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

/** Low-poly koi body (~36 tris) — swims along +X. */
function createKoiGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];

    const body = new THREE.ConeGeometry(0.32, 1.05, 5);
    body.rotateZ(-Math.PI / 2);
    body.translate(0.08, 0, 0);
    parts.push(body);

    const head = new THREE.SphereGeometry(0.22, 4, 3);
    head.translate(0.62, 0, 0);
    parts.push(head);

    const tail = new THREE.ConeGeometry(0.28, 0.42, 3);
    tail.rotateZ(Math.PI / 2);
    tail.translate(-0.62, 0, 0);
    parts.push(tail);

    const dorsal = new THREE.ConeGeometry(0.12, 0.28, 3);
    dorsal.rotateX(Math.PI / 2);
    dorsal.translate(0.05, 0.28, 0);
    parts.push(dorsal);

    const pectoralL = new THREE.ConeGeometry(0.08, 0.22, 3);
    pectoralL.rotateZ(Math.PI / 2);
    pectoralL.rotateY(0.4);
    pectoralL.translate(0.2, -0.08, 0.18);
    parts.push(pectoralL);

    const pectoralR = pectoralL.clone();
    pectoralR.translate(0, 0, -0.36);
    parts.push(pectoralR);

    return mergeGeometries(parts);
}

const KOI_GEOMETRY = createKoiGeometry();

function createKoiMaterial(): MeshBasicNodeMaterial {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending
    });

    const aPhase = attribute('aPhase', 'float');
    const aColor = attribute('aColor', 'vec3');
    const uTime = time;

    const tailMask = smoothstep(float(0.15), float(-0.55), positionLocal.x);
    const bodyWave = sin(
        positionLocal.x.mul(4.5).add(uTime.mul(3.2).add(aPhase))
    ).mul(0.04);
    const tailWag = sin(uTime.mul(5.5).add(aPhase.mul(1.4))).mul(0.14).mul(tailMask);
    const finFlutter = sin(uTime.mul(7.0).add(aPhase)).mul(0.03).mul(tailMask);

    mat.positionNode = positionLocal.add(vec3(
        float(0),
        bodyWave,
        tailWag.add(finFlutter)
    ));

    const dorsalGlow = smoothstep(float(0.02), float(0.32), positionLocal.y)
        .mul(sin(uTime.mul(2.8).add(aPhase)).mul(0.35).add(0.65));
    const glowTint = aColor.mul(vec3(1.35, 1.25, 1.45));
    const bodyColor = mix(aColor, glowTint, dorsalGlow.mul(0.55));

    mat.colorNode = vec4(bodyColor, float(0.72).add(dorsalGlow.mul(0.18)));
    mat.opacityNode = float(0.68).add(dorsalGlow.mul(0.2));

    return mat;
}

interface SchoolState {
    mesh: THREE.InstancedMesh;
    fishCount: number;
    anchorX: number;
    centerY: number;
    centerZ: number;
    loopRadiusX: number;
    loopRadiusY: number;
    loopSpeed: number;
    loopPhase: number;
    heading: number;
    turnTimer: number;
    breachCooldown: number;
    formationOffsets: Float32Array;
    phases: Float32Array;
    scales: Float32Array;
    colors: Float32Array;
    elapsed: number;
}

/**
 * One school = one InstancedMesh draw call (8–15 fish).
 * Gentle looping paths, mild rocket avoidance, optional surface breach sparkles.
 */
class StarlightKoiSchool {
    readonly state: SchoolState;
    private readonly dummy = new THREE.Object3D();
    private readonly scene: THREE.Scene;

    constructor(
        scene: THREE.Scene,
        anchorX: number,
        y: number,
        z: number,
        fishCount: number
    ) {
        this.scene = scene;
        const count = Math.min(MAX_FISH_PER_SCHOOL, Math.max(MIN_FISH_PER_SCHOOL, fishCount));

        const mat = createKoiMaterial();
        const geometry = KOI_GEOMETRY.clone();
        const mesh = new THREE.InstancedMesh(geometry, mat, count);
        mesh.frustumCulled = false;
        mesh.renderOrder = 3;

        const formationOffsets = new Float32Array(count * 3);
        const phases = new Float32Array(count);
        const scales = new Float32Array(count);
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const radius = 0.6 + Math.random() * 1.8;
            formationOffsets[i * 3] = Math.cos(angle) * radius;
            formationOffsets[i * 3 + 1] = (Math.random() - 0.5) * 1.2;
            formationOffsets[i * 3 + 2] = Math.sin(angle) * radius * 0.6;

            phases[i] = Math.random() * Math.PI * 2;
            scales[i] = 0.55 + Math.random() * 0.45;

            const colorHex = KOI_PALETTE[Math.floor(Math.random() * KOI_PALETTE.length)];
            const c = new THREE.Color(colorHex);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }

        geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
        geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));

        this.state = {
            mesh,
            fishCount: count,
            anchorX,
            centerY: y,
            centerZ: z,
            loopRadiusX: 5 + Math.random() * 8,
            loopRadiusY: 2.5 + Math.random() * 5,
            loopSpeed: 0.35 + Math.random() * 0.35,
            loopPhase: Math.random() * Math.PI * 2,
            heading: Math.random() < 0.5 ? 1 : -1,
            turnTimer: 6 + Math.random() * 8,
            breachCooldown: 4 + Math.random() * 6,
            formationOffsets,
            phases,
            scales,
            colors,
            elapsed: 0
        };

        scene.add(mesh);
        this._writeAllMatrices(0);
    }

    private _writeAllMatrices(swimPhase: number) {
        const s = this.state;
        const loopT = s.elapsed * s.loopSpeed + s.loopPhase;
        const cx = s.anchorX + Math.sin(loopT) * s.loopRadiusX * s.heading;
        const cy = s.centerY + Math.cos(loopT * 0.7) * s.loopRadiusY;
        const cz = s.centerZ + Math.sin(loopT * 0.45) * 2.5;

        const velX = Math.cos(loopT) * s.loopRadiusX * s.loopSpeed * s.heading;
        const velY = -Math.sin(loopT * 0.7) * s.loopRadiusY * s.loopSpeed * 0.7;
        const yaw = Math.atan2(velX, 0.4) + (s.heading < 0 ? Math.PI : 0);

        for (let i = 0; i < s.fishCount; i++) {
            const ox = s.formationOffsets[i * 3];
            const oy = s.formationOffsets[i * 3 + 1];
            const oz = s.formationOffsets[i * 3 + 2];
            const phase = s.phases[i];
            const scale = s.scales[i];

            const wobbleX = Math.sin(swimPhase * 2.1 + phase) * 0.15;
            const wobbleY = Math.sin(swimPhase * 1.6 + phase * 1.3) * 0.12;

            this.dummy.position.set(
                cx + ox + wobbleX,
                cy + oy + wobbleY,
                cz + oz
            );
            this.dummy.rotation.set(
                Math.sin(swimPhase + phase) * 0.08,
                yaw,
                Math.sin(swimPhase * 1.4 + phase) * 0.12
            );
            this.dummy.scale.setScalar(scale);
            this.dummy.updateMatrix();
            s.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        s.mesh.instanceMatrix.needsUpdate = true;
    }

    update(
        delta: number,
        cameraX: number,
        playerPos?: THREE.Vector3
    ): StarlightKoiEvent[] {
        const s = this.state;
        const events: StarlightKoiEvent[] = [];
        s.elapsed += delta;

        const loopT = s.elapsed * s.loopSpeed + s.loopPhase;
        const cx = s.anchorX + Math.sin(loopT) * s.loopRadiusX * s.heading;
        const cy = s.centerY + Math.cos(loopT * 0.7) * s.loopRadiusY;

        s.turnTimer -= delta;
        if (s.turnTimer <= 0) {
            s.turnTimer = 8 + Math.random() * 10;
            if (Math.random() < 0.55) {
                s.heading *= -1;
            } else {
                s.loopPhase += Math.PI * 0.5;
            }
        }

        s.breachCooldown -= delta;
        if (s.breachCooldown <= 0 && cy > 4 && Math.random() < delta * 0.35) {
            s.breachCooldown = 5 + Math.random() * 8;
            const breachPos = new THREE.Vector3(cx, cy + 1.2, s.centerZ);
            const colorIdx = Math.floor(Math.random() * KOI_PALETTE.length);
            events.push({ type: 'breach', position: breachPos, color: KOI_PALETTE[colorIdx] });
        }

        const margin = 130;
        const inRange = cx > cameraX - margin && cx < cameraX + margin + 80;
        s.mesh.visible = inRange;
        if (!inRange) return events;

        if (playerPos) {
            const avoidRadius = 7;
            const avoidSq = avoidRadius * avoidRadius;
            for (let i = 0; i < s.fishCount; i++) {
                const ox = s.formationOffsets[i * 3];
                const oy = s.formationOffsets[i * 3 + 1];
                const oz = s.formationOffsets[i * 3 + 2];
                const fx = cx + ox;
                const fy = cy + oy;
                const fz = s.centerZ + oz;

                const dx = fx - playerPos.x;
                const dy = fy - playerPos.y;
                const dz = fz - playerPos.z;
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq < avoidSq && distSq > 0.01) {
                    const dist = Math.sqrt(distSq);
                    const push = (1 - dist / avoidRadius) * 2.2 * delta;
                    s.formationOffsets[i * 3] += (dx / dist) * push;
                    s.formationOffsets[i * 3 + 1] += (dy / dist) * push;
                    s.formationOffsets[i * 3 + 2] += (dz / dist) * push;
                }

                s.formationOffsets[i * 3] *= 1 - delta * 0.35;
                s.formationOffsets[i * 3 + 1] *= 1 - delta * 0.35;
                s.formationOffsets[i * 3 + 2] *= 1 - delta * 0.35;
            }
        }

        this._writeAllMatrices(s.elapsed);
        return events;
    }

    dispose() {
        this.scene.remove(this.state.mesh);
        this.state.mesh.geometry.dispose();
        if ((this.state.mesh.material as THREE.Material).dispose) {
            (this.state.mesh.material as THREE.Material).dispose();
        }
    }

    get anchorX() {
        return this.state.anchorX;
    }

    get fishCount() {
        return this.state.fishCount;
    }
}

/**
 * Manages multiple koi schools along a level span.
 * Active in biological / aquatic / nebula biomes when koiSchoolDensity > 0.
 */
export class StarlightKoiManager {
    private readonly scene: THREE.Scene;
    private readonly particleSystem?: ParticleSystem;
    private schools: StarlightKoiSchool[] = [];
    active = false;
    private totalFish = 0;

    constructor(scene: THREE.Scene, particleSystem?: ParticleSystem) {
        this.scene = scene;
        this.particleSystem = particleSystem;
    }

    activate() {
        this.active = true;
    }

    deactivate() {
        this.active = false;
        this.clear();
    }

    /** Scatter schools across a level segment; density = target school count. */
    spawnForLevel(startX: number, length: number, density: number) {
        this.clear();

        const schoolCount = Math.min(
            MAX_SCHOOLS,
            Math.max(1, Math.floor(density))
        );

        const zRange: [number, number] = [DEPTH_LAYERS.BACKGROUND.min, DEPTH_LAYERS.MIDGROUND.max];
        let fishBudget = MAX_TOTAL_FISH;

        for (let i = 0; i < schoolCount && fishBudget >= MIN_FISH_PER_SCHOOL; i++) {
            const t = (i + 0.5) / schoolCount;
            const anchorX = startX + t * length + (Math.random() - 0.5) * (length / schoolCount) * 0.4;
            const y = (Math.random() - 0.5) * 20;
            const z = randomZInRange(zRange);

            const remainingSchools = schoolCount - i;
            const maxForSchool = Math.min(
                MAX_FISH_PER_SCHOOL,
                Math.floor(fishBudget / remainingSchools) + 2
            );
            const fishCount = Math.min(
                maxForSchool,
                MIN_FISH_PER_SCHOOL + Math.floor(Math.random() * (MAX_FISH_PER_SCHOOL - MIN_FISH_PER_SCHOOL + 1))
            );

            this.schools.push(new StarlightKoiSchool(this.scene, anchorX, y, z, fishCount));
            fishBudget -= fishCount;
            this.totalFish += fishCount;
        }
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3): StarlightKoiEvent[] {
        if (!this.active || this.schools.length === 0) return [];

        const events: StarlightKoiEvent[] = [];
        for (const school of this.schools) {
            events.push(...school.update(delta, cameraX, playerPos));
        }

        if (this.particleSystem) {
            for (const ev of events) {
                if (ev.type === 'breach') {
                    this.particleSystem.emit(ev.position.clone(), ev.color, 12, 2.5, 0.6, 1.2);
                    this.particleSystem.emit(
                        ev.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
                        0xffffff,
                        6,
                        1.8,
                        0.4,
                        0.8
                    );
                }
            }
        }

        return events;
    }

    cleanupFarBehind(cameraX: number) {
        const cutoff = cameraX - 160;
        const remaining: StarlightKoiSchool[] = [];
        for (const school of this.schools) {
            if (school.anchorX < cutoff) {
                this.totalFish -= school.fishCount;
                school.dispose();
            } else {
                remaining.push(school);
            }
        }
        this.schools = remaining;
    }

    clear() {
        for (const school of this.schools) {
            school.dispose();
        }
        this.schools = [];
        this.totalFish = 0;
    }
}

/** True when koi should appear for this level's environment mix. */
export function shouldSpawnStarlightKoi(
    environments: { biological?: boolean; aquaticLife?: boolean; nebula?: boolean } | undefined,
    density: number | undefined
): boolean {
    if (!density || density <= 0) return false;
    const env = environments || {};
    return !!(env.biological || env.aquaticLife || env.nebula);
}

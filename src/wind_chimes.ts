/**
 * Crystal Wind-Chime Mobiles — mid-ground rotating hub with dangling prisms.
 *
 * render budget: max 8 chimes × 6 meshes = 48 meshes; keep materials <5 variants
 *
 * Each mobile is a small THREE.Group (no instancing — per-chime sway matters).
 * Shared geometry + materials; hub is one mesh, each pendant is string + prism.
 */

import * as THREE from 'three';
import { ParticleSystem } from './particles';
import { DEPTH_LAYERS, randomZInRange } from './depth_layers';
import { createIridescentCrystal, createCandyGloss } from './candy_materials';
import type { AudioSystem } from './audio_system';

const MAX_CHIMES = 8;
const MAX_PENDANTS = 6;
const UNITS_PER_SLICE = 400;
const TRIGGER_RADIUS = 20;
const TRIGGER_COOLDOWN = 2.6;

const NOTE_SETS: readonly (readonly number[])[] = [
    [1046.5, 1318.5, 1568.0],
    [880.0, 1108.7, 1318.5],
    [784.0, 987.8, 1174.7],
    [659.3, 830.6, 987.8]
];

const CRYSTAL_COLORS = [0x88ccff, 0xaa88ff, 0x66eeff, 0xcc99ff] as const;
const CANDY_COLOR = 0xffb6e6;

/** Shared meshes — one draw material variant per geometry type. */
const HUB_GEOMETRY = new THREE.SphereGeometry(0.16, 8, 8);
const RING_GEOMETRY = new THREE.TorusGeometry(0.34, 0.028, 6, 14);
const STRING_GEOMETRY = (() => {
    const geo = new THREE.CylinderGeometry(0.006, 0.006, 1, 4);
    geo.translate(0, -0.5, 0);
    return geo;
})();
const PRISM_GEOMETRY = new THREE.OctahedronGeometry(0.11, 0);
const CANDY_DROP_GEOMETRY = new THREE.ConeGeometry(0.09, 0.16, 5);

const HUB_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0xffe4b5,
    emissive: 0xffd89b,
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.55
});

const STRING_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0xdde8ff,
    transparent: true,
    opacity: 0.55
});

const CRYSTAL_MATERIALS = CRYSTAL_COLORS.map((hex, i) =>
    createIridescentCrystal(hex, 1.1, { opacity: 0.86, cacheKey: `wind_chime_crystal_${i}` })
);

const CANDY_MATERIAL = createCandyGloss(CANDY_COLOR, {
    emissiveIntensity: 0.28,
    cacheKey: 'wind_chime_candy'
});

const _hubPos = new THREE.Vector3();

interface PendantPart {
    pivot: THREE.Group;
    stringMesh: THREE.Mesh;
    prismMesh: THREE.Mesh;
    length: number;
    swayPhase: number;
    swaySpeed: number;
}

export interface WindChimeInteraction {
    type: 'tinkle';
    position: THREE.Vector3;
}

class WindChimeMobile {
    readonly group: THREE.Group;
    readonly position: THREE.Vector3;
    readonly spinSpeed: number;
    readonly phase: number;

    private rotator: THREE.Group;
    private pendants: PendantPart[] = [];
    private cooldown = 0;
    private noteSet: number;
    private accentColor: number;

    constructor(x: number, y: number, z: number) {
        this.position = new THREE.Vector3(x, y, z);
        this.phase = Math.random() * Math.PI * 2;
        this.spinSpeed = 0.12 + Math.random() * 0.22;
        this.noteSet = Math.floor(Math.random() * NOTE_SETS.length);
        this.accentColor = CRYSTAL_COLORS[this.noteSet % CRYSTAL_COLORS.length];

        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.userData.speciesId = 'windChimeMobile';

        this.rotator = new THREE.Group();
        this.group.add(this.rotator);

        const hub = new THREE.Mesh(HUB_GEOMETRY, HUB_MATERIAL);
        this.rotator.add(hub);

        const ring = new THREE.Mesh(RING_GEOMETRY, HUB_MATERIAL);
        ring.rotation.x = Math.PI / 2;
        this.rotator.add(ring);

        const pendantCount = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < pendantCount; i++) {
            const angle = (i / pendantCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
            const hangRadius = 0.22 + Math.random() * 0.14;
            const length = 0.55 + Math.random() * 0.75;
            const useCandy = Math.random() < 0.22;

            const pivot = new THREE.Group();
            pivot.position.set(
                Math.cos(angle) * hangRadius,
                -0.08,
                Math.sin(angle) * hangRadius
            );
            this.rotator.add(pivot);

            const stringMesh = new THREE.Mesh(STRING_GEOMETRY, STRING_MATERIAL);
            stringMesh.scale.set(1, length, 1);
            pivot.add(stringMesh);

            const prismMesh = new THREE.Mesh(
                useCandy ? CANDY_DROP_GEOMETRY : PRISM_GEOMETRY,
                useCandy
                    ? CANDY_MATERIAL
                    : CRYSTAL_MATERIALS[i % CRYSTAL_MATERIALS.length]
            );
            prismMesh.position.y = -length;
            prismMesh.rotation.y = Math.random() * Math.PI;
            pivot.add(prismMesh);

            this.pendants.push({
                pivot,
                stringMesh,
                prismMesh,
                length,
                swayPhase: Math.random() * Math.PI * 2,
                swaySpeed: 0.9 + Math.random() * 0.8
            });
        }
    }

    update(dt: number, time: number, breeze = 0): void {
        this.cooldown = Math.max(0, this.cooldown - dt);

        const spin = time * this.spinSpeed + this.phase;
        this.rotator.rotation.y = spin;

        const breezeSway = breeze * 0.04;
        for (const pendant of this.pendants) {
            const swayX = Math.sin(time * pendant.swaySpeed + pendant.swayPhase) * (0.14 + breezeSway);
            const swayZ = Math.cos(time * pendant.swaySpeed * 0.85 + pendant.swayPhase) * (0.1 + breezeSway * 0.7);
            pendant.pivot.rotation.x = swayX;
            pendant.pivot.rotation.z = swayZ;

            const wobble = Math.sin(time * 2.1 + pendant.swayPhase) * 0.12;
            pendant.prismMesh.rotation.y += wobble * dt;
        }
    }

    checkProximity(
        playerPos: THREE.Vector3,
        playerVel: THREE.Vector3 | undefined,
        audio: AudioSystem | null,
        particles: ParticleSystem | null
    ): WindChimeInteraction | null {
        if (this.cooldown > 0) return null;

        this.getHubWorldPosition(_hubPos);
        const dx = playerPos.x - _hubPos.x;
        const dy = playerPos.y - _hubPos.y;
        const dz = playerPos.z - _hubPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist > TRIGGER_RADIUS) return null;

        // Prefer fly-under or pass-near: player within vertical band of the mobile
        const maxHang = Math.max(...this.pendants.map(p => p.length), 0.6);
        const verticalOk = dy < 1.2 && dy > -(maxHang + 2.5);
        const nearby = dist < TRIGGER_RADIUS * 0.72;
        if (!verticalOk && !nearby) return null;

        this.cooldown = TRIGGER_COOLDOWN;

        const speed = playerVel?.length() ?? 0;
        const pitchShift = 1 + playerPos.y * 0.0015 + speed * 0.004;
        const notes = NOTE_SETS[this.noteSet];
        const noteCount = 2 + Math.floor(Math.random() * 2);
        const picked = notes.slice(0, noteCount);

        if (audio) {
            audio.playCrystalChime(picked, 0.2, pitchShift);
        }

        if (particles) {
            const sparkleCount = 1 + Math.floor(Math.random() * 2);
            for (let s = 0; s < sparkleCount; s++) {
                const pendant = this.pendants[Math.floor(Math.random() * this.pendants.length)];
                const sparklePos = _hubPos.clone();
                sparklePos.y -= pendant.length * (0.4 + Math.random() * 0.5);
                sparklePos.x += (Math.random() - 0.5) * 0.35;
                sparklePos.z += (Math.random() - 0.5) * 0.35;
                particles.emit(sparklePos, this.accentColor, 1, 2.2, 0.2, 0.55);
            }
        }

        return { type: 'tinkle', position: _hubPos.clone() };
    }

    getHubWorldPosition(target: THREE.Vector3): THREE.Vector3 {
        this.group.updateWorldMatrix(true, false);
        return target.setFromMatrixPosition(this.rotator.matrixWorld);
    }

    destroy(scene: THREE.Scene): void {
        scene.remove(this.group);
    }
}

export class WindChimeManager {
    private scene: THREE.Scene;
    private particles: ParticleSystem | null;
    private audio: AudioSystem | null;
    private chimes: WindChimeMobile[] = [];

    constructor(
        scene: THREE.Scene,
        particles: ParticleSystem | null = null,
        audio: AudioSystem | null = null
    ) {
        this.scene = scene;
        this.particles = particles;
        this.audio = audio;
    }

    /** Stream mobiles ahead of the player (density = clusters per ~400 world units). */
    streamChunk(
        startX: number,
        width: number,
        density: number,
        yRange: [number, number] = [4, 22]
    ): void {
        if (density <= 0 || width <= 0 || this.chimes.length >= MAX_CHIMES) return;

        const sliceFactor = width / UNITS_PER_SLICE;
        const requested = Math.max(0, Math.floor(density * sliceFactor));
        const room = MAX_CHIMES - this.chimes.length;
        const count = Math.min(room, Math.max(requested > 0 ? 1 : 0, requested));

        const zRange: [number, number] = [
            DEPTH_LAYERS.MIDGROUND.min,
            DEPTH_LAYERS.BACKGROUND.max
        ];

        for (let i = 0; i < count; i++) {
            const x = startX + 40 + Math.random() * Math.max(30, width - 70);
            const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
            const z = randomZInRange(zRange);
            this.spawnChime(x, y, z);
        }
    }

    /** Seed across a level segment (level start). */
    spawnField(
        startX: number,
        length: number,
        density: number,
        yRange: [number, number] = [4, 22]
    ): void {
        if (density <= 0 || length <= 0) return;
        const target = Math.min(MAX_CHIMES, Math.max(1, Math.floor(density * (length / UNITS_PER_SLICE))));
        for (let i = 0; i < target && this.chimes.length < MAX_CHIMES; i++) {
            const x = startX + 60 + Math.random() * Math.max(40, length - 120);
            const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
            const z = randomZInRange([DEPTH_LAYERS.MIDGROUND.min, DEPTH_LAYERS.BACKGROUND.max]);
            this.spawnChime(x, y, z);
        }
    }

    spawnChime(x: number, y: number, z: number): WindChimeMobile | null {
        if (this.chimes.length >= MAX_CHIMES) return null;
        const chime = new WindChimeMobile(x, y, z);
        this.scene.add(chime.group);
        this.chimes.push(chime);
        return chime;
    }

    update(
        dt: number,
        time: number,
        playerPos?: THREE.Vector3,
        playerVel?: THREE.Vector3
    ): WindChimeInteraction[] {
        const results: WindChimeInteraction[] = [];
        const breeze = playerVel ? Math.min(1.4, playerVel.length() * 0.08) : 0;

        for (const chime of this.chimes) {
            chime.update(dt, time, breeze);

            if (playerPos) {
                const hit = chime.checkProximity(playerPos, playerVel, this.audio, this.particles);
                if (hit) results.push(hit);
            }
        }

        return results;
    }

    cleanupFarBehind(playerX: number, buffer = 120): void {
        for (let i = this.chimes.length - 1; i >= 0; i--) {
            if (this.chimes[i].position.x < playerX - buffer) {
                this.chimes[i].destroy(this.scene);
                this.chimes.splice(i, 1);
            }
        }
    }

    clear(): void {
        for (const chime of this.chimes) {
            chime.destroy(this.scene);
        }
        this.chimes = [];
    }

    getCount(): number {
        return this.chimes.length;
    }
}

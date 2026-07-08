/**
 * Toy rocket wrecks — low-poly slingable storytelling props.
 *
 * Hero budget: ≤3 active per level, shared material set (hull / fin / accent).
 * Silhouette inspired by the player rocket; built from primitives only.
 */

import * as THREE from 'three';
import type { SlingableObjectSystem } from './slingable_objects';
import { getLevelSpan } from './depth_layers';
import type { LevelConfig } from './level_config';

export type ToyRocketVariant = 'bentFin' | 'missingPiece' | 'littleFlag';

export const TOY_ROCKET_SPECIES_ID = 'toyRocketWreck';

/** Shared material set — one variant each, reused across all wrecks. */
export const TOY_ROCKET_MATERIALS = {
    hull: new THREE.MeshPhysicalMaterial({
        color: 0xff6b8a,
        emissive: 0xff4466,
        emissiveIntensity: 0.35,
        roughness: 0.32,
        metalness: 0.18,
        clearcoat: 0.75,
        clearcoatRoughness: 0.2,
        flatShading: true
    }),
    fin: new THREE.MeshPhysicalMaterial({
        color: 0xffd166,
        emissive: 0xffaa33,
        emissiveIntensity: 0.22,
        roughness: 0.45,
        metalness: 0.1,
        flatShading: true
    }),
    accent: new THREE.MeshPhysicalMaterial({
        color: 0xfff8f0,
        emissive: 0xffeedd,
        emissiveIntensity: 0.15,
        roughness: 0.5,
        flatShading: true
    }),
    window: new THREE.MeshPhysicalMaterial({
        color: 0x88ddff,
        emissive: 0x44ccff,
        emissiveIntensity: 0.55,
        roughness: 0.15,
        metalness: 0.05,
        transparent: true,
        opacity: 0.85,
        flatShading: true
    })
};

const VARIANTS: ToyRocketVariant[] = ['bentFin', 'missingPiece', 'littleFlag'];

/**
 * Build a stylized mini rocket mesh group (nose points +X).
 * `hullMaterial` is cloned per instance so tether highlights work.
 */
export function buildToyRocketGroup(
    radius: number,
    variant: ToyRocketVariant,
    hullMaterial: THREE.MeshPhysicalMaterial
): THREE.Group {
    const group = new THREE.Group();
    const s = radius * 0.55;

    const nose = new THREE.Mesh(
        new THREE.ConeGeometry(s * 0.55, s * 1.1, 6),
        hullMaterial
    );
    nose.rotation.z = -Math.PI / 2;
    nose.position.x = s * 1.35;
    group.add(nose);

    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(s * 0.42, s * 0.48, s * 1.6, 8),
        hullMaterial
    );
    body.rotation.z = Math.PI / 2;
    group.add(body);

    const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(s * 0.15, s * 0.86, s * 0.86),
        TOY_ROCKET_MATERIALS.accent
    );
    stripe.position.x = s * 0.15;
    group.add(stripe);

    const window = new THREE.Mesh(
        new THREE.SphereGeometry(s * 0.22, 6, 6),
        TOY_ROCKET_MATERIALS.window
    );
    window.position.set(s * 0.55, s * 0.28, 0);
    group.add(window);

    const finCount = variant === 'missingPiece' ? 2 : 3;
    for (let i = 0; i < finCount; i++) {
        const fin = new THREE.Mesh(
            new THREE.BoxGeometry(s * 0.12, s * 0.75, s * 0.42),
            TOY_ROCKET_MATERIALS.fin
        );
        const angle = (i / finCount) * Math.PI * 2;
        fin.position.set(-s * 0.72, Math.cos(angle) * s * 0.48, Math.sin(angle) * s * 0.48);
        if (variant === 'bentFin' && i === 0) {
            fin.rotation.x = 0.65;
            fin.rotation.z = -0.35;
        }
        group.add(fin);
    }

    if (variant === 'littleFlag') {
        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(s * 0.03, s * 0.03, s * 0.7, 4),
            TOY_ROCKET_MATERIALS.accent
        );
        pole.position.set(-s * 0.35, s * 0.55, 0);
        group.add(pole);

        const flag = new THREE.Mesh(
            new THREE.PlaneGeometry(s * 0.45, s * 0.28),
            TOY_ROCKET_MATERIALS.fin
        );
        flag.position.set(-s * 0.12, s * 0.82, 0);
        flag.userData.isFlag = true;
        group.add(flag);
    }

    if (variant === 'missingPiece') {
        const scar = new THREE.Mesh(
            new THREE.BoxGeometry(s * 0.2, s * 0.35, s * 0.35),
            new THREE.MeshStandardMaterial({ color: 0x331122, roughness: 0.9, flatShading: true })
        );
        scar.position.set(-s * 0.2, -s * 0.35, 0);
        group.add(scar);
    }

    return group;
}

export function pickToyRocketVariant(): ToyRocketVariant {
    return VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
}

const MAX_ACTIVE_TOY_ROCKETS = 3;

export class ToyRocketSpawnManager {
    private readonly slingables: SlingableObjectSystem;
    private activeIds = new Set<number>();

    constructor(slingables: SlingableObjectSystem) {
        this.slingables = slingables;
    }

    /** Remove toy rockets when switching levels. */
    clearLevel(): void {
        this.slingables.clearByKind('toyRocket');
        this.activeIds.clear();
    }

    /**
     * Place 1–3 wrecks across a level segment (later stages only).
     * Returns spawn positions for discovery / debug.
     */
    spawnForLevel(levelIndex: number, cfg: LevelConfig): THREE.Vector3[] {
        this.clearLevel();

        const count = Math.min(MAX_ACTIVE_TOY_ROCKETS, cfg.toyRocketCount ?? 0);
        if (count <= 0 || levelIndex < 4) return [];

        const { startX, length } = getLevelSpan(levelIndex);
        const positions: THREE.Vector3[] = [];
        const padding = Math.min(120, length * 0.12);
        const usable = Math.max(80, length - padding * 2);

        for (let i = 0; i < count; i++) {
            const t = (i + 0.5) / count + (Math.random() - 0.5) * 0.15;
            const x = startX + padding + t * usable;
            const y = (Math.random() - 0.5) * 14;
            const z = -12 - Math.random() * 8;
            const pos = new THREE.Vector3(x, y, z);
            positions.push(pos);

            const variant = pickToyRocketVariant();
            const inst = this.slingables.createObject(pos, {
                kind: 'toyRocket',
                radius: 1.05 + Math.random() * 0.25,
                mass: 1.35 + Math.random() * 0.4,
                velocity: new THREE.Vector3(
                    -0.4 - Math.random() * 0.5,
                    (Math.random() - 0.5) * 0.35,
                    (Math.random() - 0.5) * 0.25
                ),
                toyVariant: variant
            });
            this.activeIds.add(inst.group.id);
        }

        return positions;
    }

    getActiveCount(): number {
        return this.slingables.objects.filter(o => o.active && o.kind === 'toyRocket').length;
    }
}

/**
 * Asset gallery registry (`?gallery`).
 *
 * Every reviewable game asset registers a {@link GalleryEntry}: a builder that
 * returns a standalone object plus an optional per-frame `update` that poses
 * it for the gallery's current state (idle / telegraph / hit, boss phase,
 * chapter). The gallery lays each entry out on a turntable with an optional
 * flat-black silhouette and hitbox overlay.
 *
 * Hazards, enemies and bosses register in `hazard_entries.ts`; pickups,
 * power-ups, projectiles, slingables and the placeholder rocket in
 * `pickup_entries.ts`; scenery, backdrops and flavor creatures (#418) in
 * `scenery_entries.ts`. `gallery.ts` imports each one lazily.
 */

import type * as THREE from 'three';
import type { BossPhase } from '../boss_system/types';

export type GalleryCategory =
    | 'hazard' | 'enemy' | 'boss'
    | 'pickup' | 'powerup' | 'projectile' | 'slingable' | 'player'
    | 'scenery';

/** Toolbar order. */
export const GALLERY_CATEGORY_ORDER: readonly GalleryCategory[] = [
    'hazard', 'enemy', 'boss', 'pickup', 'powerup', 'projectile', 'slingable', 'player', 'scenery'
];

export const GALLERY_CATEGORY_LABELS: Record<GalleryCategory, string> = {
    hazard: 'Hazards',
    enemy: 'Enemies',
    boss: 'Bosses',
    pickup: 'Pickups',
    powerup: 'Power-ups',
    projectile: 'Projectiles',
    slingable: 'Slingables',
    player: 'Player',
    scenery: 'Scenery'
};

/** Gameplay state the gallery is previewing. */
export type GalleryMode = 'idle' | 'telegraph' | 'hit';

export interface GalleryContext {
    mode: GalleryMode;
    bossPhase: BossPhase;
    /** Chapter 1–6: palette, enemy character and LEVEL_CONFIG tint. */
    chapter: number;
    /** Apply the chapter's `enemyTintColor` the way the game does. */
    applyTint: boolean;
}

/** A collision circle in the entry's local XY plane (world units). */
export interface GalleryHitbox {
    x: number;
    y: number;
    radius: number;
    /** true = damaging / weak point (drawn red), false = blocking shield (drawn blue). */
    weak?: boolean;
}

export interface GalleryInstance {
    object: THREE.Object3D;
    /** Pose for the current state. `t` is gallery time in seconds. */
    update?(dt: number, t: number, ctx: GalleryContext): void;
    /** Hitboxes to overlay, in the same local units as `object`. */
    hitboxes?(ctx: GalleryContext): GalleryHitbox[];
    dispose?(): void;
}

export interface GalleryEntry {
    id: string;
    label: string;
    category: GalleryCategory;
    /** Grid span (bosses use 2). */
    span?: 1 | 2;
    /** One-line review note shown under the label. */
    note?: string;
    build(ctx: GalleryContext): GalleryInstance;
}

const entries: GalleryEntry[] = [];

export function registerGalleryEntries(...list: GalleryEntry[]): void {
    for (const entry of list) {
        if (entries.some((e) => e.id === entry.id)) {
            throw new Error(`[gallery] duplicate entry id: ${entry.id}`);
        }
        entries.push(entry);
    }
}

export function getGalleryEntries(): readonly GalleryEntry[] {
    return entries;
}

/**
 * Quantum Compass (plan §III): a small HUD pip that points at the nearest
 * rare resource once the save has decoded enough buoy map fragments.
 *
 * Visual-only. It reads the gameplay spatial hash (one layer-masked
 * `query` on `CollisionLayer.Rare`, a few times a second) and never feeds
 * anything back into the sim, so replays are unaffected. The arrow is a
 * static rotation: no animation, so nothing changes under
 * `prefers-reduced-motion` except the transition, which it drops.
 */
import type * as THREE from 'three';
import { game } from '../game_runtime';
import { CollisionLayer } from '../spatial_index';
import { headingTo, pickNearestRare, rareLabel, type RareCandidate } from './picker';
import { setQuantumCompassTracking } from './spatial';

/** How far ahead the compass can sense (world units / metres). */
export const COMPASS_RANGE = 80;
/** Sim steps between compass queries (~5 Hz at 60 Hz). */
const QUERY_EVERY_STEPS = 12;

let enabled = false;
let stepCounter = 0;
let pip: HTMLDivElement | null = null;
let arrow: HTMLSpanElement | null = null;
let label: HTMLSpanElement | null = null;
const candidates: RareCandidate[] = [];
const refs: THREE.Object3D[] = [];

function ensurePip(): void {
    if (pip || typeof document === 'undefined') return;
    pip = document.createElement('div');
    pip.id = 'quantum-compass';
    pip.setAttribute('role', 'status');
    pip.setAttribute('aria-live', 'off');
    pip.style.cssText = `
        position: absolute;
        top: 132px;
        left: 20px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px 4px 6px;
        border-radius: 16px;
        background: rgba(10, 30, 50, 0.55);
        border: 2px solid rgba(51, 224, 255, 0.6);
        color: #bff6ff;
        font-family: 'Segoe UI', sans-serif;
        font-size: 15px;
        font-weight: bold;
        text-shadow: 0 0 6px rgba(51, 224, 255, 0.6);
        z-index: 100;
        pointer-events: none;
    `;
    const icon = document.createElement('span');
    icon.textContent = '🧭';
    icon.style.fontSize = '18px';
    arrow = document.createElement('span');
    arrow.textContent = '➤';
    arrow.style.cssText = 'display:inline-block; font-size:18px; color:#33e0ff;';
    const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) arrow.style.transition = 'transform 0.25s ease-out';
    label = document.createElement('span');
    pip.append(icon, arrow, label);
    document.body.appendChild(pip);
    showIdle();
}

function showIdle(): void {
    if (!pip || !arrow || !label) return;
    pip.style.opacity = '0.55';
    arrow.style.visibility = 'hidden';
    label.textContent = 'Scanning…';
}

/** Turn the compass on/off for this run (save unlock, or the hack that unlocks it). */
export function setQuantumCompassEnabled(on: boolean): void {
    enabled = on;
    setQuantumCompassTracking(on);
    stepCounter = 0;
    if (on) {
        ensurePip();
    } else if (pip) {
        pip.remove();
        pip = arrow = label = null;
    }
}

export function isQuantumCompassEnabled(): boolean {
    return enabled;
}

/** Called once per sim step from `updateLoopFinish`; queries a few times a second. */
export function updateQuantumCompass(player: THREE.Object3D | null): void {
    if (!enabled || !player || !pip) return;
    if (stepCounter++ % QUERY_EVERY_STEPS !== 0) return;

    const { x, y, z } = player.position;
    const hits = game.spatialIndex.query(x, y, z, COMPASS_RANGE, CollisionLayer.Rare);
    candidates.length = 0;
    refs.length = 0;
    for (const hit of hits) {
        const obj = hit.ref as THREE.Object3D | undefined;
        if (!obj) continue;
        candidates.push({ x: obj.position.x, y: obj.position.y, z: obj.position.z });
        refs.push(obj);
    }
    const best = pickNearestRare(x, y, z, candidates);
    if (best < 0) {
        showIdle();
        return;
    }
    const target = refs[best];
    const heading = headingTo(x, y, target.position.x, target.position.y);
    const metres = Math.round(target.position.distanceTo(player.position));
    pip.style.opacity = '1';
    arrow!.style.visibility = 'visible';
    // CSS rotates clockwise; world +Y is screen up.
    arrow!.style.transform = `rotate(${(-heading).toFixed(3)}rad)`;
    label!.textContent = `${rareLabel(target.userData)} · ${metres}m`;
}

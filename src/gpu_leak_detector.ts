/**
 * Dev / ?debug GPU resource leak detector.
 * Shows live geometry/material counters and a "Force stream cleanup" action
 * that samples counts for ~60 frames after a forced cull.
 */

import type { DebugSystem } from './debug_system';
import { getGpuResourceLiveCounts, gpuResourceStats } from './gpu_resources';

const SAMPLE_FRAMES = 60;

let panelEl: HTMLDivElement | null = null;
let statsEl: HTMLDivElement | null = null;
let sampleEl: HTMLDivElement | null = null;
let forceCleanup: (() => void) | null = null;

let sampling = false;
let sampleFramesLeft = 0;
let sampleBaseline: { geometries: number; materials: number } | null = null;
let sampleMin: { geometries: number; materials: number } | null = null;
let sampleMax: { geometries: number; materials: number } | null = null;

const SHOW_UI =
    (typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'));

export function attachGpuLeakDetector(debug: DebugSystem, onForceCleanup: () => void): void {
    if (!SHOW_UI || panelEl) return;
    forceCleanup = onForceCleanup;

    const container = debug.getCustomSectionContainer();
    panelEl = document.createElement('div');
    panelEl.style.cssText = `
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px solid rgba(255,255,255,0.15);
    `;

    const header = document.createElement('div');
    header.style.cssText = 'font-weight: bold; font-size: 12px; margin-bottom: 4px; color: #9fdcff;';
    header.textContent = 'GPU Resources';
    panelEl.appendChild(header);

    statsEl = document.createElement('div');
    statsEl.style.cssText = 'font-family: monospace; font-size: 11px; color: #ccc; white-space: pre-wrap;';
    panelEl.appendChild(statsEl);

    sampleEl = document.createElement('div');
    sampleEl.style.cssText =
        'font-family: monospace; font-size: 11px; color: #aaa; margin-top: 4px; white-space: pre-wrap;';
    panelEl.appendChild(sampleEl);

    const btn = document.createElement('button');
    btn.textContent = 'Force stream cleanup';
    btn.style.cssText = `
        margin-top: 6px;
        width: 100%;
        background: rgba(255,255,255,0.1);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 3px;
        padding: 4px 6px;
        font-size: 11px;
        cursor: pointer;
    `;
    btn.onclick = () => {
        const before = getGpuResourceLiveCounts();
        sampleBaseline = { geometries: before.geometries, materials: before.materials };
        sampleMin = { ...sampleBaseline };
        sampleMax = { ...sampleBaseline };
        forceCleanup?.();
        sampling = true;
        sampleFramesLeft = SAMPLE_FRAMES;
        if (sampleEl) {
            sampleEl.textContent = `Sampling ${SAMPLE_FRAMES} frames after cleanup…\nbefore geo=${before.geometries} mat=${before.materials}`;
        }
    };
    panelEl.appendChild(btn);

    container.appendChild(panelEl);
    debug.onVisibilityChange((visible) => {
        if (panelEl) panelEl.style.display = visible ? 'block' : 'none';
    });
    panelEl.style.display = debug.isVisible() ? 'block' : 'none';
    refreshStats();
}

export function updateGpuLeakDetector(_delta: number): void {
    if (!SHOW_UI || !panelEl) return;
    refreshStats();

    if (!sampling) return;
    const live = getGpuResourceLiveCounts();
    if (sampleMin) {
        sampleMin.geometries = Math.min(sampleMin.geometries, live.geometries);
        sampleMin.materials = Math.min(sampleMin.materials, live.materials);
    }
    if (sampleMax) {
        sampleMax.geometries = Math.max(sampleMax.geometries, live.geometries);
        sampleMax.materials = Math.max(sampleMax.materials, live.materials);
    }
    sampleFramesLeft--;
    if (sampleFramesLeft <= 0) {
        sampling = false;
        if (sampleEl && sampleBaseline && sampleMin && sampleMax) {
            sampleEl.textContent =
                `After cleanup (${SAMPLE_FRAMES}f):\n` +
                `  geo live=${live.geometries} (min ${sampleMin.geometries}, max ${sampleMax.geometries}; was ${sampleBaseline.geometries})\n` +
                `  mat live=${live.materials} (min ${sampleMin.materials}, max ${sampleMax.materials}; was ${sampleBaseline.materials})\n` +
                `  texturesDisposed=${gpuResourceStats.texturesDisposed}`;
        }
    } else if (sampleEl) {
        sampleEl.textContent =
            `Sampling… ${sampleFramesLeft}f left\n` +
            `  geo=${live.geometries} mat=${live.materials}`;
    }
}

function refreshStats(): void {
    if (!statsEl) return;
    const live = getGpuResourceLiveCounts();
    statsEl.textContent =
        `live geo≈${live.geometries}  mat≈${live.materials}\n` +
        `created geo=${gpuResourceStats.geometriesCreated} mat=${gpuResourceStats.materialsCreated}\n` +
        `disposed geo=${gpuResourceStats.geometriesDisposed} mat=${gpuResourceStats.materialsDisposed} tex=${gpuResourceStats.texturesDisposed}`;
}

/**
 * Decoration Budget Auditor — dev-only "declared vs observed" drift check.
 *
 * `decoration_budget.ts` only knows what it's told: a system that spawns 3D
 * props without ever calling `register`/`syncCount`/`reportSpawn` is
 * completely invisible to it. This module cross-checks the registry against
 * the actual scene graph so that kind of gap shows up somewhere, even though
 * nobody remembered to register the offending system.
 *
 * Attribution approach (why this shape, not per-system attribution):
 * Walking `scene.traverse()` cannot honestly say *which* decoration_budget id
 * owns a given `THREE.Mesh`/`THREE.InstancedMesh` — that would need every one
 * of the ~70 env systems (and everything else in the scene: the player ship,
 * HUD-adjacent meshes, terrain, obstacles, geological props with their own
 * non-decoration-budget lifecycles, ...) to tag `mesh.userData` with a budget
 * id at creation time. That's a much bigger, more invasive change than this
 * pass is scoped for, and it would need to be kept in sync by hand forever.
 *
 * Instead this auditor compares two honest aggregates:
 *   - observed: sum of `.count` for every `THREE.InstancedMesh` in the scene,
 *     plus 1 for every plain `THREE.Mesh`, walked recursively from the scene root
 *   - declared: sum of `currentActive` across every `decorationBudget.getSnapshot()` entry
 *
 * A raw `observed > declared` comparison would be permanently and hugely
 * "over" — the scene is full of legitimate meshes decoration_budget was never
 * meant to track (the rocket, moon/galaxies, obstacles, HUD props, geological
 * objects with their own counters, etc.), so an absolute-value threshold would
 * just be constant noise, not a signal. Instead this auditor tracks the gap
 * (`observed - declared`) *relative to a baseline captured the first time it
 * samples the scene*, and only flags drift when the gap grows meaningfully
 * beyond that baseline — i.e. something new is adding scene nodes without a
 * matching registry update, rather than "the scene has other stuff in it"
 * (which is expected and constant). This is coarse — it cannot say which
 * system is responsible — but it's a real, low-risk, low-complexity signal
 * that something is spawning outside the registry, which is honest given what
 * scene-graph traversal alone can tell us.
 */
import * as THREE from 'three';
import type { DebugSystem } from './debug_system';
import { decorationBudget, DECORATION_BUDGET_UI } from './decoration_budget';

/** Gap growth beyond the recorded baseline before we call it "drift" in the UI. */
const DRIFT_THRESHOLD = 50;

export class DecorationBudgetAuditor {
    private scene: THREE.Scene;
    private sectionEl: HTMLDivElement | null = null;
    private bodyEl: HTMLDivElement | null = null;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private baselineGap: number | null = null;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    attachToDebugSystem(debug: DebugSystem): void {
        if (!DECORATION_BUDGET_UI) return;
        this._ensureSection(debug.getCustomSectionContainer());
        debug.onVisibilityChange((visible) => {
            if (this.sectionEl) this.sectionEl.style.display = visible ? 'block' : 'none';
            if (visible) {
                this._refresh();
                this._startInterval();
            } else {
                this._stopInterval();
            }
        });
    }

    private _startInterval(): void {
        if (this.intervalId !== null) return;
        // decoration_budget.ts's own panel has no periodic refresh of its own —
        // it repaints reactively on register/syncCount/reportSpawn/reportDestroy,
        // so there's no existing "auditor cadence" to mirror there. A scene walk
        // needs *some* periodic tick since there's no hook for arbitrary mesh
        // add/remove, so this matches DebugSystem's own FPS refresh cadence
        // (0.25s) — the nearest real periodic-refresh precedent in this codebase.
        this.intervalId = setInterval(() => this._refresh(), 250);
    }

    private _stopInterval(): void {
        if (this.intervalId === null) return;
        clearInterval(this.intervalId);
        this.intervalId = null;
    }

    private _ensureSection(container: HTMLDivElement): void {
        if (this.sectionEl) return;

        this.sectionEl = document.createElement('div');
        this.sectionEl.style.cssText = `
            margin-top: 8px;
            padding-top: 6px;
            border-top: 1px solid rgba(255,255,255,0.15);
            display: none;
        `;

        const header = document.createElement('div');
        header.style.cssText = 'font-weight: bold; font-size: 12px; margin-bottom: 4px; color: #9fdcff;';
        header.textContent = 'Decoration Budget Auditor';
        this.sectionEl.appendChild(header);

        this.bodyEl = document.createElement('div');
        this.bodyEl.style.cssText = 'font-family: monospace; font-size: 10px; color: #ddd; line-height: 1.5;';
        this.sectionEl.appendChild(this.bodyEl);

        container.appendChild(this.sectionEl);
    }

    /** Sum InstancedMesh `.count` + 1 per plain Mesh, walked recursively from the scene root. */
    private _countSceneNodes(): number {
        let observed = 0;
        this.scene.traverse((obj) => {
            const instanced = obj as THREE.InstancedMesh;
            if (instanced.isInstancedMesh) {
                observed += instanced.count;
            } else if ((obj as THREE.Mesh).isMesh) {
                observed += 1;
            }
        });
        return observed;
    }

    private _refresh(): void {
        if (!this.bodyEl) return;

        const observed = this._countSceneNodes();
        const declared = decorationBudget
            .getSnapshot()
            .reduce((sum, entry) => sum + entry.currentActive, 0);
        const gap = observed - declared;

        if (this.baselineGap === null) {
            this.baselineGap = gap;
        }

        const drift = gap - this.baselineGap;
        const isDrifting = drift > DRIFT_THRESHOLD;
        const color = isDrifting ? '#ff6b6b' : '#8fd9a8';

        this.bodyEl.innerHTML = `
            <div>Scene mesh nodes: ${observed}</div>
            <div>Declared active: ${declared}</div>
            <div>Gap: ${gap} <span style="color:#888;">(baseline ${this.baselineGap})</span></div>
            <div style="color:${color};">${isDrifting ? `Drift: +${drift} beyond baseline` : 'No drift beyond baseline'}</div>
        `;
    }
}

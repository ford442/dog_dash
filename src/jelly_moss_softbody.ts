/**
 * jelly_moss_softbody.ts
 *
 * Consumer of the WASM Verlet physics exports (`assembly/physics.ts`, ported
 * from the experimental C++ tree's `cpp/src/physics.cpp` — see
 * docs/WASM_BACKENDS.md). Once a handle exposing the Verlet exports is
 * bound, up to MAX_HERO_MOSSES Nebula Jelly-Moss instances get a small
 * soft-body net for their fractal-moss cores. Springs live in TS;
 * integration runs in WASM via `stepPhysics`.
 *
 * `stepPhysics` ships in the default AssemblyScript build, but soft-body
 * Jelly-Moss is *opt-in per level*: `setLevelEnabled()` is driven from the
 * level's `environments.dancingJellyMoss` flag, so levels that do not ask for
 * dancing moss pay nothing. When it is off — or when WASM fails to load
 * entirely (`handle` is null) — this stays idle and the membrane sine/fbm
 * shader wobble covers the visual.
 */

import * as THREE from 'three';
import {
    type WasmBackend,
    type WasmHandle,
} from './wasm_loader';
import { verletBodyPool } from './verlet_body_pool';

const MAX_HERO_MOSSES = 3;
const MAX_CORES_PER_MOSS = 8;
const MAX_BODIES = MAX_HERO_MOSSES * MAX_CORES_PER_MOSS;

const SPRING_REST = 48;
const SPRING_NEIGHBOR = 22;
const DAMPING = 6.5;
const HIT_IMPULSE = 180;
const PLAYER_IMPULSE = 35;

export type SoftBodySlot = {
    mesh: THREE.Mesh;
    cores: THREE.Object3D[];
    bodyStart: number;
    bodyCount: number;
    restX: Float32Array;
    restY: Float32Array;
    baseScale: number;
};

function hasSoftBodyPhysics(): boolean {
    return verletBodyPool.isReady;
}

/**
 * Soft-body controller for hero Jelly-Moss cores.
 */
export class JellyMossSoftBodySystem {
    private handle: WasmHandle | null = null;
    private slots: SoftBodySlot[] = [];
    private bodyCount = 0;
    private active = false;
    private bound = false;
    private levelEnabled = false;
    private pendingMeshes: THREE.Mesh[] = [];
    private registered = false;

    /** True when C++ Verlet is bound and at least one hero moss is attached. */
    get isActive(): boolean {
        return this.active && this.slots.length > 0;
    }

    get backend(): WasmBackend | null {
        return this.handle?.backend ?? null;
    }

    /** Bind a loaded WASM handle. No-op / disables when not Cpp or missing physics exports. */
    bindWasm(handle: WasmHandle | null): void {
        this.clear();
        this.handle = null;
        this.active = false;
        this.bodyCount = 0;
        this.bound = true;
        verletBodyPool.bindWasm(handle);
        this.ensureRegistered();

        if (!handle) {
            this.pendingMeshes = [];
            this.publishBreadcrumb();
            return;
        }
        if (!hasSoftBodyPhysics()) {
            console.warn('[jelly-moss softbody] WASM missing Verlet exports; staying on shader wobble');
            this.pendingMeshes = [];
            this.publishBreadcrumb();
            return;
        }

        this.handle = handle;
        this.active = true;
        const pending = this.pendingMeshes.splice(0);
        for (const mesh of pending) {
            this.tryAttach(mesh);
        }
        this.publishBreadcrumb();
        console.log('[jelly-moss softbody] Verlet ready (hero moss cores)');
    }

    /**
     * Per-level opt-in, driven from `environments.dancingJellyMoss`.
     * Turning it off drops every attached hero moss back to shader wobble.
     */
    setLevelEnabled(enabled: boolean): void {
        if (this.levelEnabled === enabled) return;
        this.levelEnabled = enabled;
        if (!enabled) {
            this.pendingMeshes = [];
            this.clear();
        }
    }

    /**
     * Attach soft-body net to a Nebula Jelly-Moss if capacity remains.
     * Returns true when Verlet will drive its cores.
     */
    tryAttach(mesh: THREE.Mesh): boolean {
        if (!this.levelEnabled) return false;
        if (!this.active || !this.handle) {
            // Queue only while WASM load is still outstanding
            if (!this.bound && !this.pendingMeshes.includes(mesh) && this.pendingMeshes.length < MAX_HERO_MOSSES) {
                this.pendingMeshes.push(mesh);
            }
            return false;
        }
        if (this.slots.length >= MAX_HERO_MOSSES) return false;
        if (this.slots.some((s) => s.mesh === mesh)) return true;

        const coreGroup = mesh.children[0] as THREE.Group | undefined;
        if (!coreGroup || coreGroup.children.length === 0) return false;

        const cores = coreGroup.children.slice(0, MAX_CORES_PER_MOSS);
        const bodyStart = this.bodyCount;
        const bodyCount = cores.length;
        if (bodyStart + bodyCount > MAX_BODIES) return false;

        const restX = new Float32Array(bodyCount);
        const restY = new Float32Array(bodyCount);
        const exports = verletBodyPool.exports;
        if (!exports) return false;

        for (let i = 0; i < bodyCount; i++) {
            const core = cores[i];
            restX[i] = core.position.x;
            restY[i] = core.position.y;
            const idx = bodyStart + i;
            exports.setBodyPosition!(idx, restX[i], restY[i]);
        }

        this.bodyCount = bodyStart + bodyCount;
        this.slots.push({
            mesh,
            cores,
            bodyStart,
            bodyCount,
            restX,
            restY,
            baseScale: mesh.scale.x || 1,
        });
        mesh.userData.softBodyHero = true;
        verletBodyPool.relayout();
        this.publishBreadcrumb();
        return true;
    }

    /** Detach a moss (destroy / stream cleanup). Safe if never attached. */
    detach(mesh: THREE.Mesh): void {
        this.pendingMeshes = this.pendingMeshes.filter((m) => m !== mesh);
        const idx = this.slots.findIndex((s) => s.mesh === mesh);
        if (idx < 0) return;
        mesh.userData.softBodyHero = false;
        this.slots.splice(idx, 1);
        verletBodyPool.relayout();
        this.publishBreadcrumb();
    }

    clear(): void {
        for (const slot of this.slots) {
            slot.mesh.userData.softBodyHero = false;
        }
        this.slots = [];
        this.bodyCount = 0;
        if (this.registered) verletBodyPool.relayout();
        this.publishBreadcrumb();
    }

    /** Impulse from projectile / player in moss-local XY. */
    applyImpulse(mesh: THREE.Mesh, localAx: number, localAy: number, strength = HIT_IMPULSE): void {
        if (!this.active || !verletBodyPool.isReady) return;
        const slot = this.slots.find((s) => s.mesh === mesh);
        if (!slot) return;
        const exports = verletBodyPool.exports;
        if (!exports) return;
        for (let i = 0; i < slot.bodyCount; i++) {
            exports.addBodyAcceleration!(slot.bodyStart + i, localAx * strength, localAy * strength);
        }
    }

    /** Gentle push when the player brushes a hero moss. */
    applyPlayerProximity(mesh: THREE.Mesh, playerLocalX: number, playerLocalY: number): void {
        const len = Math.hypot(playerLocalX, playerLocalY) || 1;
        this.applyImpulse(mesh, playerLocalX / len, playerLocalY / len, PLAYER_IMPULSE);
    }

    /** Spring forces only — `verletBodyPool.step` integrates every consumer. */
    applyForces(): void {
        if (!this.active || !verletBodyPool.isReady || this.slots.length === 0 || this.bodyCount <= 0) return;
        const exports = verletBodyPool.exports;
        if (!exports) return;

        for (const slot of this.slots) {
            for (let i = 0; i < slot.bodyCount; i++) {
                const idx = slot.bodyStart + i;
                const x = exports.getBodyPositionX!(idx);
                const y = exports.getBodyPositionY!(idx);

                // Approximate velocity from Verlet prev via tiny probe: use rest spring + neighbor
                // Rest spring
                let ax = (slot.restX[i] - x) * SPRING_REST;
                let ay = (slot.restY[i] - y) * SPRING_REST;

                // Ring neighbor springs
                const next = (i + 1) % slot.bodyCount;
                const nx = exports.getBodyPositionX!(slot.bodyStart + next);
                const ny = exports.getBodyPositionY!(slot.bodyStart + next);
                const restDx = slot.restX[next] - slot.restX[i];
                const restDy = slot.restY[next] - slot.restY[i];
                const curDx = nx - x;
                const curDy = ny - y;
                ax += (curDx - restDx) * SPRING_NEIGHBOR;
                ay += (curDy - restDy) * SPRING_NEIGHBOR;

                // Damping toward rest (velocity-free approximation: pull back from offset)
                ax += (slot.restX[i] - x) * DAMPING;
                ay += (slot.restY[i] - y) * DAMPING;

                exports.addBodyAcceleration!(idx, ax, ay);
            }
        }
    }

    syncVisuals(): void {
        if (!this.active || !verletBodyPool.isReady || this.slots.length === 0) return;
        const exports = verletBodyPool.exports;
        if (!exports) return;

        for (const slot of this.slots) {
            let energy = 0;
            for (let i = 0; i < slot.bodyCount; i++) {
                const idx = slot.bodyStart + i;
                const x = exports.getBodyPositionX!(idx);
                const y = exports.getBodyPositionY!(idx);
                const core = slot.cores[i];
                if (core) {
                    core.position.x = x;
                    core.position.y = y;
                }
                const dx = x - slot.restX[i];
                const dy = y - slot.restY[i];
                energy += dx * dx + dy * dy;
            }
            // Subtle whole-mesh jiggle from soft-body energy (bone-like offset signal)
            const jiggle = Math.min(0.12, Math.sqrt(energy) * 0.015);
            const s = slot.baseScale * (1 + jiggle);
            slot.mesh.scale.setScalar(s);
        }
    }

    /**
     * Per-frame convenience when kelp is not sharing the pool this frame.
     * Prefer applyForces → pool.step → syncVisuals from the geological loop.
     */
    update(delta: number): void {
        this.applyForces();
        verletBodyPool.step(delta, 0);
        this.syncVisuals();
    }

    /** Re-pack body indices after attach/detach (shared pool cursor). */
    repack(cursor: number): number {
        if (!this.active || !verletBodyPool.isReady) {
            this.bodyCount = 0;
            return cursor;
        }
        const exports = verletBodyPool.exports;
        if (!exports) {
            this.bodyCount = 0;
            return cursor;
        }
        let next = cursor;
        for (const slot of this.slots) {
            for (let i = 0; i < slot.bodyCount; i++) {
                const core = slot.cores[i];
                const x = core?.position.x ?? slot.restX[i];
                const y = core?.position.y ?? slot.restY[i];
                exports.setBodyPosition!(next + i, x, y);
            }
            slot.bodyStart = next;
            next += slot.bodyCount;
        }
        this.bodyCount = next - cursor;
        return next;
    }

    private ensureRegistered(): void {
        if (this.registered) return;
        verletBodyPool.register({
            id: 'jelly-moss',
            repack: (cursor) => this.repack(cursor)
        });
        this.registered = true;
    }

    private publishBreadcrumb(): void {
        if (typeof window === 'undefined') return;
        window.jellyMossSoftBodyActive = this.isActive;
        window.jellyMossSoftBodyHeroCount = this.slots.length;
    }
}

/** Shared instance used by environment / geological loop / startup. */
export const jellyMossSoftBody = new JellyMossSoftBodySystem();

declare global {
    interface Window {
        jellyMossSoftBodyActive?: boolean;
        jellyMossSoftBodyHeroCount?: number;
        wasmBackend?: string | null;
    }
}

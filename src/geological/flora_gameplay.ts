/**
 * Pure flora gameplay numbers — Vacuum Kelp, Ice Needles, Magma Hearts.
 *
 * Kid-tuned from docs/plans/plan.md: same verbs (drain, harvest, melt, erupt)
 * with side-scroller scale (strands tens of meters, not 20–30 m node gaps).
 */

export const KELP_MIN_NODES = 5;
export const KELP_MAX_NODES = 8;
export const KELP_NODE_HP = 50;
export const KELP_DRAIN_BASE = 3;
export const KELP_DRAIN_CAP = 12;
export const KELP_SPEED_MUL = 0.3;
export const KELP_QUANTUM_SEED_CHANCE = 0.15;
export const KELP_CONTACT_RADIUS = 2.2;

export const ICE_HEX_SPACING = 5;
export const ICE_BOOST_MELT_RADIUS = 3;
export const ICE_BOOST_MELT_SECONDS = 2;
export const ICE_MAGMA_SUBLIMATE_RADIUS = 20;
export const ICE_CONTACT_RADIUS = 1.6;
export const CRYO_MAX_STACKS = 3;
export const CRYO_DURATION = 15;
export const CRYO_SPEED_PENALTY = 0.1;

export const MAGMA_BUILD_SECONDS = 12;
export const MAGMA_CRITICAL_SECONDS = 5;
export const MAGMA_ERUPTION_SECONDS = 2.2;
export const MAGMA_COOLDOWN_SECONDS = 15;
export const MAGMA_CORE_HP = 200;
export const MAGMA_GLOB_COUNT_MIN = 8;
export const MAGMA_GLOB_COUNT_MAX = 12;
export const MAGMA_GLOB_SPEED = 28;
export const MAGMA_GLOB_RADIUS = 0.55;

export type MagmaPhase = 'build' | 'critical' | 'eruption' | 'cooldown';

export type KelpConfig = {
    nodes: number;
    length: number;
    nodeSpacing: number;
};

/** 5–8 nodes; length from kid-scale spacing (not plan 20–30 m gaps). */
export function pickKelpConfig(random: () => number): KelpConfig {
    const span = KELP_MAX_NODES - KELP_MIN_NODES + 1;
    const nodes = KELP_MIN_NODES + Math.floor(clamp01(random()) * span);
    const nodeSpacing = 2.4 + clamp01(random()) * 1.2;
    return { nodes, nodeSpacing, length: nodes * nodeSpacing };
}

/** 3 energy/sec, doubling each consecutive contact second, cap 12. */
export function kelpDrainPerSec(consecutiveSeconds: number): number {
    const steps = Math.max(0, Math.floor(consecutiveSeconds));
    return Math.min(KELP_DRAIN_CAP, KELP_DRAIN_BASE * 2 ** steps);
}

export function kelpSpeedMultiplier(inContact: boolean): number {
    return inContact ? KELP_SPEED_MUL : 1;
}

export function applyEnergyDrain(energy: number, drainPerSec: number, dt: number): number {
    return Math.max(0, energy - drainPerSec * dt);
}

export function regenEnergy(energy: number, maxEnergy: number, dt: number, regenPerSec = 8): number {
    return Math.min(maxEnergy, energy + regenPerSec * dt);
}

export type HexOffset = { x: number; y: number; z: number };

/**
 * Axial hex grid in XZ, slight Y stagger. Needles sit on these offsets so they
 * radiate as a crystal matrix rather than stacking on the origin.
 */
export function hexNeedleOffsets(count: number, spacing = ICE_HEX_SPACING): HexOffset[] {
    const out: HexOffset[] = [];
    if (count <= 0) return out;
    out.push({ x: 0, y: 0.4, z: 0 });
    let ring = 1;
    while (out.length < count) {
        for (let i = 0; i < 6 && out.length < count; i++) {
            const cornerQ = hexCornerQ(i) * ring;
            const cornerR = hexCornerR(i) * ring;
            const nextQ = hexCornerQ((i + 1) % 6) * ring;
            const nextR = hexCornerR((i + 1) % 6) * ring;
            for (let s = 0; s < ring && out.length < count; s++) {
                const t = s / ring;
                const q = cornerQ + (nextQ - cornerQ) * t;
                const r = cornerR + (nextR - cornerR) * t;
                const { x, z } = axialToWorld(q, r, spacing);
                const y = ((Math.abs(q) + Math.abs(r)) % 3) * 0.35;
                out.push({ x, y, z });
            }
        }
        ring++;
        if (ring > 24) break;
    }
    return out;
}

function hexCornerQ(i: number): number {
    return [1, 0, -1, -1, 0, 1][i]!;
}

function hexCornerR(i: number): number {
    return [0, 1, 1, 0, -1, -1][i]!;
}

function axialToWorld(q: number, r: number, spacing: number): { x: number; z: number } {
    const x = spacing * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
    const z = spacing * ((3 / 2) * r);
    return { x, z };
}

export function applyCryoHit(stacks: number): number {
    return Math.min(CRYO_MAX_STACKS, Math.max(0, stacks) + 1);
}

export function cryoSpeedMultiplier(stacks: number): number {
    const s = Math.max(0, Math.min(CRYO_MAX_STACKS, stacks));
    return Math.max(0.4, 1 - CRYO_SPEED_PENALTY * s);
}

export function meltProgress(current: number, dt: number, melting: boolean): number {
    if (!melting) return Math.max(0, current - dt * 0.15);
    return Math.min(1, current + dt / ICE_BOOST_MELT_SECONDS);
}

export type MagmaCycle = {
    phase: MagmaPhase;
    /** 0–1 within the current phase. */
    phaseT: number;
    /** 0–1 pressure (build+critical), 1 during eruption, 0 during cooldown. */
    pressure: number;
    telegraph: boolean;
};

const MAGMA_CYCLE =
    MAGMA_BUILD_SECONDS + MAGMA_CRITICAL_SECONDS + MAGMA_ERUPTION_SECONDS + MAGMA_COOLDOWN_SECONDS;

export function magmaCycleAt(timeInCycle: number): MagmaCycle {
    const t = ((timeInCycle % MAGMA_CYCLE) + MAGMA_CYCLE) % MAGMA_CYCLE;
    if (t < MAGMA_BUILD_SECONDS) {
        const phaseT = t / MAGMA_BUILD_SECONDS;
        return { phase: 'build', phaseT, pressure: phaseT * 0.8, telegraph: false };
    }
    const afterBuild = t - MAGMA_BUILD_SECONDS;
    if (afterBuild < MAGMA_CRITICAL_SECONDS) {
        const phaseT = afterBuild / MAGMA_CRITICAL_SECONDS;
        return { phase: 'critical', phaseT, pressure: 0.8 + phaseT * 0.2, telegraph: true };
    }
    const afterCrit = afterBuild - MAGMA_CRITICAL_SECONDS;
    if (afterCrit < MAGMA_ERUPTION_SECONDS) {
        return { phase: 'eruption', phaseT: afterCrit / MAGMA_ERUPTION_SECONDS, pressure: 1, telegraph: true };
    }
    const coolT = (afterCrit - MAGMA_ERUPTION_SECONDS) / MAGMA_COOLDOWN_SECONDS;
    return { phase: 'cooldown', phaseT: coolT, pressure: 0, telegraph: false };
}

export function magmaGlobCount(random: () => number): number {
    const span = MAGMA_GLOB_COUNT_MAX - MAGMA_GLOB_COUNT_MIN + 1;
    return MAGMA_GLOB_COUNT_MIN + Math.floor(clamp01(random()) * span);
}

export function magmaGlobDirections(count: number): Array<{ x: number; y: number; z: number }> {
    const dirs: Array<{ x: number; y: number; z: number }> = [];
    for (let i = 0; i < count; i++) {
        const theta = (i / count) * Math.PI * 2;
        const tilt = (i % 3) * 0.22 - 0.22;
        const x = Math.cos(theta);
        const z = Math.sin(theta);
        const y = tilt;
        const len = Math.hypot(x, y, z) || 1;
        dirs.push({ x: x / len, y: y / len, z: z / len });
    }
    return dirs;
}

export function pickIceNeedleCount(random: () => number): number {
    return 12 + Math.floor(clamp01(random()) * 7);
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
}

/**
 * Data Monoliths — circuitry-trace hacking artifact (plan §III).
 *
 * A rotating slab with glowing traces. The player traces a path from the input
 * node to the output node with a cursor, avoiding moving "firewall" blocks.
 * Three difficulty tiers scale grid size, firewall count, and a time limit.
 * Decoding a monolith reveals a lore fragment about "The Architects" and grants
 * a permanent flora damage bonus.
 *
 * This module owns the 3D slab prop, the puzzle model, and the overlay UI.
 * Orchestration lives in main/artifact_update.
 */

import * as THREE from 'three';
import { decorationBudget } from './decoration_budget';
import {
    HackSession, createHackOverlay, createHackPanel, renderMistakePips,
    HACK_ACCENT, HACK_ACCENT_GOOD, HACK_ACCENT_WARN, type HackFailReason
} from './hacking_minigame';

const MONOLITH_BUDGET_ID = 'data_monolith';

export type MonolithTier = 1 | 2 | 3;

export interface MonolithTierConfig {
    tier: MonolithTier;
    gridSize: number;
    firewalls: number;
    /** 0 = no timer. */
    timeLimit: number;
    /** Firewall movement speed (cells/sec, 0 = static). */
    firewallSpeed: number;
    maxMistakes: number;
}

export const MONOLITH_TIERS: Record<MonolithTier, MonolithTierConfig> = {
    1: { tier: 1, gridSize: 5, firewalls: 2, timeLimit: 0, firewallSpeed: 0, maxMistakes: 3 },
    2: { tier: 2, gridSize: 6, firewalls: 4, timeLimit: 30, firewallSpeed: 0.6, maxMistakes: 3 },
    3: { tier: 3, gridSize: 7, firewalls: 6, timeLimit: 20, firewallSpeed: 1.1, maxMistakes: 3 }
};

interface Cell { r: number; c: number; }

export type Direction = 'up' | 'down' | 'left' | 'right';

const DIR_DELTA: Record<Direction, Cell> = {
    up: { r: -1, c: 0 },
    down: { r: 1, c: 0 },
    left: { r: 0, c: -1 },
    right: { r: 0, c: 1 }
};

function cellKey(cell: Cell): string {
    return `${cell.r},${cell.c}`;
}

/** Generates a monotonic-ish path from left edge to right edge across the grid. */
function generateTracePath(size: number): Cell[] {
    let r = Math.floor(Math.random() * size);
    const path: Cell[] = [{ r, c: 0 }];
    for (let c = 1; c < size; c++) {
        // Optionally jog vertically before stepping right, keeping in-bounds.
        const jog = Math.random();
        if (jog < 0.33 && r > 0) {
            r -= 1;
            path.push({ r, c: c - 1 });
        } else if (jog > 0.66 && r < size - 1) {
            r += 1;
            path.push({ r, c: c - 1 });
        }
        path.push({ r, c });
    }
    return path;
}

interface Firewall {
    r: number;
    c: number;
    dir: 1 | -1;
    progress: number;
}

export interface MonolithPuzzle {
    size: number;
    path: Cell[];
    firewalls: Firewall[];
    pathSet: Set<string>;
    config: MonolithTierConfig;
}

export function createMonolithPuzzle(tier: MonolithTier): MonolithPuzzle {
    const config = MONOLITH_TIERS[tier];
    const size = config.gridSize;
    const path = generateTracePath(size);
    const pathSet = new Set(path.map(cellKey));

    // Place firewalls on cells that are NOT the start/end and (for tier 1) not on
    // the path, so a static board is always solvable.
    const firewalls: Firewall[] = [];
    const startEnd = new Set([cellKey(path[0]), cellKey(path[path.length - 1])]);
    let guard = 0;
    while (firewalls.length < config.firewalls && guard++ < 200) {
        const r = Math.floor(Math.random() * size);
        const c = Math.floor(Math.random() * size);
        const key = `${r},${c}`;
        if (startEnd.has(key)) continue;
        if (config.firewallSpeed === 0 && pathSet.has(key)) continue; // static must stay off-path
        if (firewalls.some(f => f.r === r && f.c === c)) continue;
        firewalls.push({ r, c, dir: Math.random() < 0.5 ? 1 : -1, progress: 0 });
    }
    return { size, path, firewalls, pathSet, config };
}

/** Advances moving firewalls (tiers 2–3). Bounces at grid edges. */
export function updateMonolithFirewalls(puzzle: MonolithPuzzle, delta: number): void {
    const speed = puzzle.config.firewallSpeed;
    if (speed === 0) return;
    for (const f of puzzle.firewalls) {
        f.progress += delta * speed;
        while (f.progress >= 1) {
            f.progress -= 1;
            f.r += f.dir;
            if (f.r < 0) { f.r = 0; f.dir = 1; }
            else if (f.r > puzzle.size - 1) { f.r = puzzle.size - 1; f.dir = -1; }
        }
    }
}

function firewallAt(puzzle: MonolithPuzzle, cell: Cell): boolean {
    return puzzle.firewalls.some(f => f.r === cell.r && f.c === cell.c);
}

function createMonolithMesh(tier: MonolithTier): THREE.Group {
    const group = new THREE.Group();

    const slab = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 4.0, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x101826, metalness: 0.6, roughness: 0.35 })
    );
    group.add(slab);

    // Emissive circuit traces on the face.
    const traceColor = tier === 3 ? 0xff55aa : tier === 2 ? 0xaa66ff : HACK_ACCENT;
    for (let i = 0; i < 5; i++) {
        const trace = new THREE.Mesh(
            new THREE.BoxGeometry(1.8, 0.05, 0.02),
            new THREE.MeshBasicMaterial({ color: traceColor, transparent: true, opacity: 0.75 })
        );
        trace.position.set((Math.random() - 0.5) * 0.6, -1.6 + i * 0.8, 0.26);
        trace.userData.isTrace = true;
        group.add(trace);
    }

    const glyph = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.06, 8, 24),
        new THREE.MeshBasicMaterial({ color: traceColor, transparent: true, opacity: 0.8 })
    );
    glyph.position.set(0, 0, 0.28);
    glyph.userData.isGlyph = true;
    group.add(glyph);

    group.userData.type = 'dataMonolith';
    group.userData.speciesId = 'dataMonolith';
    group.userData.tier = tier;
    return group;
}

export interface MonolithPlacement {
    x: number;
    y: number;
    z?: number;
    tier?: MonolithTier;
}

export interface DataMonolithInstance {
    group: THREE.Group;
    tier: MonolithTier;
    consumed: boolean;
}

export const MONOLITH_INTERACT_RADIUS = 5;

export class DataMonolithManager {
    private readonly scene: THREE.Scene;
    private monoliths: DataMonolithInstance[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    getScannables(): THREE.Object3D[] {
        return this.monoliths.map(m => m.group);
    }

    hasMonoliths(): boolean {
        return this.monoliths.length > 0;
    }

    clear(): void {
        for (const m of this.monoliths) {
            this.scene.remove(m.group);
            m.group.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    const mat = child.material;
                    if (Array.isArray(mat)) mat.forEach(x => x.dispose());
                    else mat.dispose();
                }
            });
        }
        decorationBudget.reportDestroy(MONOLITH_BUDGET_ID, this.monoliths.length);
        this.monoliths = [];
    }

    spawnForLevel(placements: MonolithPlacement[], baseX: number): void {
        for (const p of placements) {
            if (!decorationBudget.canSpawn(MONOLITH_BUDGET_ID, 1)) break;
            const tier: MonolithTier = p.tier ?? 1;
            const group = createMonolithMesh(tier);
            group.position.set(baseX + p.x, p.y, p.z ?? -8);
            this.scene.add(group);
            decorationBudget.reportSpawn(MONOLITH_BUDGET_ID, 1);
            this.monoliths.push({ group, tier, consumed: false });
        }
    }

    update(delta: number): void {
        const t = performance.now() * 0.001;
        for (const m of this.monoliths) {
            // Tier 2+ slabs slowly rotate; tier 1 stays face-on.
            if (m.tier >= 2 && !m.consumed) m.group.rotation.y += delta * 0.25;
            m.group.children.forEach(child => {
                if (child instanceof THREE.Mesh && child.userData.isGlyph) {
                    (child.material as THREE.MeshBasicMaterial).opacity =
                        m.consumed ? 0.25 : 0.6 + Math.sin(t * 2.5) * 0.25;
                }
            });
        }
    }

    /** Nearest un-consumed monolith within interact radius, or null. */
    getInteractable(playerPos: THREE.Vector3): DataMonolithInstance | null {
        let best: DataMonolithInstance | null = null;
        let bestDist = MONOLITH_INTERACT_RADIUS;
        for (const m of this.monoliths) {
            if (m.consumed) continue;
            const d = m.group.position.distanceTo(playerPos);
            if (d <= bestDist) {
                best = m;
                bestDist = d;
            }
        }
        return best;
    }

    isInRange(m: DataMonolithInstance, playerPos: THREE.Vector3): boolean {
        return m.group.position.distanceTo(playerPos) <= MONOLITH_INTERACT_RADIUS + 1;
    }
}

// --- Hack overlay UI ----------------------------------------------------------

export interface MonolithHackCallbacks {
    onSuccess: () => void;
    onFail: (reason: HackFailReason) => void;
    onAbort: () => void;
    playBlip: (correct: boolean) => void;
}

export interface MonolithHackHandle {
    element: HTMLDivElement;
    update: (delta: number) => void;
    close: () => void;
    /** Feed a direction from keyboard/touch (also usable in tests). */
    move: (dir: Direction) => void;
}

/**
 * Builds the trace-puzzle overlay. Handles its own keyboard (arrows / WASD) and
 * touch (tap adjacent cells + D-pad), so the caller only appends the element and
 * calls update(delta) each frame.
 */
export function createMonolithHackUI(
    puzzle: MonolithPuzzle,
    callbacks: MonolithHackCallbacks
): MonolithHackHandle {
    const overlay = createHackOverlay();
    const panel = createHackPanel();
    overlay.appendChild(panel);

    const size = puzzle.size;
    const start = puzzle.path[0];
    const end = puzzle.path[puzzle.path.length - 1];
    let cursor: Cell = { ...start };
    let pathProgress = 0; // index into puzzle.path reached
    let finished = false;

    const session = new HackSession({
        maxMistakes: puzzle.config.maxMistakes,
        timeLimit: puzzle.config.timeLimit,
        onSuccess: () => {},
        onFail: (reason) => finish(false, reason),
        onTick: () => renderStatus()
    });

    const gridEl = document.createElement('div');
    const statusEl = document.createElement('div');

    const finish = (success: boolean, reason?: HackFailReason) => {
        if (finished) return;
        finished = true;
        cleanup();
        if (success) callbacks.onSuccess();
        else callbacks.onFail(reason ?? 'mistakes');
    };

    const renderGrid = () => {
        gridEl.style.cssText = `
            display: grid;
            grid-template-columns: repeat(${size}, 1fr);
            gap: 4px;
            margin: 14px auto;
            max-width: ${Math.min(size * 56, 360)}px;
        `;
        gridEl.replaceChildren();
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell: Cell = { r, c };
                const onPath = puzzle.pathSet.has(cellKey(cell));
                const isFirewall = firewallAt(puzzle, cell);
                const isCursor = cursor.r === r && cursor.c === c;
                const isEnd = end.r === r && end.c === c;
                const isStart = start.r === r && start.c === c;

                const btn = document.createElement('button');
                let bg = 'rgba(20,32,48,0.7)';
                let border = '#2a3a4d';
                if (onPath) { bg = 'rgba(51,224,255,0.12)'; border = HACK_ACCENT; }
                if (isEnd) { bg = 'rgba(102,255,170,0.18)'; border = HACK_ACCENT_GOOD; }
                if (isFirewall) { bg = 'rgba(255,85,119,0.4)'; border = HACK_ACCENT_WARN; }
                if (isCursor) { bg = 'rgba(102,255,170,0.55)'; border = HACK_ACCENT_GOOD; }

                btn.style.cssText = `
                    aspect-ratio: 1;
                    border-radius: 6px;
                    background: ${bg};
                    border: 2px solid ${border};
                    color: #eaf6ff;
                    font-size: 1.1em;
                    cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: ${isCursor ? '0 0 12px ' + HACK_ACCENT_GOOD : 'none'};
                `;
                btn.textContent = isCursor ? '◈' : isStart ? '▶' : isEnd ? '★' : isFirewall ? '✕' : '';
                btn.addEventListener('click', () => tapCell(cell));
                gridEl.appendChild(btn);
            }
        }
    };

    const renderStatus = () => {
        const timeStr = session.hasTimeLimit ? ` · ⏱ ${session.secondsLeft}s` : '';
        statusEl.innerHTML = `
            <div style="margin-bottom:8px;">${renderMistakePips(session.mistakesRemaining, puzzle.config.maxMistakes)}</div>
            <div style="font-size:0.85em;color:#9fd;">Trace to the ★${timeStr}</div>
        `;
    };

    const render = () => {
        renderGrid();
        renderStatus();
    };

    const attemptMove = (dir: Direction) => {
        if (finished || session.isFinished) return;
        const delta = DIR_DELTA[dir];
        const next: Cell = { r: cursor.r + delta.r, c: cursor.c + delta.c };
        if (next.r < 0 || next.r >= size || next.c < 0 || next.c >= size) return;

        const expected = puzzle.path[pathProgress + 1];
        const isNextOnPath = expected && expected.r === next.r && expected.c === next.c;

        if (isNextOnPath && !firewallAt(puzzle, next)) {
            cursor = next;
            pathProgress++;
            callbacks.playBlip(true);
            if (pathProgress >= puzzle.path.length - 1) {
                render();
                finish(true);
                return;
            }
        } else {
            // Wrong direction, off-path, or blocked by a firewall.
            callbacks.playBlip(false);
            session.registerMistake();
        }
        render();
    };

    const tapCell = (cell: Cell) => {
        // Translate a tap on an orthogonally-adjacent cell into a move.
        const dr = cell.r - cursor.r;
        const dc = cell.c - cursor.c;
        if (Math.abs(dr) + Math.abs(dc) !== 1) return;
        if (dr === -1) attemptMove('up');
        else if (dr === 1) attemptMove('down');
        else if (dc === -1) attemptMove('left');
        else attemptMove('right');
    };

    const keyHandler = (e: KeyboardEvent) => {
        let dir: Direction | null = null;
        if (e.code === 'ArrowUp' || e.code === 'KeyW') dir = 'up';
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') dir = 'down';
        else if (e.code === 'ArrowLeft' || e.code === 'KeyA') dir = 'left';
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') dir = 'right';
        else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); abort(); return; }
        if (dir) {
            e.preventDefault();
            e.stopPropagation();
            attemptMove(dir);
        }
    };

    const abort = () => {
        if (finished) return;
        finished = true;
        cleanup();
        callbacks.onAbort();
    };

    const cleanup = () => {
        window.removeEventListener('keydown', keyHandler, true);
    };

    // Header + assemble.
    const header = document.createElement('div');
    header.innerHTML = `
        <div style="font-size:1.3em;color:${HACK_ACCENT};margin-bottom:4px;">\u{1F5FF} Data Monolith · Tier ${puzzle.config.tier}</div>
        <div style="font-size:0.9em;color:#cfe6f5;">Trace ▶ → ★ · arrows / WASD or tap. Avoid ✕ firewalls.</div>
    `;
    panel.appendChild(header);
    panel.appendChild(gridEl);
    panel.appendChild(statusEl);

    window.addEventListener('keydown', keyHandler, true);
    render();

    return {
        element: overlay,
        update: (delta: number) => {
            if (finished) return;
            updateMonolithFirewalls(puzzle, delta);
            session.update(delta);
            if (!finished) renderGrid();
        },
        move: attemptMove,
        close: () => {
            if (!finished) abort();
        }
    };
}

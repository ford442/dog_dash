/**
 * Derelict Buoys — Morse-decode hacking artifact (plan §III).
 *
 * A drifting data buoy with a floating "data dock" ring. Flying inside the dock
 * radius begins a Morse transmission (3–7 letters); the player decodes it with
 * Up = dot / Down = dash. Three mistakes fail the hack and trip an alarm.
 * Success starts a 5-second extraction (shields down, thrusters at 30%) that
 * rewards a map fragment.
 *
 * This module owns the 3D prop, the Morse sequence generator, the dock-radius
 * check, and the hack overlay UI. Orchestration lives in main/artifact_update.
 */

import * as THREE from 'three';
import { decorationBudget } from './decoration_budget';
import {
    HackSession, createHackOverlay, createHackPanel, renderMistakePips,
    HACK_ACCENT, HACK_ACCENT_GOOD, HACK_ACCENT_WARN
} from './hacking_minigame';

export const BUOY_DOCK_RADIUS = 3;      // plan: 3 m data dock sphere
export const BUOY_EXTRACTION_TIME = 5;  // plan: 5 s extraction countdown
export const BUOY_MAX_MISTAKES = 3;     // plan: 3 mistakes fail the hack
const BUOY_BUDGET_ID = 'derelict_buoy';

export type MorseSymbol = 'dot' | 'dash';

/** International Morse for A–Z (dots/dashes). */
const MORSE_ALPHABET: Record<string, string> = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
    G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
    M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
    S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
    Y: '-.--', Z: '--..'
};

// Short, kid-friendly words the buoys "transmit".
const BUOY_WORDS = ['DOG', 'MOON', 'STAR', 'HELP', 'LOST', 'HOME', 'DASH', 'ORBIT', 'SIGNAL'];

export interface MorseSequence {
    word: string;
    /** Flat list of symbols across all letters, in input order. */
    symbols: MorseSymbol[];
    /** Per-letter symbol groups (for spaced display / audio gaps). */
    letters: MorseSymbol[][];
    /** e.g. "-.. --- --." */
    display: string;
}

/** Builds a Morse sequence from a random 3–7 char word. */
export function generateMorseSequence(): MorseSequence {
    // Prefer whole words, but clamp to the plan's 3–7 letter window.
    const pool = BUOY_WORDS.filter(w => w.length >= 3 && w.length <= 7);
    const word = pool[Math.floor(Math.random() * pool.length)] ?? 'DOG';

    const letters: MorseSymbol[][] = [];
    const symbols: MorseSymbol[] = [];
    for (const ch of word) {
        const code = MORSE_ALPHABET[ch] ?? '.';
        const group: MorseSymbol[] = [];
        for (const c of code) {
            const sym: MorseSymbol = c === '-' ? 'dash' : 'dot';
            group.push(sym);
            symbols.push(sym);
        }
        letters.push(group);
    }
    const display = letters
        .map(g => g.map(s => (s === 'dash' ? '–' : '·')).join(''))
        .join('  ');
    return { word, symbols, letters, display };
}

function createBuoyMesh(): THREE.Group {
    const group = new THREE.Group();

    // Central data core — dark metal drum with an emissive band.
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.7, 1.8, 12),
        new THREE.MeshStandardMaterial({ color: 0x2a3340, metalness: 0.7, roughness: 0.4 })
    );
    group.add(body);

    const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.12, 8, 20),
        new THREE.MeshBasicMaterial({ color: HACK_ACCENT, transparent: true, opacity: 0.85 })
    );
    band.rotation.x = Math.PI * 0.5;
    band.userData.isBand = true;
    group.add(band);

    // Antennae fins.
    for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 1.0, 0.4),
            new THREE.MeshStandardMaterial({ color: 0x556070, metalness: 0.6, roughness: 0.5 })
        );
        const a = (i / 3) * Math.PI * 2;
        fin.position.set(Math.cos(a) * 0.75, 1.2, Math.sin(a) * 0.75);
        group.add(fin);
    }

    // Floating "data dock" ring the player must fly into.
    const dock = new THREE.Mesh(
        new THREE.RingGeometry(BUOY_DOCK_RADIUS - 0.15, BUOY_DOCK_RADIUS + 0.15, 40),
        new THREE.MeshBasicMaterial({
            color: HACK_ACCENT,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    dock.userData.isDock = true;
    group.add(dock);

    group.userData.type = 'derelictBuoy';
    group.userData.speciesId = 'derelictBuoy';
    return group;
}

export interface BuoyPlacement {
    x: number;
    y: number;
    z?: number;
}

export interface DerelictBuoyInstance {
    group: THREE.Group;
    /** true once this buoy has been hacked (success or fail) this run. */
    consumed: boolean;
    hacked: boolean;
    sequence: MorseSequence | null;
}

export class DerelictBuoyManager {
    private readonly scene: THREE.Scene;
    private buoys: DerelictBuoyInstance[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    getBuoys(): THREE.Group[] {
        return this.buoys.map(b => b.group);
    }

    getScannables(): THREE.Object3D[] {
        return this.buoys.map(b => b.group);
    }

    hasBuoys(): boolean {
        return this.buoys.length > 0;
    }

    clear(): void {
        for (const b of this.buoys) {
            this.scene.remove(b.group);
            b.group.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    const mat = child.material;
                    if (Array.isArray(mat)) mat.forEach(m => m.dispose());
                    else mat.dispose();
                }
            });
        }
        decorationBudget.reportDestroy(BUOY_BUDGET_ID, this.buoys.length);
        this.buoys = [];
    }

    spawnForLevel(placements: BuoyPlacement[], baseX: number): void {
        for (const p of placements) {
            if (!decorationBudget.canSpawn(BUOY_BUDGET_ID, 1)) break;
            const group = createBuoyMesh();
            group.position.set(baseX + p.x, p.y, p.z ?? -6);
            this.scene.add(group);
            decorationBudget.reportSpawn(BUOY_BUDGET_ID, 1);
            this.buoys.push({ group, consumed: false, hacked: false, sequence: null });
        }
    }

    /** Gentle idle animation for the dock ring + band glow. */
    update(delta: number): void {
        const t = performance.now() * 0.001;
        for (const b of this.buoys) {
            b.group.rotation.y += delta * 0.3;
            b.group.children.forEach(child => {
                if (!(child instanceof THREE.Mesh)) return;
                if (child.userData.isDock) {
                    child.rotation.z += delta * 0.5;
                    const consumed = b.consumed;
                    (child.material as THREE.MeshBasicMaterial).opacity =
                        consumed ? 0.12 : 0.3 + Math.sin(t * 2) * 0.12;
                } else if (child.userData.isBand) {
                    (child.material as THREE.MeshBasicMaterial).opacity =
                        b.consumed ? 0.3 : 0.6 + Math.sin(t * 3) * 0.25;
                }
            });
        }
    }

    /** Nearest un-consumed buoy whose dock the player is inside, else null. */
    getDockableBuoy(playerPos: THREE.Vector3): DerelictBuoyInstance | null {
        let best: DerelictBuoyInstance | null = null;
        let bestDist = BUOY_DOCK_RADIUS;
        for (const b of this.buoys) {
            if (b.consumed) continue;
            const d = b.group.position.distanceTo(playerPos);
            if (d <= bestDist) {
                best = b;
                bestDist = d;
            }
        }
        return best;
    }

    /** True while the player remains inside the given buoy's dock radius. */
    isInDock(buoy: DerelictBuoyInstance, playerPos: THREE.Vector3): boolean {
        return buoy.group.position.distanceTo(playerPos) <= BUOY_DOCK_RADIUS + 0.5;
    }
}

// --- Hack overlay UI ----------------------------------------------------------

export interface BuoyHackCallbacks {
    onSuccess: () => void;
    onFail: () => void;
    /** Fired when the player wants to abandon (Esc / out of dock). */
    onAbort: () => void;
    playMorse: (sequence: MorseSequence) => void;
    playBlip: (correct: boolean) => void;
}

export interface BuoyHackHandle {
    element: HTMLDivElement;
    /** Advance the (extraction) timer; call each frame. */
    update: (delta: number) => void;
    /** Force-close (e.g. player left dock). */
    close: () => void;
    /** Feed a decoded symbol from keyboard/touch. */
    input: (symbol: MorseSymbol) => void;
}

type BuoyPhase = 'listen' | 'decode' | 'extraction' | 'done';

/**
 * Builds and returns the buoy hack overlay. The caller is responsible for
 * appending element to the DOM and calling update()/input() each frame, and
 * removing it via close() or after a callback fires.
 */
export function createBuoyHackUI(
    sequence: MorseSequence,
    callbacks: BuoyHackCallbacks
): BuoyHackHandle {
    const overlay = createHackOverlay();
    const panel = createHackPanel();
    overlay.appendChild(panel);

    let phase: BuoyPhase = 'listen';
    let inputIndex = 0;

    const session = new HackSession({
        maxMistakes: BUOY_MAX_MISTAKES,
        timeLimit: 0, // extraction timer is handled as its own phase
        onSuccess: () => {},
        onFail: () => {}
    });

    let extractionLeft = BUOY_EXTRACTION_TIME;

    const render = () => {
        if (phase === 'listen') {
            panel.innerHTML = `
                <div style="font-size:1.4em;color:${HACK_ACCENT};margin-bottom:8px;">\u{1F4E1} Derelict Buoy</div>
                <div style="font-size:1em;color:#cfe6f5;margin-bottom:14px;">Incoming transmission…</div>
                <div style="font-size:2.4em;letter-spacing:6px;color:${HACK_ACCENT_GOOD};min-height:1.4em;">${sequence.display}</div>
                <div style="font-size:0.9em;color:#8fb;margin-top:16px;">Listen, then decode:
                    <br><b>Up</b> / tap · = dot &nbsp;&nbsp; <b>Down</b> / tap – = dash</div>
            `;
        } else if (phase === 'decode') {
            const progress = sequence.symbols
                .map((s, i) => {
                    const done = i < inputIndex;
                    const char = s === 'dash' ? '–' : '·';
                    const color = done ? HACK_ACCENT_GOOD : '#44576a';
                    return `<span style="color:${color};font-size:2em;letter-spacing:4px;">${char}</span>`;
                })
                .join('');
            panel.innerHTML = `
                <div style="font-size:1.3em;color:${HACK_ACCENT};margin-bottom:6px;">Decode the signal</div>
                <div style="min-height:1.6em;margin:12px 0;">${progress}</div>
                <div style="margin:12px 0;">${renderMistakePips(session.mistakesRemaining, BUOY_MAX_MISTAKES)}</div>
                <div style="display:flex;gap:14px;justify-content:center;margin-top:14px;">
                    <button data-sym="dot" style="flex:1;max-width:150px;padding:16px;font-size:1.6em;background:rgba(51,224,255,0.15);border:2px solid ${HACK_ACCENT};border-radius:10px;color:#eaf6ff;cursor:pointer;">· dot</button>
                    <button data-sym="dash" style="flex:1;max-width:150px;padding:16px;font-size:1.6em;background:rgba(51,224,255,0.15);border:2px solid ${HACK_ACCENT};border-radius:10px;color:#eaf6ff;cursor:pointer;">– dash</button>
                </div>
            `;
            panel.querySelectorAll('button[data-sym]').forEach(btn => {
                btn.addEventListener('click', () => {
                    handleInput((btn as HTMLElement).dataset.sym as MorseSymbol);
                });
            });
        } else if (phase === 'extraction') {
            panel.innerHTML = `
                <div style="font-size:1.3em;color:${HACK_ACCENT_WARN};margin-bottom:8px;">⚠ Extracting data</div>
                <div style="font-size:0.95em;color:#ffd7a0;margin-bottom:10px;">Shields down · thrusters at 30% · hold position!</div>
                <div style="font-size:3.4em;color:${HACK_ACCENT_GOOD};font-weight:bold;">${Math.ceil(extractionLeft)}</div>
            `;
        }
    };

    const finish = (success: boolean) => {
        if (phase === 'done') return;
        phase = 'done';
        cleanup();
        if (success) callbacks.onSuccess();
        else callbacks.onFail();
    };

    const handleInput = (symbol: MorseSymbol) => {
        if (phase !== 'decode' || session.isFinished) return;
        const expected = sequence.symbols[inputIndex];
        if (symbol === expected) {
            inputIndex++;
            callbacks.playBlip(true);
            if (inputIndex >= sequence.symbols.length) {
                // Correct code → begin extraction.
                phase = 'extraction';
                extractionLeft = BUOY_EXTRACTION_TIME;
            }
            render();
        } else {
            callbacks.playBlip(false);
            session.registerMistake();
            if (session.isFinished) {
                finish(false);
            } else {
                render();
            }
        }
    };

    const keyHandler = (e: KeyboardEvent) => {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
            e.preventDefault(); e.stopPropagation();
            handleInput('dot');
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
            e.preventDefault(); e.stopPropagation();
            handleInput('dash');
        } else if (e.code === 'Escape') {
            e.preventDefault(); e.stopPropagation();
            cleanup();
            if (phase !== 'done') {
                phase = 'done';
                callbacks.onAbort();
            }
        }
    };

    const cleanup = () => {
        window.clearTimeout(listenTimeout);
        window.removeEventListener('keydown', keyHandler, true);
    };

    // Kick off the audio transmission, then switch to decode after it plays.
    callbacks.playMorse(sequence);
    render();
    const listenMs = sequence.symbols.length * 500 + 900;
    const listenTimeout = window.setTimeout(() => {
        if (phase === 'listen') {
            phase = 'decode';
            render();
        }
    }, listenMs);
    window.addEventListener('keydown', keyHandler, true);

    return {
        element: overlay,
        update: (delta: number) => {
            if (phase === 'extraction') {
                extractionLeft -= delta;
                if (extractionLeft <= 0) {
                    finish(true);
                } else {
                    render();
                }
            }
        },
        input: handleInput,
        close: () => {
            cleanup();
            if (phase !== 'done') {
                phase = 'done';
                callbacks.onAbort();
            }
        }
    };
}

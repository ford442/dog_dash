/**
 * Artifacts orchestration (plan §III): Derelict Buoys + Data Monoliths.
 *
 * Handles per-frame idle animation, proximity-triggered hacks, the paused hack
 * overlay lifecycle (driven by a local rAF ticker so the world stays frozen),
 * and reward/penalty application (map fragments, Architect lore, alarm).
 */

import * as THREE from 'three';
import { player } from '../player_loader';
import { playerState, setIsGamePaused } from '../game_config';
import { game } from '../game_runtime';
import { ShakeType } from '../juice_effects';
import { DogAnimationState } from '../dog_cockpit';
import {
    generateMorseSequence, createBuoyHackUI, type DerelictBuoyInstance, type BuoyHackHandle
} from '../derelict_buoy';
import {
    createMonolithPuzzle, createMonolithHackUI, type DataMonolithInstance, type MonolithHackHandle
} from '../data_monolith';
import {
    nextArchitectLoreId, ARCHITECT_LORE, hasFullArchitectSet,
    createLoreRevealUI
} from '../architect_lore';
import type { LevelConfig } from '../level_config';

// Fragments needed to reveal the "Lost Sector" (plan §III).
const LOST_SECTOR_FRAGMENTS = 3;
// Quantum Compass unlocks once the buoy network is well-mapped.
const QUANTUM_COMPASS_FRAGMENTS = 5;

interface ActiveHack {
    handle: BuoyHackHandle | MonolithHackHandle;
    tickerId: number | null;
    lastTick: number;
}

let activeHack: ActiveHack | null = null;
// Buoys/monoliths become "armed" while the player is outside their radius, so a
// hack fires on entry (not continuously) and can be retried after leaving.
const armed = new Set<string>();

function startTicker(): void {
    if (!activeHack) return;
    activeHack.lastTick = performance.now();
    const step = (now: number) => {
        if (!activeHack) return;
        const dt = Math.min((now - activeHack.lastTick) / 1000, 0.1);
        activeHack.lastTick = now;
        activeHack.handle.update(dt);
        if (activeHack) activeHack.tickerId = requestAnimationFrame(step);
    };
    activeHack.tickerId = requestAnimationFrame(step);
}

function endHack(): void {
    if (activeHack) {
        if (activeHack.tickerId != null) cancelAnimationFrame(activeHack.tickerId);
        activeHack.handle.element.remove();
        activeHack = null;
    }
    playerState.hackExtractionTimer = 0;
    playerState.hackThrusterEfficiency = 1;
    setIsGamePaused(false);
}

function beginBuoyHack(buoy: DerelictBuoyInstance): void {
    if (activeHack) return;
    setIsGamePaused(true);
    const sequence = generateMorseSequence();
    buoy.sequence = sequence;

    const handle = createBuoyHackUI(sequence, {
        playMorse: (seq) => {
            let offset = 0;
            for (const letter of seq.letters) {
                for (const sym of letter) {
                    game.audioSystem.playMorseSymbol(sym === 'dash', offset);
                    offset += (sym === 'dash' ? 0.6 : 0.2) + 0.15;
                }
                offset += 0.3; // inter-letter gap
            }
        },
        playBlip: (correct) => game.audioSystem.playHackBlip(correct),
        onSuccess: () => {
            buoy.consumed = true;
            buoy.hacked = true;
            endHack();
            game.audioSystem.playHackSuccess();
            game.dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.2);
            game.juiceManager.flashWhite(0.12);
            game.particleSystem.emit(buoy.group.position, 0x33e0ff, 24, 5, 0.9);

            const fragments = game.saveManager.addMapFragment(1);
            game.juiceManager.showFloatingText(
                `\u{1F5FA}️ Map Fragment (${fragments})`, buoy.group.position.clone(), '#66ffaa', 26
            );
            if (fragments === LOST_SECTOR_FRAGMENTS) {
                game.juiceManager.showFloatingText(
                    'Lost Sector revealed!', player!.position.clone(), '#ffd76a', 24
                );
            }
            if (fragments >= QUANTUM_COMPASS_FRAGMENTS && game.saveManager.unlockQuantumCompass()) {
                game.juiceManager.showFloatingText(
                    '\u{1F9ED} Quantum Compass online!', player!.position.clone(), '#33e0ff', 24
                );
            }
        },
        onFail: () => {
            endHack();
            triggerAlarm(buoy.group.position);
        },
        onAbort: () => {
            endHack();
        }
    });

    activeHack = { handle, tickerId: null, lastTick: performance.now() };
    document.body.appendChild(handle.element);
    startTicker();
}

function triggerAlarm(position: THREE.Vector3): void {
    game.audioSystem.playHackFail();
    game.audioSystem.playHackAlarm();
    game.juiceManager.shakeScreen(ShakeType.HEAVY, 0.4);
    game.dogController.triggerAnimation(DogAnimationState.HIT, 0.7);
    game.juiceManager.showFloatingText('⚠ Hack failed — alarm!', position.clone(), '#ff5577', 26);
}

function beginMonolithHack(monolith: DataMonolithInstance): void {
    if (activeHack) return;
    setIsGamePaused(true);
    const puzzle = createMonolithPuzzle(monolith.tier);

    const handle = createMonolithHackUI(puzzle, {
        playBlip: (correct) => game.audioSystem.playHackBlip(correct),
        onSuccess: () => {
            monolith.consumed = true;
            endHack();
            game.audioSystem.playHackSuccess();
            game.dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.2);
            game.particleSystem.emit(monolith.group.position, 0x9be7ff, 24, 5, 0.9);
            awardMonolithReward(monolith);
        },
        onFail: () => {
            endHack();
            triggerAlarm(monolith.group.position);
        },
        onAbort: () => {
            endHack();
        }
    });

    activeHack = { handle, tickerId: null, lastTick: performance.now() };
    document.body.appendChild(handle.element);
    startTicker();
}

function awardMonolithReward(monolith: DataMonolithInstance): void {
    const unlocked = game.saveManager.getArchitectLore();
    const loreId = nextArchitectLoreId(unlocked);

    // Tier bonuses on top of the lore entry (plan §III).
    if (monolith.tier >= 2) {
        const frags = game.saveManager.addMapFragment(1);
        game.juiceManager.showFloatingText(`Blueprint fragment (${frags})`, monolith.group.position.clone(), '#aa66ff', 22);
    }
    if (monolith.tier >= 3) {
        playerState.cores += 25;
        game.juiceManager.showFloatingText('+25 cores', monolith.group.position.clone(), '#ffd76a', 22);
    }

    if (!loreId) {
        // All lore already decoded — still acknowledge the solve.
        game.juiceManager.showFloatingText('Monolith re-scanned', monolith.group.position.clone(), '#9be7ff', 22);
        return;
    }

    game.saveManager.unlockArchitectLore(loreId);
    const entry = ARCHITECT_LORE[loreId];
    const nowUnlocked = game.saveManager.getArchitectLore();
    const hasKey = hasFullArchitectSet(nowUnlocked);

    // Lore reveal is a paused modal; restore play only when dismissed.
    setIsGamePaused(true);
    const modal = createLoreRevealUI(entry, nowUnlocked.length, hasKey, () => {
        setIsGamePaused(false);
        if (hasKey) {
            game.juiceManager.showFloatingText('\u{1F511} Architect’s Key assembled!', player!.position.clone(), '#ffd76a', 26);
        }
    });
    document.body.appendChild(modal);
}

/** Spawns the artifacts declared by a level config. Call on level start. */
export function spawnArtifactsForLevel(cfg: LevelConfig, baseX: number): void {
    game.derelictBuoyManager.clear();
    game.dataMonolithManager.clear();
    armed.clear();
    if (cfg.derelictBuoys?.length) {
        game.derelictBuoyManager.spawnForLevel(cfg.derelictBuoys, baseX);
    }
    if (cfg.dataMonoliths?.length) {
        game.dataMonolithManager.spawnForLevel(cfg.dataMonoliths, baseX);
    }
}

/** Per-frame update: idle animation + proximity-triggered hacks. */
export function updateArtifacts(delta: number): void {
    // While a hack overlay is up the world is paused, so this won't be reached;
    // the local rAF ticker drives the overlay instead.
    if (activeHack || !player) return;
    if (!game.derelictBuoyManager.hasBuoys() && !game.dataMonolithManager.hasMonoliths()) return;

    game.derelictBuoyManager.update(delta);
    game.dataMonolithManager.update(delta);

    // Buoys — arm on exit, trigger on entry.
    for (const buoy of game.derelictBuoyManager.getBuoys()) {
        const id = buoy.uuid;
        const inDock = buoy.position.distanceTo(player.position) <= 3.0;
        if (!inDock) { armed.add(id); continue; }
        if (armed.has(id)) {
            armed.delete(id);
            const inst = game.derelictBuoyManager.getDockableBuoy(player.position);
            if (inst && inst.group.uuid === id && !inst.consumed) {
                beginBuoyHack(inst);
                return;
            }
        }
    }

    // Monoliths — arm on exit, trigger on entry.
    for (const slab of game.dataMonolithManager.getScannables()) {
        const id = slab.uuid;
        const inRange = slab.position.distanceTo(player.position) <= 5.0;
        if (!inRange) { armed.add(id); continue; }
        if (armed.has(id)) {
            armed.delete(id);
            const inst = game.dataMonolithManager.getInteractable(player.position);
            if (inst && inst.group.uuid === id && !inst.consumed) {
                beginMonolithHack(inst);
                return;
            }
        }
    }
}

/** True while a hack overlay is active (for input routing / gating). */
export function isHackActive(): boolean {
    return activeHack != null;
}

/**
 * The Architects — lore + progression data unlocked by Data Monoliths (plan §III).
 *
 * Each decoded monolith reveals a lore fragment and grants a permanent 5% damage
 * bonus against a specific flora type. Decoding the full set unlocks the
 * "Architect's Key" (a future secret exit / L6 variant path).
 */

import type { SaveManager } from './save_manager';

export interface ArchitectLoreEntry {
    id: string;
    title: string;
    /** The story fragment shown in the codex once decoded. */
    text: string;
    /** speciesId (see discovery_system SPECIES_NAMES) this monolith empowers. */
    floraTarget: string;
    /** Human-readable flora name for the bonus line. */
    floraName: string;
}

/**
 * A representative slice of the 20-monolith set described in the plan. Each
 * entry maps to a flora species and a lore beat; the full set can grow without
 * touching gameplay wiring.
 */
export const ARCHITECT_LORE: Record<string, ArchitectLoreEntry> = {
    seedbearers: {
        id: 'seedbearers',
        title: 'I. The Seedbearers',
        text: 'Before the moon had a name, the Architects seeded the dark with living light. Every fern you pass is a distant echo of their gardens.',
        floraTarget: 'fern',
        floraName: 'Star Dust Fern'
    },
    first_bloom: {
        id: 'first_bloom',
        title: 'II. The First Bloom',
        text: 'They taught the void to flower. The Nebula Rose was their proudest work — a bloom that drinks starlight and never wilts.',
        floraTarget: 'rose',
        floraName: 'Nebula Rose'
    },
    resonance: {
        id: 'resonance',
        title: 'III. The Resonance',
        text: 'The Architects sang to their creations. The Subwoofer Lotus still hums their forgotten chord, waiting for a listener who understands.',
        floraTarget: 'lotus',
        floraName: 'Subwoofer Lotus'
    },
    the_wilds: {
        id: 'the_wilds',
        title: 'IV. The Wilds',
        text: 'Not all their gardens stayed tame. The Void Root Ball grew hungry in the deep, twisting the Architects\' gift into something that grasps.',
        floraTarget: 'voidRootBall',
        floraName: 'Void Root Ball'
    },
    the_departure: {
        id: 'the_departure',
        title: 'V. The Departure',
        text: 'One day the Architects simply left, folding themselves into the space between stars. They left the monoliths as a map home — and a key.',
        floraTarget: 'glowingFlower',
        floraName: 'Glowing Flower'
    }
};

export const ARCHITECT_LORE_IDS: string[] = Object.keys(ARCHITECT_LORE);
export const ARCHITECT_LORE_TOTAL = ARCHITECT_LORE_IDS.length;

/** Per-monolith flora damage bonus (plan: +5% each). */
export const MONOLITH_FLORA_DAMAGE_BONUS = 0.05;

/** Returns the next un-decoded lore id (deterministic order), or null if done. */
export function nextArchitectLoreId(unlocked: string[]): string | null {
    for (const id of ARCHITECT_LORE_IDS) {
        if (!unlocked.includes(id)) return id;
    }
    return null;
}

/**
 * Aggregate flora damage multipliers from decoded monoliths, keyed by speciesId.
 * e.g. { fern: 1.05, rose: 1.05 }. Weapons/obstacle systems can consult this.
 */
export function getFloraDamageMultipliers(unlocked: string[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const id of unlocked) {
        const entry = ARCHITECT_LORE[id];
        if (!entry) continue;
        out[entry.floraTarget] = (out[entry.floraTarget] ?? 1) + MONOLITH_FLORA_DAMAGE_BONUS;
    }
    return out;
}

/** True once every monolith in the set has been decoded (Architect's Key). */
export function hasFullArchitectSet(unlocked: string[]): boolean {
    return ARCHITECT_LORE_IDS.every(id => unlocked.includes(id));
}

/**
 * Compact "lore decoded" reveal shown right after a monolith is solved. Doubles
 * as the discovery/bestiary-style confirmation required by the acceptance
 * criteria. Caller appends it and removes it on close.
 */
export function createLoreRevealUI(
    entry: ArchitectLoreEntry,
    unlockedCount: number,
    hasKey: boolean,
    onClose: () => void
): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1300;
        background: radial-gradient(circle at 50% 45%, rgba(10,20,40,0.8), rgba(2,4,10,0.94));
        font-family: 'Segoe UI', sans-serif;
        color: #eaf6ff;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
        background: rgba(12, 22, 38, 0.95);
        border: 2px solid #33e0ff;
        border-radius: 16px;
        box-shadow: 0 0 44px rgba(51,224,255,0.3);
        padding: 26px 30px;
        max-width: 480px;
        width: 92%;
        text-align: center;
    `;
    panel.innerHTML = `
        <div style="font-size:1em;color:#66ffaa;letter-spacing:2px;margin-bottom:6px;">✓ MONOLITH DECODED</div>
        <div style="font-size:1.5em;color:#9be7ff;margin-bottom:12px;">${entry.title}</div>
        <div style="font-size:1em;color:#cfe6f5;line-height:1.5;margin-bottom:16px;">${entry.text}</div>
        <div style="font-size:0.9em;color:#66ffaa;margin-bottom:6px;">
            +${Math.round(MONOLITH_FLORA_DAMAGE_BONUS * 100)}% damage vs ${entry.floraName}
        </div>
        <div style="font-size:0.85em;color:${hasKey ? '#ffd76a' : '#8ab'};margin-bottom:18px;">
            ${hasKey ? '\u{1F511} The Architect’s Key is complete!' : `${unlockedCount} / ${ARCHITECT_LORE_TOTAL} monoliths decoded`}
        </div>
        <button id="lore-continue" style="padding:12px 34px;font-size:1.05em;background:#2a6;border:none;border-radius:8px;color:white;cursor:pointer;">
            Continue
        </button>
    `;
    container.appendChild(panel);

    panel.querySelector('#lore-continue')!.addEventListener('click', () => {
        container.remove();
        onClose();
    });

    return container;
}

/**
 * "Architect Codex" — lore modal, sibling to the Weird Life Log bestiary.
 * Shows decoded entries and locked placeholders. Caller appends/removes it.
 */
export function createArchitectCodexUI(saveManager: SaveManager, onClose: () => void): HTMLDivElement {
    const unlocked = new Set(saveManager.getArchitectLore());
    const fragments = saveManager.getMapFragments();
    const hasKey = hasFullArchitectSet([...unlocked]);

    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        background: rgba(6, 10, 22, 0.95);
        font-family: 'Segoe UI', sans-serif;
        color: white;
    `;

    container.innerHTML = `
        <h1 style="font-size: 2.3em; margin-bottom: 4px; color: #9be7ff; text-shadow: 0 0 22px rgba(51,224,255,0.5);">
            \u{1F5FF} Architect Codex
        </h1>
        <p style="font-size: 1.05em; color: #7fd6ff; margin-bottom: 6px;">
            ${unlocked.size} / ${ARCHITECT_LORE_TOTAL} monoliths decoded
            &nbsp;·&nbsp; \u{1F5FA}️ ${fragments} map fragments
        </p>
        <p style="font-size: 0.95em; color: ${hasKey ? '#ffd76a' : '#66788a'}; margin-bottom: 18px;">
            ${hasKey ? '\u{1F511} Architect’s Key assembled — a hidden path awaits.' : 'Decode every monolith to assemble the Architect’s Key.'}
        </p>
        <div id="codex-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; max-width: 760px; width: 92%; max-height: 56vh; overflow-y: auto; padding: 4px;"></div>
        <button id="close-codex" style="margin-top: 22px; padding: 12px 36px; font-size: 1.1em; background: #274; color: white; border: none; border-radius: 8px; cursor: pointer;">
            Close
        </button>
    `;

    const grid = container.querySelector('#codex-grid')!;
    for (const entry of Object.values(ARCHITECT_LORE)) {
        const known = unlocked.has(entry.id);
        const el = document.createElement('div');
        el.style.cssText = `
            background: rgba(30, 48, 72, 0.55);
            padding: 14px;
            border-radius: 10px;
            border: 2px solid ${known ? '#33e0ff' : '#3a4658'};
            opacity: ${known ? 1 : 0.6};
            text-align: left;
        `;
        el.innerHTML = `
            <div style="font-weight: bold; font-size: 1.05em; margin-bottom: 6px; color: ${known ? '#bff0ff' : '#8aa'};">
                ${known ? entry.title : '\u{1F512} Encrypted Monolith'}
            </div>
            <div style="font-size: 0.86em; color: #cfe6f5; margin-bottom: 8px; line-height: 1.4;">
                ${known ? entry.text : 'A slab of dead circuitry. Trace its path to decode the Architects’ memory.'}
            </div>
            <div style="font-size: 0.8em; color: ${known ? '#66ffaa' : '#788'};">
                ${known ? `+${Math.round(MONOLITH_FLORA_DAMAGE_BONUS * 100)}% damage vs ${entry.floraName}` : 'Reward: unknown'}
            </div>
        `;
        grid.appendChild(el);
    }

    container.querySelector('#close-codex')!.addEventListener('click', () => {
        container.remove();
        onClose();
    });

    return container;
}

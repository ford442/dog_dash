/**
 * Hub "Lost Sector" tab: the secret chapters the Derelict Buoy map fragments
 * reveal, plus Quantum Compass progress. Loaded on demand by `hub_screen.ts`
 * (plain DOM, same card / button helpers as every other tab).
 *
 * Launching queues a `'lost'` run seed with a fresh `rngSeed` and reloads,
 * the same path Endless and "Launch with seed" use, so each flight lays the
 * sector's buoys and rocks out from its own seed.
 */
import type { SaveManager } from '../save_manager';
import { setPendingRunSeed } from '../hub_pending_seed';
import { hasDebugUrlFlag } from '../renderer_mode';
import { LOST_SECTOR_IDS, type LostSectorId } from './constants';
import { LOST_SECTORS } from './configs';
import { lostSectorRunSeed } from './run';
import { lostSectorUnlockState } from './unlock';

export interface LostSectorTabDeps {
    saveManager: SaveManager;
    card: () => HTMLDivElement;
    bigButton: (text: string, color: string, onClick: () => void) => HTMLButtonElement;
    statRow: (label: string, value: string) => string;
    play: (name: 'ui_click' | 'twinkle') => void;
    colors: { textLight: string; mint: string; sky: string; lavender: string; white: string };
}

function launch(id: LostSectorId): void {
    // Picking a seed is UI, not gameplay: the run itself is seeded from it.
    const [rngSeed] = crypto.getRandomValues(new Uint32Array(1));
    setPendingRunSeed(lostSectorRunSeed(id, rngSeed));
    location.reload();
}

export function renderLostSectorTab(panel: HTMLElement, deps: LostSectorTabDeps): void {
    const { saveManager, card, bigButton, statRow, play, colors } = deps;
    const state = lostSectorUnlockState(saveManager);
    const debugBypass = !state.unlocked && hasDebugUrlFlag('debug');

    const intro = card();
    intro.innerHTML = `
        <div style="font-size:18px; font-weight:bold;">📡 Lost Sectors</div>
        <div style="color:${colors.textLight}; font-size:14px; margin-top:4px;">
            The radio scraps from the Derelict Buoys fit together into a secret map!
        </div>
        ${statRow('🗺️ Map fragments', `${state.fragments}`)}
        ${statRow('🧭 Quantum Compass', state.compassUnlocked
            ? 'Online!'
            : `${Math.min(state.fragments, state.compassNeeded)} / ${state.compassNeeded} fragments`)}
    `;
    panel.appendChild(intro);

    if (!state.unlocked && !debugBypass) {
        const locked = card();
        locked.style.textAlign = 'center';
        locked.innerHTML = `
            <div style="font-size:40px;">🔒</div>
            <div style="font-size:16px; font-weight:bold; margin-top:4px;">Hack more Derelict Buoys</div>
            <div style="color:${colors.textLight}; font-size:14px; margin-top:4px;">
                ${state.fragments} / ${state.needed} map fragments found.
            </div>
        `;
        panel.appendChild(locked);
        return;
    }

    const completed = new Set(saveManager.getCompletedLostSectors());
    for (const id of LOST_SECTOR_IDS) {
        const sector = LOST_SECTORS[id];
        const done = completed.has(id);
        const row = card();
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '12px';

        const icon = document.createElement('div');
        icon.style.fontSize = '34px';
        icon.textContent = sector.icon;

        const text = document.createElement('div');
        text.style.cssText = 'flex:1; min-width:0;';
        const name = document.createElement('div');
        name.style.cssText = 'font-size:16px; font-weight:bold;';
        name.textContent = `${sector.title}${done ? ' ✅' : ''}`;
        const blurb = document.createElement('div');
        blurb.style.cssText = `font-size:14px; color:${colors.textLight};`;
        blurb.textContent = sector.blurb;
        const goal = document.createElement('div');
        goal.style.cssText = `font-size:12px; color:${colors.textLight}; margin-top:2px;`;
        goal.textContent = `🎯 ${sector.config.objective?.description ?? 'Reach the end'} · ${sector.config.distance}m`;
        text.append(name, blurb, goal);

        const goBtn = bigButton('🚀 Go!', done ? colors.sky : colors.mint, () => {
            play('ui_click');
            launch(id);
        });
        goBtn.style.minWidth = '96px';
        row.append(icon, text, goBtn);
        panel.appendChild(row);
    }

    if (debugBypass) {
        const note = document.createElement('div');
        note.style.cssText = `font-size:12px; color:${colors.white}; text-align:center; opacity:0.8;`;
        note.textContent = '?debug: Lost Sectors shown without enough map fragments';
        panel.appendChild(note);
    }
}

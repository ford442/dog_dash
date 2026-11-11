/**
 * Hub "Endless" tab: this week's seed, a typed / random / pasted seed, copy
 * link (`#endless=CODE`) and the save's Endless records. Loaded on demand by
 * `hub_screen.ts` so the generator never ships in the hub or boot chunks.
 *
 * Launching stores the seed as the pending run seed and reloads, the same
 * path the hub's "Launch with seed" uses.
 */
import type { SaveManager } from '../save_manager';
import { setPendingRunSeed } from '../hub_pending_seed';
import { hasDebugUrlFlag } from '../renderer_mode';
import { EndlessSequence } from './generator';
import { BOSS_TITLES } from './patches';
import {
    endlessRunSeed,
    endlessShareLink,
    formatEndlessCode,
    isoWeek,
    parseEndlessCode,
    weeklyEndlessSeed
} from './seed';
import { endlessUnlockState } from './unlock';

/** Chapters listed under a seed so players can see what they are signing up for. */
const PREVIEW_CHAPTERS = 4;

export interface EndlessTabDeps {
    saveManager: SaveManager;
    card: () => HTMLDivElement;
    bigButton: (text: string, color: string, onClick: () => void) => HTMLButtonElement;
    statRow: (label: string, value: string) => string;
    play: (name: 'ui_click' | 'twinkle') => void;
    colors: { textLight: string; mint: string; sky: string; lavender: string; lemon: string; white: string };
}

/** No query string: a shared link must not carry `?debug` (unlock bypass) or `?seed=`. */
function pageBase(): string {
    return location.origin + location.pathname;
}

function launch(seed: number): void {
    setPendingRunSeed(endlessRunSeed(seed));
    location.reload();
}

function copyLink(button: HTMLButtonElement, seed: number): void {
    const label = button.textContent;
    const done = (text: string) => {
        button.textContent = text;
        window.setTimeout(() => { button.textContent = label; }, 1500); // UI feedback, not gameplay
    };
    const link = endlessShareLink(seed, pageBase());
    if (!navigator.clipboard?.writeText) {
        done(link);
        return;
    }
    navigator.clipboard.writeText(link).then(() => done('✅ Link copied!'), () => done(link));
}

function previewList(seed: number, colors: EndlessTabDeps['colors']): HTMLDivElement {
    const list = document.createElement('div');
    list.style.cssText = `font-size:13px; color:${colors.textLight}; margin:6px 0 10px 0; line-height:1.6;`;
    for (const ch of new EndlessSequence(seed).first(PREVIEW_CHAPTERS)) {
        const row = document.createElement('div');
        const boss = ch.recipe.bossKind ? ` 👾 ${BOSS_TITLES[ch.recipe.bossKind]}` : '';
        row.textContent = `${ch.ordinal}. ${ch.config.name}${boss}`;
        list.appendChild(row);
    }
    const more = document.createElement('div');
    more.textContent = '… and on forever';
    list.appendChild(more);
    return list;
}

function buttonRow(...buttons: HTMLButtonElement[]): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap;';
    for (const b of buttons) {
        b.style.flex = '1 1 140px';
        b.style.minHeight = '48px';
        row.appendChild(b);
    }
    return row;
}

export function renderEndlessTab(panel: HTMLElement, deps: EndlessTabDeps): void {
    const { saveManager, card, bigButton, statRow, play, colors } = deps;
    const state = endlessUnlockState(saveManager);
    const debugBypass = !state.unlocked && hasDebugUrlFlag('debug');

    const intro = card();
    intro.innerHTML = `
        <div style="font-size:18px; font-weight:bold;">♾️ Endless Dash</div>
        <div style="color:${colors.textLight}; font-size:14px; margin-top:4px;">
            A brand-new journey built from a seed. Same seed, same chapters — share it and race your friends!
        </div>
    `;
    panel.appendChild(intro);

    if (!state.unlocked && !debugBypass) {
        const locked = card();
        locked.style.textAlign = 'center';
        locked.innerHTML = `
            <div style="font-size:40px;">🔒</div>
            <div style="font-size:16px; font-weight:bold; margin-top:4px;">Reach the Moon to unlock</div>
            <div style="color:${colors.textLight}; font-size:14px; margin-top:4px;">
                Finish all 6 chapters of the journey (${state.chaptersCompleted} / 6 done).
            </div>
        `;
        panel.appendChild(locked);
        return;
    }

    const records = saveManager.getEndlessRecords();
    if (records.runs > 0) {
        const recordCard = card();
        recordCard.innerHTML = `
            <div style="font-size:16px; font-weight:bold; margin-bottom:6px;">🏆 Endless Records</div>
            ${statRow('🚀 Runs flown', `${records.runs}`)}
            ${statRow('📍 Furthest chapter', `${records.bestChapter}`)}
            ${statRow('🛣️ Best distance', `${Math.floor(records.bestDistance)}m`)}
            ${records.bestSeedCode ? statRow('🌱 Best seed', records.bestSeedCode) : ''}
        `;
        panel.appendChild(recordCard);
    }

    // This week's seed: one shared journey per UTC ISO week.
    const now = new Date(); // which week to show, not gameplay
    const weekly = weeklyEndlessSeed(now);
    const { week } = isoWeek(now);
    const weeklyCard = card();
    const weeklyTitle = document.createElement('div');
    weeklyTitle.style.cssText = 'font-size:16px; font-weight:bold;';
    weeklyTitle.textContent = `🗓️ This week's seed · ${formatEndlessCode(weekly)}`;
    const weeklyNote = document.createElement('div');
    weeklyNote.style.cssText = `font-size:12px; color:${colors.textLight};`;
    weeklyNote.textContent = `Week ${week} — everyone flies the same chapters until Monday.`;
    weeklyCard.append(weeklyTitle, weeklyNote, previewList(weekly, colors));
    const weeklyCopy = bigButton('🔗 Copy link', colors.sky, () => {
        play('ui_click');
        copyLink(weeklyCopy, weekly);
    });
    weeklyCard.appendChild(buttonRow(
        bigButton('🚀 Fly this week', colors.mint, () => {
            play('ui_click');
            launch(weekly);
        }),
        weeklyCopy
    ));
    panel.appendChild(weeklyCard);

    // Any seed: typed, pasted link, or rolled.
    const seedCard = card();
    const seedTitle = document.createElement('div');
    seedTitle.style.cssText = 'font-size:16px; font-weight:bold; margin-bottom:6px;';
    seedTitle.textContent = '🌱 Pick a seed';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Seed code or #endless link';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.style.cssText = `
        width:100%; box-sizing:border-box; padding:12px; border-radius:12px;
        border:2px solid rgba(93,78,109,0.3); font-size:16px; font-family:inherit;
        text-transform:uppercase; letter-spacing:2px;
    `;
    const preview = document.createElement('div');
    seedCard.append(seedTitle, input, preview);

    let current: number | null = null;
    const showSeed = () => {
        current = parseEndlessCode(input.value);
        input.style.borderColor = current === null && input.value.trim() ? '#ff6b6b' : 'rgba(93,78,109,0.3)';
        preview.replaceChildren(...(current === null ? [] : [previewList(current, colors)]));
    };
    input.addEventListener('input', showSeed);

    const rollSeed = () => {
        // Picking a seed is UI, not gameplay: the run itself is seeded from it.
        const [value] = crypto.getRandomValues(new Uint32Array(1));
        input.value = formatEndlessCode(value);
        showSeed();
    };
    const seedCopy = bigButton('🔗 Copy link', colors.sky, () => {
        play('ui_click');
        if (current === null) return showSeed();
        copyLink(seedCopy, current);
    });
    seedCard.appendChild(buttonRow(
        bigButton('🎲 Random', colors.lemon, () => {
            play('twinkle');
            rollSeed();
        }),
        bigButton('🚀 Launch', colors.lavender, () => {
            play('ui_click');
            if (current === null) {
                input.style.borderColor = '#ff6b6b';
                return;
            }
            launch(current);
        }),
        seedCopy
    ));
    panel.appendChild(seedCard);
    rollSeed();

    if (debugBypass) {
        const note = document.createElement('div');
        note.style.cssText = `font-size:12px; color:${colors.white}; text-align:center; opacity:0.8;`;
        note.textContent = '?debug: Endless unlocked without finishing the campaign';
        panel.appendChild(note);
    }
}

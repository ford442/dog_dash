/**
 * Hub "🏗️ Lab" tab: paint a 500–800 m sandbox from the brush table, watch
 * the decoration budget live, playtest it in the real game, and share it
 * as seed JSON. Loaded on demand by `hub_screen.ts`; constructs the
 * `ArchitectManager` when it renders.
 *
 * Playtesting stores the course as the pending run seed and reloads, the
 * same path Endless and "Launch with seed" use, so the course flies through
 * the real loop: fixed timestep, WASM collision, ghost recorder.
 */
import { setPendingRunSeed } from '../hub_pending_seed';
import { BRUSH_IDS, BRUSH_REGISTRY, bossKindFor, type BrushId } from './brushes';
import { ARCHITECT_MAX_PLACEMENTS, SANDBOX_MAX_LENGTH } from './constants';
import { ArchitectManager } from './manager';
import { BOSS_TITLES } from '../endless/patches';

export interface ArchitectTabDeps {
    card: () => HTMLDivElement;
    bigButton: (text: string, color: string, onClick: () => void) => HTMLButtonElement;
    play: (name: 'ui_click' | 'twinkle') => void;
    colors: { textLight: string; textDark: string; mint: string; sky: string; lavender: string; lemon: string; peach: string; white: string };
}

const DANGER = '#ff6b6b';
const OK_GREEN = '#2eaa72';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, css = '', text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (css) node.style.cssText = css;
    if (text !== undefined) node.textContent = text;
    return node;
}

function buttonRow(...buttons: HTMLButtonElement[]): HTMLDivElement {
    const row = el('div', 'display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;');
    for (const b of buttons) {
        b.style.flex = '1 1 140px';
        b.style.minHeight = '48px';
        row.appendChild(b);
    }
    return row;
}

function densityText(brushId: BrushId, density: number): string {
    if (brushId === 'boss_gate') return BOSS_TITLES[bossKindFor(density)];
    return `${Math.round(density * 100)}%`;
}

function slider(min: number, max: number, step: number, value: number): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.style.cssText = 'width:100%; min-height:32px; accent-color:#9370DB;';
    return input;
}

function copyText(button: HTMLButtonElement, text: string, fallback: HTMLTextAreaElement): void {
    const label = button.textContent;
    const done = (msg: string) => {
        button.textContent = msg;
        window.setTimeout(() => { button.textContent = label; }, 1500); // UI feedback, not gameplay
    };
    if (!navigator.clipboard?.writeText) {
        fallback.select();
        done('Selected — copy it!');
        return;
    }
    navigator.clipboard.writeText(text).then(() => done('✅ Copied!'), () => {
        fallback.select();
        done('Selected — copy it!');
    });
}

export function renderArchitectTab(panel: HTMLElement, deps: ArchitectTabDeps): void {
    const { card, bigButton, play, colors } = deps;
    const manager = new ArchitectManager();

    const intro = card();
    intro.append(
        el('div', 'font-size:18px; font-weight:bold;', '🏗️ Architect Lab'),
        el('div', `color:${colors.textLight}; font-size:14px; margin-top:4px;`,
            'Paint your own course from brushes, fly it, then share the seed so a friend can fly it too!')
    );
    panel.appendChild(intro);

    // --- Budget HUD + timeline (refreshed live while sliders move) -------
    const budgetCard = card();
    const summary = el('div', 'font-size:15px; font-weight:bold; margin-bottom:8px;');
    const brushMeter = el('div');
    const decorMeter = el('div');
    const problemList = el('div', `font-size:13px; color:${DANGER}; font-weight:bold; margin-top:6px;`);
    const track = el('div', 'position:relative; height:64px; margin:14px 0 4px 0; border-radius:12px; background:rgba(93,78,109,0.08); overflow:hidden;');
    const scale = el('div', `display:flex; justify-content:space-between; font-size:11px; color:${colors.textLight};`);
    for (const m of [0, SANDBOX_MAX_LENGTH / 2, SANDBOX_MAX_LENGTH]) scale.appendChild(el('span', '', `${m} m`));
    budgetCard.append(summary, brushMeter, decorMeter, problemList, track, scale);
    panel.appendChild(budgetCard);

    // --- Brush palette ---------------------------------------------------
    const paletteCard = card();
    paletteCard.appendChild(el('div', 'font-size:16px; font-weight:bold; margin-bottom:6px;', '🖌️ Brushes'));
    const palette = el('div', 'display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:8px;');
    const paletteNote = el('div', `font-size:12px; color:${colors.textLight}; margin-top:6px; min-height:16px;`);
    paletteCard.append(palette, paletteNote);
    panel.appendChild(paletteCard);

    // --- Placed brushes --------------------------------------------------
    const listCard = card();
    const listTitle = el('div', 'font-size:16px; font-weight:bold; margin-bottom:6px;');
    const list = el('div', 'display:flex; flex-direction:column; gap:10px;');
    listCard.append(listTitle, list);
    panel.appendChild(listCard);

    // --- Fly it ----------------------------------------------------------
    const flyCard = card();
    const flyNote = el('div', 'font-size:13px; margin-top:6px; min-height:18px; font-weight:bold;');
    const playtestBtn = bigButton('🚀 Playtest', colors.mint, () => {
        play('ui_click');
        const result = manager.playtest();
        if (!result.ok) {
            flyNote.style.color = DANGER;
            flyNote.textContent = `Can't fly yet: ${result.reason}`;
            return;
        }
        setPendingRunSeed(result.run);
        location.reload();
    });
    const rerollBtn = bigButton('🎲 New seed', colors.lemon, () => {
        play('twinkle');
        manager.rerollSeed();
        refreshLive();
    });
    const clearBtn = bigButton('🧹 Clear', colors.peach, () => {
        play('ui_click');
        manager.clear();
        renderPlacements();
    });
    flyCard.append(buttonRow(playtestBtn, rerollBtn, clearBtn), flyNote);
    panel.appendChild(flyCard);

    // --- Share: export / import seed JSON --------------------------------
    const shareCard = card();
    const textareaCss = `
        width:100%; box-sizing:border-box; min-height:72px; padding:10px; border-radius:12px;
        border:2px solid rgba(93,78,109,0.3); font-size:12px; font-family:monospace; resize:vertical;
    `;
    const exportBox = el('textarea', textareaCss);
    exportBox.readOnly = true;
    exportBox.setAttribute('aria-label', 'Course seed to share');
    const copyBtn = bigButton('📋 Copy seed', colors.sky, () => {
        play('ui_click');
        copyText(copyBtn, exportBox.value, exportBox);
    });
    const importBox = el('textarea', textareaCss);
    importBox.placeholder = 'Paste a friend\'s course seed here…';
    importBox.spellcheck = false;
    importBox.setAttribute('aria-label', 'Course seed to import');
    const importErrors = el('div', `font-size:13px; margin-top:6px; color:${DANGER};`);
    const importBtn = bigButton('📥 Load course', colors.lavender, () => {
        play('ui_click');
        importErrors.replaceChildren();
        const result = manager.importText(importBox.value);
        if (!result.ok) {
            importBox.style.borderColor = DANGER;
            importErrors.style.color = DANGER;
            for (const error of result.errors) importErrors.appendChild(el('div', '', `• ${error}`));
            return;
        }
        importBox.style.borderColor = 'rgba(93,78,109,0.3)';
        importBox.value = '';
        importErrors.style.color = OK_GREEN;
        importErrors.textContent = '✅ Course loaded!';
        renderPlacements();
    });
    shareCard.append(
        el('div', 'font-size:16px; font-weight:bold; margin-bottom:6px;', '🔗 Share'),
        exportBox,
        buttonRow(copyBtn),
        el('div', 'font-size:15px; font-weight:bold; margin:14px 0 6px 0;', '📥 Fly a friend\'s course'),
        importBox,
        buttonRow(importBtn),
        importErrors
    );
    panel.appendChild(shareCard);

    function meterRow(target: HTMLElement, label: string, value: number, cap: number): void {
        const over = value > cap;
        const pct = Math.min(100, (value / cap) * 100);
        const head = el('div', 'display:flex; justify-content:space-between; font-size:13px; margin-top:4px;');
        head.append(el('span', `color:${colors.textLight};`, label), el('span', `font-weight:bold; color:${over ? DANGER : colors.textDark};`, `${value} / ${cap}`));
        const bar = el('div', 'height:10px; border-radius:6px; background:rgba(93,78,109,0.12); overflow:hidden;');
        bar.appendChild(el('div', `height:100%; width:${pct}%; background:${over ? DANGER : colors.mint}; transition:width 0.15s;`));
        target.replaceChildren(head, bar);
    }

    function renderTrack(xs: number[], length: number): void {
        const span = el('div', `position:absolute; left:0; top:0; bottom:0; width:${(length / SANDBOX_MAX_LENGTH) * 100}%; background:rgba(152,251,152,0.35);`);
        const flag = el('div', `position:absolute; top:2px; left:${(length / SANDBOX_MAX_LENGTH) * 100}%; transform:translateX(-100%); font-size:16px;`, '🏁');
        const nodes: HTMLElement[] = [span, flag];
        for (let i = 0; i < manager.count; i++) {
            const p = manager.placement(i)!;
            const def = BRUSH_REGISTRY[p.brushId];
            // Anchored brushes on the top lane, whole-course brushes below.
            const top = def.scope === 'anchor' ? 6 : 34;
            const chip = el('div', `position:absolute; top:${top}px; left:${(xs[i] / SANDBOX_MAX_LENGTH) * 100}%; transform:translateX(-50%); font-size:20px; line-height:1;`, def.icon);
            chip.title = `${def.label} · ${xs[i]} m`;
            nodes.push(chip);
        }
        track.replaceChildren(...nodes);
    }

    /** Everything that depends on numbers only: safe to call on every slider tick. */
    function refreshLive(): void {
        const course = manager.course;
        const { budget } = course;
        summary.textContent = `🌱 Seed ${course.seed.rngSeed} · 📏 ${course.span.length} m · ${manager.count} / ${ARCHITECT_MAX_PLACEMENTS} brushes`;
        meterRow(brushMeter, '🖌️ Brush cost', budget.brushCost, budget.brushCap);
        meterRow(decorMeter, '✨ Decorations', budget.instances, budget.instanceCap);
        problemList.replaceChildren(...budget.problems.map((p) => el('div', '', `⛔ ${p}`)));
        renderTrack(course.placementX, course.span.length);
        exportBox.value = manager.exportText();

        const blocked = manager.count === 0 || budget.problems.length > 0;
        playtestBtn.style.opacity = blocked ? '0.6' : '1';
        playtestBtn.style.cursor = blocked ? 'not-allowed' : 'pointer';
        playtestBtn.setAttribute('aria-disabled', String(blocked));
        flyNote.style.color = blocked ? DANGER : OK_GREEN;
        flyNote.textContent = manager.count === 0
            ? 'Add a brush to start your course.'
            : budget.problems.length > 0
                ? `Over budget — ${budget.problems[0]}`
                : '✅ Ready to fly!';
    }

    function renderPalette(): void {
        palette.replaceChildren();
        for (const id of BRUSH_IDS) {
            const def = BRUSH_REGISTRY[id];
            const reason = manager.cannotAdd(id);
            const btn = bigButton(`${def.icon} ${def.label}`, colors.sky, () => {
                const result = manager.add(id);
                if (!result.ok) {
                    paletteNote.textContent = result.reason;
                    return;
                }
                play('twinkle');
                paletteNote.textContent = '';
                renderPlacements();
            });
            btn.style.minHeight = '48px';
            btn.style.fontSize = '15px';
            btn.style.padding = '8px 10px';
            btn.title = `Cost ${def.decorationCost}${reason ? ` — ${reason}` : ''}`;
            if (reason) {
                btn.style.opacity = '0.55';
                btn.style.cursor = 'not-allowed';
            }
            palette.appendChild(btn);
        }
    }

    function placementRow(index: number, x: number): HTMLDivElement {
        const p = manager.placement(index)!;
        const def = BRUSH_REGISTRY[p.brushId];
        const row = el('div', 'border:2px solid rgba(93,78,109,0.15); border-radius:14px; padding:10px;');

        const head = el('div', 'display:flex; align-items:center; gap:8px;');
        const name = el('div', 'flex:1; min-width:0; font-weight:bold;', `${def.icon} ${def.label}`);
        const remove = el('button', `
            min-width:44px; min-height:44px; border-radius:12px; border:2px solid rgba(93,78,109,0.2);
            background:${colors.white}; font-size:18px; cursor:pointer; touch-action:manipulation;
        `, '✖');
        remove.setAttribute('aria-label', `Remove ${def.label}`);
        remove.addEventListener('click', () => {
            play('ui_click');
            manager.remove(index);
            renderPlacements();
        });
        head.append(name, el('div', `font-size:12px; color:${colors.textLight};`, `cost ${def.decorationCost}`), remove);
        row.appendChild(head);

        const where = el('div', `font-size:13px; color:${colors.textLight}; margin-top:6px;`);
        const describeX = (v: number) => {
            where.textContent = def.scope === 'anchor' ? `📍 At ${v} m` : `🌐 Whole course · listed at ${v} m`;
        };
        describeX(x);
        const xSlider = slider(0, SANDBOX_MAX_LENGTH, 10, x);
        xSlider.setAttribute('aria-label', `${def.label} position`);
        xSlider.addEventListener('input', () => {
            manager.setX(index, Number(xSlider.value));
            describeX(Number(xSlider.value));
            refreshLive();
        });
        row.append(where, xSlider);

        if (def.densityLabel) {
            const amount = el('div', `font-size:13px; color:${colors.textLight}; margin-top:4px;`);
            const describe = (d: number) => {
                amount.textContent = `${def.densityLabel}: ${densityText(p.brushId, d)}`;
            };
            describe(p.density);
            const dSlider = slider(0, 1, 0.05, p.density);
            dSlider.setAttribute('aria-label', `${def.label} ${def.densityLabel}`);
            dSlider.addEventListener('input', () => {
                manager.setDensity(index, Number(dSlider.value));
                describe(Number(dSlider.value));
                refreshLive();
            });
            row.append(amount, dSlider);
        }
        return row;
    }

    /** Rebuilds the placement list and palette (structure changed), then the live parts. */
    function renderPlacements(): void {
        const xs = manager.course.placementX;
        listTitle.textContent = manager.count > 0 ? `🧩 Your course (${manager.count})` : '🧩 Your course';
        list.replaceChildren();
        if (manager.count === 0) {
            list.appendChild(el('div', `font-size:14px; color:${colors.textLight};`,
                'Empty sky! Tap a brush above to add it — try a candy belt, then a wind corridor, then a boss gate.'));
        }
        for (let i = 0; i < manager.count; i++) list.appendChild(placementRow(i, xs[i]));
        renderPalette();
        refreshLive();
    }

    renderPlacements();
}

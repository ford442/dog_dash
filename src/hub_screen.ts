/**
 * Space Base — the calm between-run hub shell.
 *
 * A DOM overlay (no WebGPU needed) that surfaces meta-progression already
 * persisted by SaveManager: cores balance, permanent upgrades, the Weird
 * Life Log bestiary, and chapter select via unlockedLevels. Opened from the
 * victory, game-over, and pause screens (see src/main/hub_integration.ts).
 */

import { SaveManager, type PlayerUpgrades } from './save_manager';
import { RECIPES, canCraft, craftRecipe } from './crafting_system';
import { ALL_MATERIAL_IDS, getMaterialColor, getMaterialDisplayName } from './resource_inventory';
import { createBestiaryGrid, BESTIARY_ENTRIES } from './bestiary';
import { SPECIES_NAMES } from './discovery_system';
import { LEVEL_CONFIG } from './level_config';

export type HubMode = 'victory' | 'gameover' | 'pause';

/** Snapshot of the run that just ended (or is paused). */
export interface HubRunSummary {
    distance: number;
    coresEarned: number;
    speciesDiscovered: number;
    creaturesCataloged: number;
}

export interface HubScreenOptions {
    mode: HubMode;
    summary?: HubRunSummary;
    /** Launch (or relaunch) a run starting at this chapter (1-6). */
    onLaunchChapter: (chapter: number) => void;
    /** Close the hub and return to whatever screen opened it. */
    onClose: () => void;
    playSound?: (name: 'ui_click' | 'twinkle') => void;
}

const CHAPTER_COUNT = 6;

// Persisted "start at this chapter" request, consumed on the next boot
// (restarts go through location.reload(), so this must survive it).
const PENDING_CHAPTER_KEY = 'dog_dash_pending_chapter';

export function setPendingStartChapter(chapter: number): void {
    try {
        localStorage.setItem(PENDING_CHAPTER_KEY, String(chapter));
    } catch (e) {
        console.warn('Failed to store pending chapter:', e);
    }
}

/** Reads and clears the requested start chapter. Null when none was set. */
export function consumePendingStartChapter(): number | null {
    try {
        const raw = localStorage.getItem(PENDING_CHAPTER_KEY);
        if (raw === null) return null;
        localStorage.removeItem(PENDING_CHAPTER_KEY);
        const chapter = parseInt(raw, 10);
        return Number.isFinite(chapter) ? chapter : null;
    } catch (e) {
        return null;
    }
}

// Kid-friendly pastel palette (matches hud_system/styles.ts)
const HUB_COLORS = {
    pinkLight: '#FFD1DC',
    lavender: '#E6E6FA',
    mint: '#98FB98',
    peach: '#FFDAB9',
    sky: '#B0E0E6',
    lemon: '#FFFACD',
    gold: '#FFD700',
    white: '#FFFFFF',
    textDark: '#5D4E6D',
    textLight: '#8B7B8B',
    shadow: 'rgba(147, 112, 219, 0.3)'
};

interface ShopItem {
    key: keyof PlayerUpgrades;
    icon: string;
    name: string;
    desc: string;
}

const SHOP_ITEMS: ShopItem[] = [
    { key: 'maxHealthBonus', icon: '💖', name: 'Tougher Rocket', desc: '+1 heart forever' },
    { key: 'startingHealth', icon: '🛡️', name: 'Lucky Charm', desc: '+1 spare heart at launch' },
    { key: 'fireRateBonus', icon: '⭐', name: 'Zippy Blaster', desc: 'Shoot 10% faster' },
    { key: 'speedBonus', icon: '🚀', name: 'Super Thrusters', desc: 'Fly 10% faster' }
];

type HubTab = 'home' | 'shop' | 'craft' | 'log' | 'journey';

export function createHubScreen(saveManager: SaveManager, options: HubScreenOptions): HTMLDivElement {
    const play = options.playSound ?? (() => {});
    let activeTab: HubTab = 'home';

    const container = document.createElement('div');
    container.id = 'hub-screen';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(160deg, #2a2547 0%, #453a6b 55%, #6b5a8e 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 1500;
        font-family: 'Segoe UI', 'Comic Sans MS', sans-serif;
        color: ${HUB_COLORS.textDark};
        overflow: hidden;
    `;

    // Header: title + cores balance
    const header = document.createElement('div');
    header.style.cssText = `
        width: 100%;
        max-width: 720px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 20px 8px 20px;
        box-sizing: border-box;
    `;
    const title = document.createElement('div');
    title.style.cssText = `
        font-size: clamp(22px, 5vw, 32px);
        font-weight: bold;
        color: ${HUB_COLORS.white};
        text-shadow: 0 2px 8px ${HUB_COLORS.shadow};
    `;
    title.textContent = '🐕 Space Base 🌙';

    const coresChip = document.createElement('div');
    coresChip.id = 'hub-cores-chip';
    coresChip.style.cssText = `
        background: linear-gradient(135deg, ${HUB_COLORS.lemon}, ${HUB_COLORS.gold});
        border: 3px solid ${HUB_COLORS.white};
        border-radius: 20px;
        padding: 8px 16px;
        font-size: clamp(16px, 4vw, 20px);
        font-weight: bold;
        white-space: nowrap;
        box-shadow: 0 4px 12px ${HUB_COLORS.shadow};
    `;
    header.appendChild(title);
    header.appendChild(coresChip);

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.style.cssText = `
        display: flex;
        gap: 8px;
        width: 100%;
        max-width: 720px;
        padding: 8px 20px;
        box-sizing: border-box;
    `;

    const tabs: { id: HubTab; label: string }[] = [
        { id: 'home', label: '🏠 Home' },
        { id: 'shop', label: '⚡ Shop' },
        { id: 'craft', label: '🔨 Craft' },
        { id: 'log', label: '📖 Life Log' },
        { id: 'journey', label: '🗺️ Chapters' }
    ];
    const tabButtons = new Map<HubTab, HTMLButtonElement>();

    // Scrollable content panel
    const panel = document.createElement('div');
    panel.style.cssText = `
        flex: 1;
        width: 100%;
        max-width: 720px;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding: 8px 20px;
        box-sizing: border-box;
    `;

    // Footer: close button
    const footer = document.createElement('div');
    footer.style.cssText = `
        width: 100%;
        max-width: 720px;
        display: flex;
        gap: 12px;
        padding: 10px 20px calc(16px + env(safe-area-inset-bottom, 0px)) 20px;
        box-sizing: border-box;
    `;

    const closeBtn = bigButton(
        options.mode === 'pause' ? '▶️ Back to Flight' : '↩️ Back',
        HUB_COLORS.peach,
        () => {
            play('ui_click');
            container.remove();
            options.onClose();
        }
    );
    closeBtn.style.flex = '1';
    footer.appendChild(closeBtn);

    container.appendChild(header);
    container.appendChild(tabBar);
    container.appendChild(panel);
    container.appendChild(footer);

    function bigButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.cssText = `
            min-height: 54px;
            padding: 12px 20px;
            font-size: clamp(16px, 4vw, 19px);
            font-weight: bold;
            font-family: inherit;
            background: linear-gradient(135deg, ${color}, ${HUB_COLORS.white});
            border: 3px solid ${HUB_COLORS.white};
            border-radius: 18px;
            color: ${HUB_COLORS.textDark};
            cursor: pointer;
            box-shadow: 0 4px 12px ${HUB_COLORS.shadow};
            touch-action: manipulation;
        `;
        btn.addEventListener('click', onClick);
        return btn;
    }

    function card(): HTMLDivElement {
        const el = document.createElement('div');
        el.style.cssText = `
            background: rgba(255, 255, 255, 0.92);
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 12px;
            box-shadow: 0 4px 14px ${HUB_COLORS.shadow};
        `;
        return el;
    }

    function refreshCores(): void {
        coresChip.textContent = `🔷 ${saveManager.getCores()} cores`;
    }

    function switchTab(tab: HubTab): void {
        activeTab = tab;
        tabButtons.forEach((btn, id) => {
            const active = id === tab;
            btn.style.background = active
                ? `linear-gradient(135deg, ${HUB_COLORS.pinkLight}, ${HUB_COLORS.white})`
                : 'rgba(255,255,255,0.25)';
            btn.style.color = active ? HUB_COLORS.textDark : HUB_COLORS.white;
            btn.style.borderColor = active ? HUB_COLORS.white : 'rgba(255,255,255,0.4)';
        });
        renderPanel();
    }

    for (const tab of tabs) {
        const btn = document.createElement('button');
        btn.textContent = tab.label;
        btn.style.cssText = `
            flex: 1;
            min-height: 48px;
            padding: 8px 4px;
            font-size: clamp(13px, 3.4vw, 16px);
            font-weight: bold;
            font-family: inherit;
            border: 3px solid rgba(255,255,255,0.4);
            border-radius: 16px;
            cursor: pointer;
            touch-action: manipulation;
            background: rgba(255,255,255,0.25);
            color: ${HUB_COLORS.white};
        `;
        btn.addEventListener('click', () => {
            play('ui_click');
            switchTab(tab.id);
        });
        tabButtons.set(tab.id, btn);
        tabBar.appendChild(btn);
    }

    // ------------------------------------------------------------------
    // Tab panels
    // ------------------------------------------------------------------

    function renderPanel(): void {
        panel.innerHTML = '';
        panel.scrollTop = 0;
        switch (activeTab) {
            case 'home': renderHome(); break;
            case 'shop': renderShop(); break;
            case 'craft': renderCraft(); break;
            case 'log': renderLog(); break;
            case 'journey': renderJourney(); break;
        }
    }

    function statRow(label: string, value: string): string {
        return `
            <div style="display:flex; justify-content:space-between; padding:4px 0;">
                <span style="color:${HUB_COLORS.textLight};">${label}</span>
                <span style="font-weight:bold;">${value}</span>
            </div>
        `;
    }

    function renderHome(): void {
        const summary = options.summary;
        if (summary) {
            const runCard = card();
            const heading = options.mode === 'victory'
                ? '🎉 Amazing flight!'
                : options.mode === 'gameover'
                    ? '💫 Good try, space pup!'
                    : '🚀 Flight so far';
            runCard.innerHTML = `
                <div style="font-size:20px; font-weight:bold; margin-bottom:8px;">${heading}</div>
                ${statRow('🛣️ Distance flown', `${Math.max(0, Math.floor(summary.distance))}m`)}
                ${statRow('🔷 Cores earned', `${summary.coresEarned}`)}
                ${statRow('🌿 Plants scanned', `${summary.speciesDiscovered}`)}
                ${statRow('🐾 Creatures met', `${summary.creaturesCataloged}`)}
            `;
            panel.appendChild(runCard);
        }

        const stats = saveManager.getStats();
        const lifeCard = card();
        lifeCard.innerHTML = `
            <div style="font-size:18px; font-weight:bold; margin-bottom:8px;">🏆 Space Dog Records</div>
            ${statRow('🥇 Best distance', `${Math.floor(stats.highScore)}m`)}
            ${statRow('👾 Big bosses beaten', `${stats.bossesDefeated}`)}
            ${statRow('🌙 Moon trips finished', `${stats.runsCompleted}`)}
            ${statRow('🔷 Cores found ever', `${stats.totalCoresCollected}`)}
        `;
        panel.appendChild(lifeCard);

        const unlocked = saveManager.getUnlockedLevels().filter(l => l >= 1 && l <= CHAPTER_COUNT);
        const continueChapter = unlocked.length > 0 ? Math.max(...unlocked) : 1;
        const launchBtn = bigButton(
            continueChapter > 1 ? `🚀 Blast Off! (Chapter ${continueChapter})` : '🚀 Blast Off!',
            HUB_COLORS.mint,
            () => {
                play('ui_click');
                options.onLaunchChapter(continueChapter);
            }
        );
        launchBtn.style.width = '100%';
        launchBtn.style.minHeight = '62px';
        panel.appendChild(launchBtn);
    }

    function renderShop(): void {
        const intro = card();
        intro.innerHTML = `
            <div style="font-size:18px; font-weight:bold;">⚡ Rocket Workshop</div>
            <div style="color:${HUB_COLORS.textLight}; font-size:14px; margin-top:4px;">
                Trade cores for upgrades that last forever!
            </div>
        `;
        panel.appendChild(intro);

        const upgrades = saveManager.getUpgrades();
        for (const item of SHOP_ITEMS) {
            const current = upgrades[item.key];
            const max = saveManager.getMaxUpgradeLevel(item.key);
            const cost = saveManager.getUpgradeCost(item.key, current);
            const maxed = current >= max;
            const canBuy = saveManager.canUpgrade(item.key);

            const row = card();
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '12px';

            const pips = '●'.repeat(current) + '○'.repeat(Math.max(0, max - current));
            row.innerHTML = `
                <div style="font-size:34px;">${item.icon}</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:17px; font-weight:bold;">${item.name}</div>
                    <div style="font-size:13px; color:${HUB_COLORS.textLight};">${item.desc}</div>
                    <div style="font-size:14px; color:${maxed ? '#2eaa72' : HUB_COLORS.textLight}; letter-spacing:3px;">${pips}</div>
                </div>
            `;

            const buyBtn = bigButton(
                maxed ? '✅ MAX!' : `${cost} 🔷`,
                maxed ? HUB_COLORS.mint : canBuy ? HUB_COLORS.lemon : HUB_COLORS.lavender,
                () => {
                    if (maxed || !canBuy) return;
                    if (saveManager.purchaseUpgrade(item.key)) {
                        play('twinkle');
                        refreshCores();
                        renderPanel();
                    }
                }
            );
            buyBtn.style.minWidth = '110px';
            if (!maxed && !canBuy) {
                buyBtn.style.opacity = '0.6';
                buyBtn.style.cursor = 'not-allowed';
            }
            row.appendChild(buyBtn);
            panel.appendChild(row);
        }
    }

    function materialChip(id: Parameters<typeof getMaterialColor>[0], label: string, ok: boolean): string {
        const color = ok ? getMaterialColor(id) : '#ff9999';
        return `<span style="display:inline-block; padding:4px 10px; border-radius:12px; font-size:13px; font-weight:bold; border:2px solid ${color}; background:${HUB_COLORS.white}; opacity:${ok ? 1 : 0.65};">${label}</span>`;
    }

    function renderCraft(): void {
        const inv = saveManager.getResources();

        const intro = card();
        intro.innerHTML = `
            <div style="font-size:18px; font-weight:bold;">🔨 Craft Bay</div>
            <div style="color:${HUB_COLORS.textLight}; font-size:14px; margin-top:4px;">
                Turn space treasures into goodies for your next flight!
            </div>
        `;
        panel.appendChild(intro);

        // Bag summary — every material with count > 0
        const bag = card();
        const bagChips = ALL_MATERIAL_IDS
            .filter(id => (inv[id] || 0) > 0)
            .map(id => materialChip(id, `${getMaterialDisplayName(id)} ×${inv[id]}`, true))
            .join(' ');
        bag.innerHTML = `
            <div style="font-size:15px; font-weight:bold; margin-bottom:6px;">🎒 Your Bag</div>
            ${bagChips
                ? `<div style="display:flex; flex-wrap:wrap; gap:6px;">${bagChips}</div>`
                : `<div style="color:${HUB_COLORS.textLight}; font-size:14px;">Empty for now — scan and zap things out there to fill it up!</div>`}
        `;
        panel.appendChild(bag);

        // Pending loadout queued for the next run
        const loadout = saveManager.getLoadout();
        const queued = RECIPES.filter(r => (loadout[r.id] || 0) > 0);
        if (queued.length > 0) {
            const q = card();
            q.innerHTML = `
                <div style="font-size:15px; font-weight:bold; color:#2eaa72;">✅ Ready for your next run</div>
                <div style="font-size:14px; margin-top:4px;">${queued.map(r => `${r.icon} ${r.name} ×${loadout[r.id]}`).join(' · ')}</div>
            `;
            panel.appendChild(q);
        }

        for (const recipe of RECIPES) {
            const affordable = canCraft(inv, recipe);
            const pending = loadout[recipe.id] || 0;

            const row = card();
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '12px';

            const costChips = recipe.cost.map(c => {
                const have = inv[c.id] || 0;
                return materialChip(c.id, `${getMaterialDisplayName(c.id)} ${have}/${c.amount}`, have >= c.amount);
            }).join(' ');

            row.innerHTML = `
                <div style="font-size:34px;">${recipe.icon}</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:17px; font-weight:bold;">
                        ${recipe.name}${pending > 0 ? ` <span style="color:#2eaa72; font-size:13px;">×${pending} packed</span>` : ''}
                    </div>
                    <div style="font-size:13px; color:${HUB_COLORS.textLight};">${recipe.desc}</div>
                    <div style="font-size:13px; color:#2eaa72; margin-top:2px;">${recipe.effectText}</div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">${costChips}</div>
                </div>
            `;

            const craftBtn = bigButton(
                affordable ? 'Craft!' : 'Need more',
                affordable ? HUB_COLORS.lemon : HUB_COLORS.lavender,
                () => {
                    if (!affordable) return;
                    if (craftRecipe(saveManager, recipe.id)) {
                        play('twinkle');
                        renderPanel();
                    }
                }
            );
            craftBtn.style.minWidth = '110px';
            if (!affordable) {
                craftBtn.style.opacity = '0.6';
                craftBtn.style.cursor = 'not-allowed';
            }
            row.appendChild(craftBtn);
            panel.appendChild(row);
        }
    }

    function renderLog(): void {
        const cataloged = saveManager.getCatalogedCreatures().length;
        const totalCreatures = Object.keys(BESTIARY_ENTRIES).length;
        const discovered = saveManager.getDiscoveredSpecies().length;
        const totalSpecies = Object.keys(SPECIES_NAMES).length;

        const intro = card();
        intro.innerHTML = `
            <div style="font-size:18px; font-weight:bold;">📖 Weird Life Log</div>
            ${statRow('🐾 Creatures cataloged', `${cataloged} / ${totalCreatures}`)}
            ${statRow('🌿 Plants & rocks scanned', `${discovered} / ${totalSpecies}`)}
        `;
        panel.appendChild(intro);

        const grid = createBestiaryGrid(saveManager);
        grid.style.maxHeight = 'none';
        grid.style.width = '100%';
        grid.style.maxWidth = 'none';
        panel.appendChild(grid);
    }

    function renderJourney(): void {
        const intro = card();
        intro.innerHTML = `
            <div style="font-size:18px; font-weight:bold;">🗺️ Journey to the Moon</div>
            <div style="color:${HUB_COLORS.textLight}; font-size:14px; margin-top:4px;">
                Pick a chapter you've reached and blast off from there!
            </div>
        `;
        panel.appendChild(intro);

        for (let level = 1; level <= CHAPTER_COUNT; level++) {
            const cfg = LEVEL_CONFIG[level];
            const isUnlocked = saveManager.isLevelUnlocked(level);

            const row = card();
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '12px';
            if (!isUnlocked) row.style.opacity = '0.55';

            row.innerHTML = `
                <div style="font-size:30px;">${isUnlocked ? '🌟' : '🔒'}</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:16px; font-weight:bold;">Chapter ${level}</div>
                    <div style="font-size:14px; color:${HUB_COLORS.textLight};">
                        ${isUnlocked ? (cfg?.name ?? '') : 'Keep flying to unlock!'}
                    </div>
                </div>
            `;

            if (isUnlocked) {
                const goBtn = bigButton('🚀 Go!', HUB_COLORS.sky, () => {
                    play('ui_click');
                    options.onLaunchChapter(level);
                });
                goBtn.style.minWidth = '96px';
                row.appendChild(goBtn);
            }
            panel.appendChild(row);
        }
    }

    refreshCores();
    switchTab('home');

    return container;
}

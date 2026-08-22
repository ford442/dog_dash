/**
 * Decorative Object Budget — lightweight guardrails for 3D props.
 *
 * Production: counters + canSpawn enforcement only (no DOM).
 * Dev or `?debug`: live overlay in the debug panel (press `).
 */

import type { LevelConfig } from './level_config';
import { hasDebugUrlFlag } from './renderer_mode';
import type { DebugSystem } from './debug_system';

export type DecorationCategory = 'foliage' | 'creatures' | 'effects' | 'background3d';

export type DecorationBudgetOptions = {
    label: string;
    category: DecorationCategory;
    maxActive: number;
};

type BudgetEntry = DecorationBudgetOptions & {
    currentActive: number;
};

/** Overlay + verbose logging — off in production unless `?debug`. */
export const DECORATION_BUDGET_UI =
    import.meta.env.DEV || (typeof window !== 'undefined' && hasDebugUrlFlag('debug'));

const CATEGORY_ORDER: DecorationCategory[] = ['foliage', 'creatures', 'effects', 'background3d'];

const CATEGORY_LABELS: Record<DecorationCategory, string> = {
    foliage: 'Foliage',
    creatures: 'Creatures',
    effects: 'Effects',
    background3d: 'Background 3D'
};

/** Visible streaming window used to derive foliage caps from level density. */
export const FOLIAGE_VIEWPORT_WIDTH = 470; // STREAM_AHEAD_END - STREAM_AHEAD_START
/** Hard cap on unique scattered plants in the stream window (each is a multi-mesh group). */
export const FOLIAGE_SCATTER_HARD_CAP = 140;

const GEOLOGICAL_DENSITY_KEYS = new Set([
    'cloud',
    'voidRootBall',
    'vacuumKelp',
    'iceNeedle',
    'liquidMetal',
    'magmaHeart',
    'gravityAnchor',
    'solarSail'
]);

class DecorationBudgetRegistry {
    private entries = new Map<string, BudgetEntry>();
    private panelEl: HTMLDivElement | null = null;
    private rowsEl: HTMLDivElement | null = null;
    private attachedDebug: DebugSystem | null = null;

    register(id: string, options: DecorationBudgetOptions): void {
        const existing = this.entries.get(id);
        if (existing) {
            existing.label = options.label;
            existing.category = options.category;
            existing.maxActive = options.maxActive;
            return;
        }
        this.entries.set(id, { ...options, currentActive: 0 });
        this._renderRow(id);
    }

    setMaxActive(id: string, maxActive: number): void {
        const entry = this.entries.get(id);
        if (!entry) return;
        entry.maxActive = Math.max(0, maxActive);
        this._updateRow(id);
    }

    /** For systems that already know their live count (instanced pools, rebuilds). */
    syncCount(id: string, currentActive: number): void {
        const entry = this.entries.get(id);
        if (!entry) return;
        entry.currentActive = Math.max(0, currentActive);
        this._updateRow(id);
    }

    canSpawn(id: string, count = 1): boolean {
        const entry = this.entries.get(id);
        if (!entry) return true;
        return entry.currentActive + count <= entry.maxActive;
    }

    reportSpawn(id: string, count = 1): boolean {
        const entry = this.entries.get(id);
        if (!entry) return true;
        if (entry.currentActive + count > entry.maxActive) return false;
        entry.currentActive += count;
        this._updateRow(id);
        return true;
    }

    reportDestroy(id: string, count = 1): void {
        const entry = this.entries.get(id);
        if (!entry) return;
        entry.currentActive = Math.max(0, entry.currentActive - count);
        this._updateRow(id);
    }

    resetCounts(): void {
        for (const [id, entry] of this.entries) {
            entry.currentActive = 0;
            this._updateRow(id);
        }
    }

    getSnapshot(): ReadonlyArray<{
        id: string;
        label: string;
        category: DecorationCategory;
        maxActive: number;
        currentActive: number;
    }> {
        return [...this.entries.entries()].map(([id, entry]) => ({
            id,
            label: entry.label,
            category: entry.category,
            maxActive: entry.maxActive,
            currentActive: entry.currentActive
        }));
    }

    attachToDebugSystem(debug: DebugSystem): void {
        if (!DECORATION_BUDGET_UI || this.attachedDebug) return;
        this.attachedDebug = debug;
        this._ensurePanel(debug.getCustomSectionContainer());
        debug.onVisibilityChange((visible) => {
            if (this.panelEl) this.panelEl.style.display = visible ? 'block' : 'none';
        });
    }

    private _ensurePanel(container: HTMLDivElement): void {
        if (this.panelEl) return;

        this.panelEl = document.createElement('div');
        this.panelEl.style.cssText = `
            margin-top: 8px;
            padding-top: 6px;
            border-top: 1px solid rgba(255,255,255,0.15);
            display: none;
        `;

        const header = document.createElement('div');
        header.style.cssText = 'font-weight: bold; font-size: 12px; margin-bottom: 4px; color: #9fdcff;';
        header.textContent = 'Decoration Budgets';
        this.panelEl.appendChild(header);

        this.rowsEl = document.createElement('div');
        this.rowsEl.style.cssText = 'display: flex; flex-direction: column; gap: 2px; font-family: monospace; font-size: 10px;';
        this.panelEl.appendChild(this.rowsEl);

        container.appendChild(this.panelEl);
        this._renderAllRows();
    }

    private _renderAllRows(): void {
        if (!this.rowsEl) return;
        this.rowsEl.replaceChildren();
        const sorted = [...this.entries.entries()].sort((a, b) => {
            const cat = CATEGORY_ORDER.indexOf(a[1].category) - CATEGORY_ORDER.indexOf(b[1].category);
            return cat !== 0 ? cat : a[1].label.localeCompare(b[1].label);
        });
        for (const [id] of sorted) this._renderRow(id);
    }

    private _renderRow(id: string): void {
        if (!this.rowsEl) return;
        const entry = this.entries.get(id);
        if (!entry) return;

        let row = this.rowsEl.querySelector(`[data-budget-id="${id}"]`) as HTMLDivElement | null;
        if (!row) {
            row = document.createElement('div');
            row.dataset.budgetId = id;
            row.style.cssText = 'display: flex; justify-content: space-between; gap: 8px;';
            this.rowsEl.appendChild(row);
        }
        this._paintRow(row, entry);
    }

    private _updateRow(id: string): void {
        if (!DECORATION_BUDGET_UI || !this.rowsEl) return;
        const entry = this.entries.get(id);
        const row = this.rowsEl.querySelector(`[data-budget-id="${id}"]`) as HTMLDivElement | null;
        if (!entry || !row) return;
        this._paintRow(row, entry);
    }

    private _paintRow(row: HTMLDivElement, entry: BudgetEntry): void {
        const over = entry.currentActive > entry.maxActive;
        const atCap = entry.currentActive >= entry.maxActive;
        const color = over ? '#ff6b6b' : atCap ? '#ffd166' : '#8fd9a8';
        row.innerHTML = `
            <span style="color:#bbb;">${CATEGORY_LABELS[entry.category].slice(0, 4)}</span>
            <span style="flex:1;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${entry.label}">${entry.label}</span>
            <span style="color:${color};">${entry.currentActive}/${entry.maxActive}</span>
        `;
    }
}

export const decorationBudget = new DecorationBudgetRegistry();

// --- Level-config helpers ----------------------------------------------------

export function sumFoliageDensity(density: LevelConfig['foliageDensity']): number {
    let total = 0;
    for (const [key, value] of Object.entries(density)) {
        if (typeof value === 'number' && !GEOLOGICAL_DENSITY_KEYS.has(key)) total += value;
    }
    return total;
}

/** Max scattered foliage props in the visible streaming window. */
export function foliageViewportMax(
    density: LevelConfig['foliageDensity'],
    viewportWidth = FOLIAGE_VIEWPORT_WIDTH,
    multiplier = 1
): number {
    const sum = sumFoliageDensity(density);
    if (sum <= 0) return 0;
    return Math.min(
        FOLIAGE_SCATTER_HARD_CAP,
        Math.max(1, Math.floor(sum * (viewportWidth / 100) * multiplier * 1.15))
    );
}

export function applyLevelDecorationBudgets(
    cfg: LevelConfig,
    objectDensityMultiplier = 1
): void {
    const foliageMax = foliageViewportMax(cfg.foliageDensity, FOLIAGE_VIEWPORT_WIDTH, objectDensityMultiplier);
    decorationBudget.setMaxActive('foliage_scatter', foliageMax);

    if (cfg.chimeDensity) {
        decorationBudget.setMaxActive(
            'crystal_chimes',
            Math.min(12, Math.max(1, Math.ceil(cfg.chimeDensity * 1.5)))
        );
    }
    if (cfg.windChimeDensity) {
        decorationBudget.setMaxActive(
            'wind_chimes',
            Math.min(8, Math.max(1, Math.ceil(cfg.windChimeDensity * 1.2)))
        );
    }
    const voidRootDensity = cfg.foliageDensity.voidRootBall ?? 0;
    if (voidRootDensity > 0) {
        decorationBudget.setMaxActive(
            'void_root_ball',
            Math.min(6, Math.max(1, Math.ceil(voidRootDensity * 0.75)))
        );
    }
}

/** Register default budgets — call once at boot. */
export function registerDefaultDecorationBudgets(): void {
    decorationBudget.register('foliage_scatter', {
        label: 'Scattered foliage',
        category: 'foliage',
        maxActive: 120
    });
    decorationBudget.register('butterfly_swarm', {
        label: 'Background butterflies',
        category: 'creatures',
        maxActive: 100
    });
    decorationBudget.register('butterfly_escort', {
        label: 'Escort butterflies',
        category: 'creatures',
        maxActive: 20
    });
    decorationBudget.register('lunar_lemur', {
        label: 'Lunar lemurs',
        category: 'creatures',
        maxActive: 3
    });
    decorationBudget.register('crystal_chimes', {
        label: 'Crystal chime clusters',
        category: 'effects',
        maxActive: 12
    });
    decorationBudget.register('wind_chimes', {
        label: 'Wind-chime mobiles',
        category: 'effects',
        maxActive: 8
    });
    decorationBudget.register('nebula_cloud_puffs', {
        label: 'Nebula cloud puffs',
        category: 'background3d',
        maxActive: 45
    });
    decorationBudget.register('nebula_energy_motes', {
        label: 'Nebula energy motes',
        category: 'background3d',
        maxActive: 50
    });
    decorationBudget.register('nebula_ribbons', {
        label: 'Nebula ribbon sheets',
        category: 'background3d',
        maxActive: 24
    });
    decorationBudget.register('magic_paintbrush_path', {
        label: 'Rainbow paint path',
        category: 'effects',
        maxActive: 36
    });
    decorationBudget.register('air_tokens', {
        label: 'Air tokens',
        category: 'effects',
        maxActive: 32
    });
    decorationBudget.register('star_eater_boss', {
        label: 'Star-Eater Pitcher (boss)',
        category: 'creatures',
        maxActive: 1
    });
    decorationBudget.register('star_eater_minions', {
        label: 'Star-Eater minion orbiters',
        category: 'creatures',
        maxActive: 4
    });
    decorationBudget.register('void_root_ball', {
        label: 'Void Root Balls',
        category: 'creatures',
        maxActive: 6
    });
    // Artifacts (plan §III) — hero props, 1–2 per run in industrial zones.
    decorationBudget.register('derelict_buoy', {
        label: 'Derelict Buoys',
        category: 'effects',
        maxActive: 2
    });
    decorationBudget.register('data_monolith', {
        label: 'Data Monoliths',
        category: 'effects',
        maxActive: 2
    });
}

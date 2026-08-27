/**
 * Save Manager - LocalStorage persistence for meta-progression
 */

import {
    type MaterialId,
    type ResourceInventory,
    createEmptyInventory,
    normalizeInventory
} from './resource_inventory';

export interface PlayerUpgrades {
    maxHealthBonus: number;      // +0 to +2 (max 5 total health)
    fireRateBonus: number;       // 0 to 0.3 (+30%)
    speedBonus: number;          // 0 to 0.3 (+30%)
    startingHealth: number;      // 0 to +2 extra hearts on start
}

export interface GameStats {
    totalCoresCollected: number;
    totalCoresSpent: number;
    highScore: number;           // Distance reached
    bossesDefeated: number;
    runsCompleted: number;
    totalPlayTime: number;       // seconds
}

export interface LastRunSummary {
    seed: string;
    distance: number;
    endedAt: number;
}

/** Persisted audio preferences (accessibility + mixing). */
export interface AudioSettings {
    /** 0..1 master output level. */
    master: number;
    /** 0..1 music bus level. */
    music: number;
    /** 0..1 SFX bus level. */
    sfx: number;
    /** Fewer music layers and no noise beds (sensory + perf). */
    reducedAudio: boolean;
}

export interface SaveData {
    cores: number;
    upgrades: PlayerUpgrades;
    stats: GameStats;
    unlockedLevels: number[];
    discoveredSpecies: string[];
    catalogedCreatures: string[];
    /** Data Monolith lore ids decoded (see architect_lore.ts). */
    architectLoreUnlocked: string[];
    /** Derelict Buoy map fragments collected (persist across runs). */
    mapFragments: number;
    /** Quantum Compass HUD upgrade unlocked (full buoy network decoded). */
    quantumCompassUnlocked: boolean;
    /** Crafting material bag (Plasma Caster economy Phase A). */
    resources: ResourceInventory;
    /** Crafted items queued for the next run (recipeId -> charges). Consumed at boot. */
    loadout: Record<string, number>;
    /** Last completed run seed + distance (Cosmic Architect foundation). */
    lastRun?: LastRunSummary;
    /** Master / music / SFX levels and the reduced-audio preference. */
    audio: AudioSettings;
    version: string;
}

const SAVE_KEY = 'dog_dash_save_v1';
const CURRENT_VERSION = '1.0';

const DEFAULT_UPGRADES: PlayerUpgrades = {
    maxHealthBonus: 0,
    fireRateBonus: 0,
    speedBonus: 0,
    startingHealth: 0
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
    master: 0.7,
    music: 0.7,
    sfx: 0.8,
    reducedAudio: false
};

/** Coerce a raw audio payload, clamping levels into 0..1. */
function normalizeAudioSettings(raw: unknown): AudioSettings {
    const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const level = (value: unknown, fallback: number): number => {
        const n = Number(value);
        return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
    };
    return {
        master: level(source.master, DEFAULT_AUDIO_SETTINGS.master),
        music: level(source.music, DEFAULT_AUDIO_SETTINGS.music),
        sfx: level(source.sfx, DEFAULT_AUDIO_SETTINGS.sfx),
        reducedAudio: source.reducedAudio === true
    };
}

const DEFAULT_STATS: GameStats = {
    totalCoresCollected: 0,
    totalCoresSpent: 0,
    highScore: 0,
    bossesDefeated: 0,
    runsCompleted: 0,
    totalPlayTime: 0
};

/** Coerce a raw loadout payload into a clean recipeId -> charge count map. */
function normalizeLoadout(raw: unknown): Record<string, number> {
    const out: Record<string, number> = {};
    if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
            const n = Math.floor(Number(v));
            if (Number.isFinite(n) && n > 0) out[k] = n;
        }
    }
    return out;
}

function normalizeLastRun(raw: unknown): LastRunSummary | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const r = raw as Record<string, unknown>;
    const seed = typeof r.seed === 'string' ? r.seed : '';
    const distance = Math.floor(Number(r.distance));
    const endedAt = Math.floor(Number(r.endedAt));
    if (!seed || !Number.isFinite(distance) || !Number.isFinite(endedAt)) return undefined;
    return { seed, distance, endedAt };
}

export class SaveManager {
    private data: SaveData;
    private lastSaveTime: number = 0;

    constructor() {
        this.data = this.loadOrCreate();
    }

    private loadOrCreate(): SaveData {
        try {
            const saved = localStorage.getItem(SAVE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Migrate old saves
                if (parsed.version !== CURRENT_VERSION) {
                    return this.migrateSave(parsed);
                }
                return this.normalizeSave(parsed);
            }
        } catch (e) {
            console.warn('Failed to load save:', e);
        }
        
        return this.createNewSave();
    }

    private createNewSave(): SaveData {
        return {
            cores: 0,
            upgrades: { ...DEFAULT_UPGRADES },
            stats: { ...DEFAULT_STATS },
            unlockedLevels: [1],
            discoveredSpecies: [],
            catalogedCreatures: [],
            architectLoreUnlocked: [],
            mapFragments: 0,
            quantumCompassUnlocked: false,
            resources: createEmptyInventory(),
            loadout: {},
            audio: { ...DEFAULT_AUDIO_SETTINGS },
            version: CURRENT_VERSION
        };
    }

    /** Fill missing fields on older localStorage payloads without wiping progress. */
    private normalizeSave(raw: any): SaveData {
        const base = this.createNewSave();
        return {
            ...base,
            ...raw,
            upgrades: { ...base.upgrades, ...(raw?.upgrades || {}) },
            stats: { ...base.stats, ...(raw?.stats || {}) },
            unlockedLevels: Array.isArray(raw?.unlockedLevels) ? raw.unlockedLevels : base.unlockedLevels,
            discoveredSpecies: Array.isArray(raw?.discoveredSpecies) ? raw.discoveredSpecies : [],
            catalogedCreatures: Array.isArray(raw?.catalogedCreatures) ? raw.catalogedCreatures : [],
            architectLoreUnlocked: Array.isArray(raw?.architectLoreUnlocked) ? raw.architectLoreUnlocked : [],
            mapFragments: typeof raw?.mapFragments === 'number' ? raw.mapFragments : 0,
            quantumCompassUnlocked: raw?.quantumCompassUnlocked === true,
            resources: normalizeInventory(raw?.resources),
            loadout: normalizeLoadout(raw?.loadout),
            lastRun: normalizeLastRun(raw?.lastRun),
            audio: normalizeAudioSettings(raw?.audio),
            version: CURRENT_VERSION
        };
    }

    private migrateSave(oldData: any): SaveData {
        // Preserve known fields across version bumps; fill gaps via normalize.
        return this.normalizeSave(oldData);
    }

    /** Persisted audio preferences. Always fully populated. */
    getAudioSettings(): AudioSettings {
        return { ...this.data.audio };
    }

    /** Merge a partial audio update and persist it. */
    setAudioSettings(update: Partial<AudioSettings>): AudioSettings {
        this.data.audio = normalizeAudioSettings({ ...this.data.audio, ...update });
        this.save();
        return { ...this.data.audio };
    }

    save(): boolean {
        try {
            this.data.stats.totalPlayTime += (Date.now() - this.lastSaveTime) / 1000;
            this.lastSaveTime = Date.now();
            
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
            return true;
        } catch (e) {
            console.error('Failed to save:', e);
            return false;
        }
    }

    // Core currency
    getCores(): number {
        return this.data.cores;
    }

    addCores(amount: number) {
        this.data.cores += amount;
        this.data.stats.totalCoresCollected += amount;
        this.save();
    }

    spendCores(amount: number): boolean {
        if (this.data.cores < amount) return false;
        this.data.cores -= amount;
        this.data.stats.totalCoresSpent += amount;
        this.save();
        return true;
    }

    // Upgrades
    getUpgrades(): PlayerUpgrades {
        return { ...this.data.upgrades };
    }

    canUpgrade(type: keyof PlayerUpgrades): boolean {
        const current = this.data.upgrades[type];
        const max = this.getMaxUpgradeLevel(type);
        return current < max && this.getUpgradeCost(type, current) <= this.data.cores;
    }

    getUpgradeCost(type: keyof PlayerUpgrades, currentLevel: number): number {
        const costs: Record<keyof PlayerUpgrades, number[]> = {
            maxHealthBonus: [100, 250, 400],
            fireRateBonus: [150, 300, 500],
            speedBonus: [150, 300, 500],
            startingHealth: [50, 100, 200]
        };
        return costs[type][currentLevel] || Infinity;
    }

    getMaxUpgradeLevel(type: keyof PlayerUpgrades): number {
        const max: Record<keyof PlayerUpgrades, number> = {
            maxHealthBonus: 2,
            fireRateBonus: 3,
            speedBonus: 3,
            startingHealth: 2
        };
        return max[type];
    }

    purchaseUpgrade(type: keyof PlayerUpgrades): boolean {
        const current = this.data.upgrades[type];
        const cost = this.getUpgradeCost(type, current);
        
        if (this.spendCores(cost)) {
            this.data.upgrades[type]++;
            this.save();
            return true;
        }
        return false;
    }

    // Stats
    getStats(): GameStats {
        return { ...this.data.stats };
    }

    updateHighScore(distance: number) {
        if (distance > this.data.stats.highScore) {
            this.data.stats.highScore = distance;
            this.save();
        }
    }

    recordBossDefeated() {
        this.data.stats.bossesDefeated++;
        this.save();
    }

    recordRunCompleted() {
        this.data.stats.runsCompleted++;
        this.save();
    }

    getLastRun(): LastRunSummary | undefined {
        return this.data.lastRun ? { ...this.data.lastRun } : undefined;
    }

    saveLastRun(summary: LastRunSummary): void {
        this.data.lastRun = { ...summary };
        this.save();
    }

    // Flora discovery (Level 1 "Catalog" objective)
    getDiscoveredSpecies(): string[] {
        return [...(this.data.discoveredSpecies || [])];
    }

    discoverSpecies(speciesId: string): boolean {
        if (!this.data.discoveredSpecies) this.data.discoveredSpecies = [];
        if (this.data.discoveredSpecies.includes(speciesId)) return false;
        this.data.discoveredSpecies.push(speciesId);
        this.save();
        return true;
    }

    // Bestiary / "Weird Life Log" creature cataloging
    getCatalogedCreatures(): string[] {
        return [...(this.data.catalogedCreatures || [])];
    }

    /** Marks a creature as cataloged. Returns true the first time ever. */
    catalogCreature(creatureId: string): boolean {
        if (!this.data.catalogedCreatures) this.data.catalogedCreatures = [];
        if (this.data.catalogedCreatures.includes(creatureId)) return false;
        this.data.catalogedCreatures.push(creatureId);
        this.save();
        return true;
    }

    /** True if this creature has been cataloged (its "memory" bonus is active). */
    hasMemory(creatureId: string): boolean {
        return (this.data.catalogedCreatures || []).includes(creatureId);
    }

    // --- Artifacts: Data Monolith lore (The Architects) ---
    getArchitectLore(): string[] {
        return [...(this.data.architectLoreUnlocked || [])];
    }

    /** Decodes a monolith lore entry. Returns true the first time ever. */
    unlockArchitectLore(loreId: string): boolean {
        if (!this.data.architectLoreUnlocked) this.data.architectLoreUnlocked = [];
        if (this.data.architectLoreUnlocked.includes(loreId)) return false;
        this.data.architectLoreUnlocked.push(loreId);
        this.save();
        return true;
    }

    hasArchitectLore(loreId: string): boolean {
        return (this.data.architectLoreUnlocked || []).includes(loreId);
    }

    // --- Artifacts: Derelict Buoy map fragments + Quantum Compass ---
    getMapFragments(): number {
        return this.data.mapFragments || 0;
    }

    addMapFragment(amount = 1): number {
        this.data.mapFragments = (this.data.mapFragments || 0) + amount;
        this.save();
        return this.data.mapFragments;
    }

    hasQuantumCompass(): boolean {
        return this.data.quantumCompassUnlocked === true;
    }

    /** Unlocks the permanent Quantum Compass HUD upgrade. True the first time. */
    unlockQuantumCompass(): boolean {
        if (this.data.quantumCompassUnlocked) return false;
        this.data.quantumCompassUnlocked = true;
        this.save();
        return true;
    }

    // --- Crafting materials (Plasma Caster economy) ---
    getResources(): ResourceInventory {
        if (!this.data.resources) {
            this.data.resources = createEmptyInventory();
        }
        return { ...this.data.resources };
    }

    getMaterialCount(id: MaterialId): number {
        if (!this.data.resources) this.data.resources = createEmptyInventory();
        return this.data.resources[id] || 0;
    }

    /**
     * Adds crafting materials to the persistent bag.
     * @returns new total for that material
     */
    addMaterial(id: MaterialId, amount: number): number {
        if (!this.data.resources) this.data.resources = createEmptyInventory();
        if (!Number.isFinite(amount) || amount === 0) {
            return this.data.resources[id] || 0;
        }
        const next = Math.max(0, (this.data.resources[id] || 0) + Math.floor(amount));
        this.data.resources[id] = next;
        this.save();
        return next;
    }

    /** Spends materials if the bag has enough. Returns false when short. */
    spendMaterial(id: MaterialId, amount: number): boolean {
        if (!this.data.resources) this.data.resources = createEmptyInventory();
        const need = Math.floor(amount);
        if (need <= 0) return true;
        if ((this.data.resources[id] || 0) < need) return false;
        this.data.resources[id] -= need;
        this.save();
        return true;
    }

    // Level unlocks
    isLevelUnlocked(level: number): boolean {
        return this.data.unlockedLevels.includes(level);
    }

    unlockLevel(level: number) {
        if (!this.data.unlockedLevels.includes(level)) {
            this.data.unlockedLevels.push(level);
            this.save();
        }
    }

    getUnlockedLevels(): number[] {
        return [...this.data.unlockedLevels];
    }

    /** Architect Key recipe: every chapter becomes selectable forever. */
    unlockAllLevels(): void {
        this.data.unlockedLevels = [1, 2, 3, 4, 5, 6];
        this.save();
    }

    // --- Crafted loadout (Phase B crafting, see crafting_system.ts) ---

    /** Copy of the pending next-run loadout (recipeId -> charges). */
    getLoadout(): Record<string, number> {
        if (!this.data.loadout) this.data.loadout = {};
        return { ...this.data.loadout };
    }

    /** Queues crafted charges for the next run. */
    grantCrafted(recipeId: string, amount: number = 1): void {
        if (!this.data.loadout) this.data.loadout = {};
        const n = Math.floor(amount);
        if (n <= 0) return;
        this.data.loadout[recipeId] = (this.data.loadout[recipeId] || 0) + n;
        this.save();
    }

    /** Returns the pending loadout and clears it (called once at boot). */
    consumeLoadout(): Record<string, number> {
        const out = this.getLoadout();
        this.data.loadout = {};
        this.save();
        return out;
    }

    // Apply upgrades to game values
    applyToHealth(baseHealth: number): number {
        return baseHealth + this.data.upgrades.maxHealthBonus;
    }

    applyToFireRate(baseRate: number): number {
        return baseRate * (1 - this.data.upgrades.fireRateBonus);
    }

    applyToSpeed(baseSpeed: number): number {
        return baseSpeed * (1 + this.data.upgrades.speedBonus);
    }

    getStartingHealthBonus(): number {
        return this.data.upgrades.startingHealth;
    }

    // Reset
    hardReset() {
        this.data = this.createNewSave();
        localStorage.removeItem(SAVE_KEY);
    }

    // Export/Import for backup
    exportSave(): string {
        return JSON.stringify(this.data);
    }

    importSave(json: string): boolean {
        try {
            const data = JSON.parse(json);
            // Validate structure
            if (data.cores !== undefined && data.upgrades && data.stats) {
                this.data = data;
                this.save();
                return true;
            }
        } catch (e) {
            console.error('Invalid save data:', e);
        }
        return false;
    }
}

// Singleton
let saveManager: SaveManager | null = null;

export function getSaveManager(): SaveManager {
    if (!saveManager) {
        saveManager = new SaveManager();
    }
    return saveManager;
}

// Simple shop UI
export function createShopUI(onClose: () => void): HTMLDivElement {
    const save = getSaveManager();
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(10, 10, 20, 0.95);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        font-family: 'Segoe UI', sans-serif;
        color: white;
    `;

    const cores = save.getCores();
    const upgrades = save.getUpgrades();

    container.innerHTML = `
        <h1 style="font-size: 3em; margin-bottom: 10px; color: #ffcc00; text-shadow: 0 0 20px rgba(255,204,0,0.5);">
            ⚡ UPGRADE SHOP
        </h1>
        <p style="font-size: 1.5em; color: #00ffff; margin-bottom: 30px;">
            Data Cores: ${cores} 🔷
        </p>
        <div id="shop-items" style="display: flex; flex-direction: column; gap: 15px; max-width: 500px; width: 90%;"></div>
        <button id="close-shop" style="margin-top: 30px; padding: 15px 40px; font-size: 1.2em; background: #444; color: white; border: none; border-radius: 8px; cursor: pointer;">
            Close
        </button>
    `;

    const shopItems = container.querySelector('#shop-items')!;

    const items: { key: keyof PlayerUpgrades; name: string; desc: string; max: number }[] = [
        { key: 'maxHealthBonus', name: 'Reinforced Hull', desc: '+1 Max Health', max: 2 },
        { key: 'fireRateBonus', name: 'Rapid Capacitors', desc: '+10% Fire Rate', max: 3 },
        { key: 'speedBonus', name: 'Thruster Upgrade', desc: '+10% Movement Speed', max: 3 },
        { key: 'startingHealth', name: 'Emergency Shield', desc: '+1 Starting Health', max: 2 }
    ];

    items.forEach(item => {
        const current = upgrades[item.key];
        const cost = save.getUpgradeCost(item.key, current);
        const canBuy = save.canUpgrade(item.key);
        const maxed = current >= item.max;

        const el = document.createElement('div');
        el.style.cssText = `
            background: rgba(255,255,255,0.1);
            padding: 15px 20px;
            border-radius: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 2px solid ${maxed ? '#0f0' : canBuy ? '#ffcc00' : '#666'};
            opacity: ${maxed ? 0.7 : 1};
        `;

        el.innerHTML = `
            <div>
                <div style="font-size: 1.2em; font-weight: bold;">${item.name}</div>
                <div style="font-size: 0.9em; color: #aaa;">${item.desc}</div>
                <div style="font-size: 0.8em; color: #888; margin-top: 5px;">
                    Level: ${current}/${item.max}
                </div>
            </div>
            <button class="buy-btn" data-key="${item.key}" 
                style="padding: 10px 20px; background: ${canBuy ? '#00aa44' : '#666'}; color: white; border: none; border-radius: 5px; cursor: ${canBuy ? 'pointer' : 'not-allowed'};">
                ${maxed ? 'MAXED' : `${cost} 🔷`}
            </button>
        `;

        const btn = el.querySelector('.buy-btn') as HTMLButtonElement;
        if (canBuy) {
            btn.onclick = () => {
                if (save.purchaseUpgrade(item.key)) {
                    // Refresh UI
                    container.remove();
                    document.body.appendChild(createShopUI(onClose));
                }
            };
        }

        shopItems.appendChild(el);
    });

    container.querySelector('#close-shop')!.addEventListener('click', () => {
        container.remove();
        onClose();
    });

    return container;
}

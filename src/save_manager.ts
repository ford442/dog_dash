/**
 * Save Manager - LocalStorage persistence for meta-progression
 */

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

export interface SaveData {
    cores: number;
    upgrades: PlayerUpgrades;
    stats: GameStats;
    unlockedLevels: number[];
    discoveredSpecies: string[];
    catalogedCreatures: string[];
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

const DEFAULT_STATS: GameStats = {
    totalCoresCollected: 0,
    totalCoresSpent: 0,
    highScore: 0,
    bossesDefeated: 0,
    runsCompleted: 0,
    totalPlayTime: 0
};

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
                return parsed;
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
            version: CURRENT_VERSION
        };
    }

    private migrateSave(oldData: any): SaveData {
        // Handle version migrations here if needed
        return this.createNewSave();
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

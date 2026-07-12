import type { NebulaKraken } from '../space_robot_squid';
import { BOSS_DISPLAY_NAME } from '../space_robot_squid';

// BOSS HEALTH BAR UI
// =============================================================================
let bossHealthBar: HTMLDivElement | null = null;
let bossHealthFill: HTMLDivElement | null = null;
let bossHealthLabel: HTMLDivElement | null = null;

export function updateBossHealthBar(squids: NebulaKraken[]): void {
    const activeSquid = squids.find(s => !s.isDestroyed);

    if (!activeSquid) {
        // No active boss: hide the bar
        if (bossHealthBar) {
            bossHealthBar.style.display = 'none';
        }
        return;
    }

    // Create UI elements if they don't exist yet
    if (!bossHealthBar) {
        bossHealthBar = document.createElement('div');
        bossHealthBar.id = 'boss-health-bar';
        bossHealthBar.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            width: 320px; height: 18px; background: #111; border: 2px solid #9900ff;
            border-radius: 9px; overflow: hidden; z-index: 100;
            box-shadow: 0 0 15px #9900ff55, inset 0 0 6px #000;
        `;

        bossHealthFill = document.createElement('div');
        bossHealthFill.style.cssText = `
            width: 100%; height: 100%; background: linear-gradient(90deg, #8A2BE2, #ff00ff, #9400D3);
            transition: width 0.3s ease; border-radius: 7px;
        `;
        bossHealthBar.appendChild(bossHealthFill);

        bossHealthLabel = document.createElement('div');
        bossHealthLabel.style.cssText = `
            position: fixed; top: 4px; left: 50%; transform: translateX(-50%);
            color: #cc88ff; font-family: monospace; font-size: 11px;
            text-transform: uppercase; letter-spacing: 2px; z-index: 101;
            text-shadow: 0 0 8px #9900ff;
        `;
        bossHealthLabel.textContent = `⚠ ${BOSS_DISPLAY_NAME} ⚠`;
        document.body.appendChild(bossHealthLabel);
        document.body.appendChild(bossHealthBar);
    }

    bossHealthBar.style.display = 'block';
    if (bossHealthLabel) bossHealthLabel.style.display = 'block';

    const ratio = activeSquid.getHealthRatio();
    if (bossHealthFill) {
        bossHealthFill.style.width = `${Math.max(0, ratio * 100)}%`;
    }

    // Change label per phase
    if (bossHealthLabel) {
        const phase = activeSquid.getPhase();
        const personality = activeSquid.getPersonality();
        const phaseNames = ['', 'VOID SWEEP', 'INK PROTOCOL', 'FRENZY'];
        bossHealthLabel.textContent = `⚠ ${BOSS_DISPLAY_NAME} — ${phaseNames[phase]} [${personality.toUpperCase()}] ⚠`;
    }
}

import type { NebulaKraken } from '../space_robot_squid';
import { BOSS_DISPLAY_NAME as KRAKEN_NAME } from '../space_robot_squid';
import type { StarEaterBoss } from '../boss_system';
import { BOSS_DISPLAY_NAME as PITCHER_NAME } from '../boss_system';

// BOSS HEALTH BAR UI
// =============================================================================
let bossHealthBar: HTMLDivElement | null = null;
let bossHealthFill: HTMLDivElement | null = null;
let bossHealthLabel: HTMLDivElement | null = null;
let activeBossKind: 'kraken' | 'pitcher' | null = null;

function ensureBossHealthBar(borderColor: string, gradient: string): void {
    if (bossHealthBar) return;

    bossHealthBar = document.createElement('div');
    bossHealthBar.id = 'boss-health-bar';
    bossHealthBar.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        width: 320px; height: 18px; background: #111; border: 2px solid ${borderColor};
        border-radius: 9px; overflow: hidden; z-index: 100;
        box-shadow: 0 0 15px ${borderColor}55, inset 0 0 6px #000;
    `;

    bossHealthFill = document.createElement('div');
    bossHealthFill.style.cssText = `
        width: 100%; height: 100%; background: ${gradient};
        transition: width 0.3s ease; border-radius: 7px;
    `;
    bossHealthBar.appendChild(bossHealthFill);

    bossHealthLabel = document.createElement('div');
    bossHealthLabel.style.cssText = `
        position: fixed; top: 4px; left: 50%; transform: translateX(-50%);
        color: #cc88ff; font-family: monospace; font-size: 11px;
        text-transform: uppercase; letter-spacing: 2px; z-index: 101;
        text-shadow: 0 0 8px ${borderColor};
    `;
    document.body.appendChild(bossHealthLabel);
    document.body.appendChild(bossHealthBar);
}

function hideBossHealthBar(): void {
    if (bossHealthBar) bossHealthBar.style.display = 'none';
    if (bossHealthLabel) bossHealthLabel.style.display = 'none';
    activeBossKind = null;
}

export function updateBossHealthBar(squids: NebulaKraken[], pitcher?: StarEaterBoss | null): void {
    const activeSquid = squids.find(s => !s.isDestroyed);
    const activePitcher = pitcher?.isActive && pitcher.phase !== 'defeated' ? pitcher : null;

    if (activePitcher) {
        if (activeBossKind !== 'pitcher') {
            bossHealthBar = null;
            bossHealthFill = null;
            bossHealthLabel = null;
            activeBossKind = 'pitcher';
        }
        ensureBossHealthBar('#ff0044', 'linear-gradient(90deg, #660022, #ff0044, #ff66aa)');

        bossHealthBar!.style.display = 'block';
        if (bossHealthLabel) bossHealthLabel.style.display = 'block';

        const ratio = activePitcher.getHealthRatio();
        if (bossHealthFill) {
            bossHealthFill.style.width = `${Math.max(0, ratio * 100)}%`;
        }

        const rageTag = activePitcher.isRaging() ? ' [RAGE]' : '';
        if (bossHealthLabel) {
            bossHealthLabel.textContent =
                `⚠ ${PITCHER_NAME} — ${activePitcher.getPhaseName()}${rageTag} ⚠`;
        }
        return;
    }

    if (!activeSquid) {
        hideBossHealthBar();
        return;
    }

    if (activeBossKind !== 'kraken') {
        bossHealthBar = null;
        bossHealthFill = null;
        bossHealthLabel = null;
        activeBossKind = 'kraken';
    }
    ensureBossHealthBar('#9900ff', 'linear-gradient(90deg, #8A2BE2, #ff00ff, #9400D3)');

    bossHealthBar!.style.display = 'block';
    if (bossHealthLabel) bossHealthLabel.style.display = 'block';

    const ratio = activeSquid.getHealthRatio();
    if (bossHealthFill) {
        bossHealthFill.style.width = `${Math.max(0, ratio * 100)}%`;
    }

    if (bossHealthLabel) {
        const phase = activeSquid.getPhase();
        const personality = activeSquid.getPersonality();
        const phaseNames = ['', 'VOID SWEEP', 'INK PROTOCOL', 'FRENZY'];
        bossHealthLabel.textContent =
            `⚠ ${KRAKEN_NAME} — ${phaseNames[phase]} [${personality.toUpperCase()}] ⚠`;
    }
}

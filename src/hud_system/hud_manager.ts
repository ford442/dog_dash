/**
 * HUD Manager - Creates and manages the magical game interface
 */

import { SaveManager } from '../save_manager';
import { AudioSystem } from '../audio_system';
import { COLORS, POWER_UP_ICONS, PowerUpType, GameStats } from './styles';
import {
    HUDElementsBuilder,
    injectHUDStyles,
    formatNumber,
    createSparkle,
    updateHealthDisplay,
    updateHighScoreDisplay
} from './hud_elements';
import { HUDScreens } from './hud_screens';
import {
    showJourneyMap,
    hideJourneyMap,
    isJourneyMapOpen,
    createJourneyMapSnapshot,
    type JourneyMapMode,
    type JourneyMapSnapshot
} from '../journey_map';

export class HUDManager {
    private saveManager: SaveManager;
    private audioSystem: AudioSystem;
    private elements: HUDElementsBuilder;
    private screens: HUDScreens;

    /** Optional providers filled by game bootstrap for journey map data. */
    getJourneyLevel?: () => number;
    getRescuedFriendCount?: () => number;
    getCompletedChapters?: () => number[];
    /** Opens the between-run Space Base hub. Filled by bootstrap. */
    openHub?: (mode: 'victory' | 'gameover' | 'pause') => void;

    private score: number = 0;
    private distance: number = 0;
    private highScore: number = 0;
    private currentHealth: number = 3;
    private maxHealth: number = 3;

    private objectiveCompleted: boolean = false;
    /** Fired once when the current level's objective target is first reached. */
    onObjectiveComplete?: () => void;

    private activePowerUps: Map<PowerUpType, { element: HTMLDivElement; timeout: number }> = new Map();
    private soundEnabled: boolean = true;

    constructor(saveManager: SaveManager, audioSystem: AudioSystem) {
        this.saveManager = saveManager;
        this.audioSystem = audioSystem;
        this.highScore = saveManager.getStats().highScore;
        this.elements = new HUDElementsBuilder();

        this.screens = new HUDScreens({
            getSoundEnabled: () => this.soundEnabled,
            setSoundEnabled: (enabled) => { this.soundEnabled = enabled; },
            audioSystem: this.audioSystem,
            getScore: () => this.score,
            getHighScore: () => this.highScore,
            checkAndSaveHighScore: () => this.checkAndSaveHighScore()
        });

        injectHUDStyles();
        this.elements.createAll({
            updateHighScoreDisplay: () => this.refreshHighScoreDisplay(),
            updateHealthDisplay: () => this.refreshHealthDisplay()
        });
    }

    private refreshHealthDisplay(): void {
        updateHealthDisplay(this.currentHealth, this.maxHealth);
    }

    private refreshHighScoreDisplay(): void {
        updateHighScoreDisplay(this.elements.highScoreDisplay, this.highScore);
    }

    showGrazeCombo(combo: number): void {
        if (!this.elements.grazeComboDisplay) return;
        this.elements.grazeComboDisplay.textContent = `×${combo}`;
        this.elements.grazeComboDisplay.style.opacity = '1';
        this.elements.grazeComboDisplay.style.transform = 'scale(1)';
    }

    hideGrazeCombo(): void {
        if (!this.elements.grazeComboDisplay) return;
        this.elements.grazeComboDisplay.style.opacity = '0';
        this.elements.grazeComboDisplay.style.transform = 'scale(0.8)';
    }

    showSlingCombo(combo: number, isSurge: boolean = false): void {
        const display = this.elements.slingComboDisplay;
        const label = this.elements.slingComboLabel;
        if (!display || !label) return;

        if (isSurge) {
            label.textContent = `ARC SURGE ×${combo}`;
            display.style.background = 'linear-gradient(135deg, #cc44ff, #ff4400)';
            display.style.animation = 'sling-surge-pulse 0.6s ease-in-out infinite';
            display.style.fontSize = '18px';
        } else {
            label.textContent = `Sling ×${combo}`;
            display.style.background = 'linear-gradient(135deg, #aa44ff, #ff8800)';
            display.style.animation = '';
            display.style.fontSize = '16px';
        }

        display.style.opacity = '1';
        display.style.transform = 'scale(1)';
    }

    hideSlingCombo(): void {
        const display = this.elements.slingComboDisplay;
        if (!display) return;
        display.style.opacity = '0';
        display.style.transform = 'scale(0.8)';
        display.style.animation = '';
    }

    /** Approach-angle meter while inside a grav-lens field (0–90°). */
    updateGravLensApproach(angleDeg: number, visible: boolean): void {
        const meter = this.elements.gravLensMeter;
        const bar = this.elements.gravLensAngleBar;
        if (!meter || !bar) return;

        if (!visible) {
            meter.style.opacity = '0';
            return;
        }

        meter.style.opacity = '1';
        const pct = Math.min(100, Math.max(0, (angleDeg / 90) * 100));
        bar.style.height = `${pct}%`;
    }

    /** Brief slingshot grade pop (Perfect / Partial / Failed). */
    showGravLensGrade(grade: 'perfect' | 'partial' | 'failed', chain: number = 0): void {
        const el = this.elements.gravLensGrade;
        if (!el) return;

        const labels = {
            perfect: 'Perfect!',
            partial: 'Partial',
            failed: 'Failed'
        };
        const colors = {
            perfect: 'linear-gradient(135deg, #44ffcc, #2288ff)',
            partial: 'linear-gradient(135deg, #ffcc44, #ff8800)',
            failed: 'linear-gradient(135deg, #ff2244, #880022)'
        };

        el.textContent = chain > 1 ? `${labels[grade]} ×${chain}` : labels[grade];
        el.style.background = colors[grade];
        el.style.opacity = '1';
        el.style.transform = 'scale(1.05)';

        window.clearTimeout((el as unknown as { _gradeTimer?: number })._gradeTimer);
        (el as unknown as { _gradeTimer?: number })._gradeTimer = window.setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'scale(0.85)';
        }, grade === 'perfect' ? 1400 : 900);
    }

    hideGravLensHud(): void {
        this.updateGravLensApproach(0, false);
        const el = this.elements.gravLensGrade;
        if (el) el.style.opacity = '0';
    }

    /**
     * HUD Resource Pop — shows last collected craft material with juice animation
     * (float up, scale 1→1.5→0.8, rotate 360° per plan §IV).
     */
    showResourcePop(materialName: string, amount: number, color: string = COLORS.gold): void {
        const amountLabel = amount > 1 ? ` ×${amount}` : '';
        const labelText = `${materialName}${amountLabel}`;

        const last = this.elements.lastMaterialLabel;
        if (last) {
            last.textContent = `✦ ${labelText}`;
            last.style.background = `linear-gradient(135deg, ${color}aa, ${COLORS.mint})`;
            last.style.opacity = '1';
            last.style.animation = 'none';
            void last.offsetWidth;
            last.style.animation = 'resource-pop-hud 1.6s ease-out forwards';
        }

        const pop = this.elements.resourcePopDisplay;
        if (pop) {
            pop.textContent = `+ ${labelText}`;
            pop.style.color = color;
            pop.style.animation = 'none';
            void pop.offsetWidth;
            pop.style.animation = 'resource-pop 1.35s ease-out forwards';
        }
    }

    setObjectiveLabel(text: string): void {
        const label = document.getElementById('hud-scan-label');
        if (label) label.textContent = text;
        this.objectiveCompleted = false;
    }

    updateObjectiveProgress(current: number, target: number): void {
        const container = this.elements.scanProgressContainer;
        if (!container) return;

        const value = document.getElementById('hud-scan-value');

        if (target <= 0) {
            if (value) value.style.display = 'none';
            container.style.display = 'flex';
            return;
        }

        container.style.display = 'flex';
        if (value) {
            value.style.display = 'block';
            value.textContent = `${current}/${target}`;
        }

        if (current >= target && !this.objectiveCompleted) {
            this.objectiveCompleted = true;
            this.celebrateObjectiveComplete();
            this.onObjectiveComplete?.();
        }
    }

    private celebrateObjectiveComplete(): void {
        const value = document.getElementById('hud-scan-value');
        if (value) {
            value.style.background = `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.mint})`;
            value.classList.remove('hud-pulse');
            void (value as HTMLElement).offsetHeight;
            value.classList.add('hud-pulse');
        }

        for (let i = 0; i < 6; i++) {
            setTimeout(() => {
                const x = window.innerWidth - 40 - Math.random() * 90;
                const y = 90 + Math.random() * 70;
                createSparkle(x, y, COLORS.gold);
            }, i * 80);
        }

        if (this.soundEnabled) {
            this.audioSystem.playMagicSequence('spell_complete');
        }
    }

    updateJourneyProgress(percent: number, level: number): void {
        const clamped = Math.min(100, Math.max(0, percent));

        const fill = document.getElementById('hud-journey-fill');
        if (fill) fill.style.width = `${clamped}%`;

        const rocket = document.getElementById('hud-journey-rocket');
        if (rocket) rocket.style.left = `${clamped}%`;

        const label = document.getElementById('hud-journey-label');
        if (label) label.textContent = `Lvl ${level}/6`;
    }

    private isMilestone(score: number): boolean {
        const milestones = [100, 500, 1000, 2000, 5000, 10000];
        return milestones.includes(score);
    }

    addScore(points: number): void {
        const oldScore = this.score;
        this.score += points;

        const scoreValue = this.elements.scoreValue;
        if (scoreValue) {
            scoreValue.textContent = formatNumber(this.score);
            scoreValue.classList.remove('hud-bounce');
            void scoreValue.offsetHeight;
            scoreValue.classList.add('hud-bounce');
        }

        if (this.isMilestone(this.score)) {
            this.celebrateMilestone();
        }

        if (this.score > this.highScore && oldScore <= this.highScore) {
            this.celebrateNewHighScore();
        }
    }

    getScore(): number {
        return this.score;
    }

    addDistance(distance: number): void {
        this.distance += distance;

        const value = document.getElementById('hud-distance-value');
        if (value) {
            value.textContent = `${Math.floor(this.distance)}m`;
        }
    }

    getDistance(): number {
        return this.distance;
    }

    updateHealth(current: number, max: number): void {
        const oldHealth = this.currentHealth;
        this.currentHealth = Math.max(0, Math.min(current, max));
        this.maxHealth = max;

        this.refreshHealthDisplay();

        if (current < oldHealth) {
            const container = this.elements.healthContainer;
            if (container) {
                container.classList.remove('hud-shake');
                void container.offsetHeight;
                container.classList.add('hud-shake');
            }

            if (this.soundEnabled) {
                this.audioSystem.play('hit', 0.5);
            }
        } else if (current > oldHealth) {
            const container = this.elements.healthContainer;
            if (container) {
                container.classList.remove('hud-heart-beat');
                void container.offsetHeight;
                container.classList.add('hud-heart-beat');
            }

            if (this.soundEnabled) {
                this.audioSystem.playMagicSound('power');
            }
        }
    }

    showPowerUpIcon(type: PowerUpType, duration: number): void {
        if (this.activePowerUps.has(type)) {
            const existing = this.activePowerUps.get(type)!;
            clearTimeout(existing.timeout);
            existing.element.remove();
        }

        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            background: linear-gradient(135deg, ${COLORS.lemon}, ${COLORS.peach});
            padding: 10px 15px;
            border-radius: 20px;
            box-shadow: 0 4px 15px ${COLORS.shadow}, inset 0 1px 0 rgba(255,255,255,0.5);
            border: 3px solid ${COLORS.white};
            animation: hud-wiggle 0.5s ease-out;
        `;

        const icon = document.createElement('span');
        icon.textContent = POWER_UP_ICONS[type];
        icon.style.cssText = `
            font-size: 24px;
            animation: hud-star-rotate 4s linear infinite;
        `;

        const countdown = document.createElement('div');
        countdown.style.cssText = `
            display: flex;
            gap: 3px;
        `;

        const segments = Math.min(5, Math.ceil(duration / 2));
        for (let i = 0; i < segments; i++) {
            const star = document.createElement('span');
            star.textContent = '⭐';
            star.style.cssText = `
                font-size: 14px;
                opacity: ${i === segments - 1 ? 1 : 0.5};
                animation: hud-countdown-pulse 1s ease-in-out infinite;
                animation-delay: ${i * 0.2}s;
            `;
            countdown.appendChild(star);
        }

        container.appendChild(icon);
        container.appendChild(countdown);

        if (this.elements.powerUpContainer) {
            this.elements.powerUpContainer.appendChild(container);
        }

        if (this.soundEnabled) {
            this.audioSystem.playMagicSound('power');
        }

        const timeout = window.setTimeout(() => {
            container.style.animation = 'hud-fade-out 0.3s ease-out forwards';
            setTimeout(() => container.remove(), 300);
            this.activePowerUps.delete(type);
        }, duration * 1000);

        this.activePowerUps.set(type, { element: container, timeout });
    }

    updateOrbProgress(current: number, needed: number): void {
        const progressBar = document.getElementById('hud-orb-progress');
        if (!progressBar) return;

        progressBar.innerHTML = '';

        for (let i = 0; i < needed; i++) {
            const orb = document.createElement('span');
            const isCollected = i < current;

            orb.style.cssText = `
                font-size: ${isCollected ? 20 : 16}px;
                opacity: ${isCollected ? 1 : 0.3};
                transition: all 0.3s ease;
                ${isCollected ? 'animation: hud-twinkle 1s ease-in-out infinite;' : ''}
                animation-delay: ${i * 0.1}s;
            `;
            orb.textContent = isCollected ? '🔮' : '⚪';

            progressBar.appendChild(orb);
        }

        if (current >= needed && current > 0) {
            createSparkle(window.innerWidth / 2, window.innerHeight - 50, COLORS.pinkDark);
            if (this.soundEnabled) {
                this.audioSystem.playMagicSequence('power_up');
            }
        }
    }

    update(_delta: number): void {
        // Power-up timeouts are handled by setTimeout
    }

    showPauseMenu(onResume: () => void, onRestart: () => void): void {
        this.screens.showPauseMenu(onResume, onRestart, {
            onOpenJourneyMap: () => this.showJourneyMapOverlay('pause'),
            onOpenHub: this.openHub ? () => this.openHub!('pause') : undefined
        });
    }

    hidePauseMenu(): void {
        this.screens.hidePauseMenu();
    }

    showVictoryScreen(stats: GameStats): void {
        this.screens.showVictoryScreen(stats, {
            onOpenJourneyMap: () => this.showJourneyMapOverlay('victory'),
            onOpenHub: this.openHub ? () => this.openHub!('victory') : undefined
        });
        // Acceptance: map visible after victory (2D overlay above the card).
        this.showJourneyMapOverlay('victory');
    }

    /** Open the Moon Journey Map (2D DOM overlay — safe for WebGL2 fallback). */
    showJourneyMapOverlay(
        mode: JourneyMapMode = 'pause',
        opts?: { completedChapter?: number; autoCloseMs?: number; onClose?: () => void }
    ): void {
        const snapshot = this.buildJourneySnapshot();
        showJourneyMap({
            mode,
            snapshot,
            completedChapter: opts?.completedChapter,
            autoCloseMs: opts?.autoCloseMs,
            onClose: opts?.onClose
        });
    }

    hideJourneyMapOverlay(): void {
        hideJourneyMap();
    }

    isJourneyMapOpen(): boolean {
        return isJourneyMapOpen();
    }

    buildJourneySnapshot(): JourneyMapSnapshot {
        const currentLevel = this.getJourneyLevel?.() ?? 1;
        const rescuedCount = this.getRescuedFriendCount?.() ?? 0;
        const completedLevels = this.getCompletedChapters?.();
        return createJourneyMapSnapshot(this.saveManager, currentLevel, rescuedCount, completedLevels);
    }

    showGameOverScreen(stats: GameStats, onRestart: () => void): void {
        this.screens.showGameOverScreen(stats, onRestart, {
            onOpenHub: this.openHub ? () => this.openHub!('gameover') : undefined
        });
    }

    checkAndSaveHighScore(): boolean {
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveManager.updateHighScore(this.score);
            this.refreshHighScoreDisplay();
            return true;
        }
        return false;
    }

    getHighScore(): number {
        return this.highScore;
    }

    private celebrateMilestone(): void {
        const scoreValue = this.elements.scoreValue;
        if (scoreValue) {
            const rect = scoreValue.getBoundingClientRect();
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    const x = rect.left + Math.random() * rect.width;
                    const y = rect.top + Math.random() * rect.height;
                    createSparkle(x, y);
                }, i * 100);
            }
        }

        if (this.soundEnabled) {
            this.audioSystem.playMagicSequence('star_collect');
        }
    }

    private celebrateNewHighScore(): void {
        const scoreValue = this.elements.scoreValue;
        if (scoreValue) {
            scoreValue.style.background = `linear-gradient(135deg, ${COLORS.lemon}, ${COLORS.gold})`;
            scoreValue.style.animation = 'hud-pulse 0.5s ease-in-out 3';

            const rect = scoreValue.getBoundingClientRect();
            for (let i = 0; i < 8; i++) {
                setTimeout(() => {
                    const angle = (i / 8) * Math.PI * 2;
                    const x = rect.left + rect.width / 2 + Math.cos(angle) * 60;
                    const y = rect.top + rect.height / 2 + Math.sin(angle) * 30;
                    createSparkle(x, y, COLORS.gold);
                }, i * 50);
            }
        }

        const highScoreDisplay = this.elements.highScoreDisplay;
        if (highScoreDisplay) {
            highScoreDisplay.innerHTML = '🎉 NEW RECORD! 🎉';
            highScoreDisplay.style.fontSize = '14px';
            highScoreDisplay.style.animation = 'hud-pulse 1s ease-in-out infinite';
        }

        if (this.soundEnabled) {
            this.audioSystem.playMagicSequence('spell_complete');
        }
    }

    reset(): void {
        this.score = 0;
        this.distance = 0;
        this.currentHealth = 3;
        this.maxHealth = 3;

        this.activePowerUps.forEach(({ element, timeout }) => {
            clearTimeout(timeout);
            element.remove();
        });
        this.activePowerUps.clear();

        const scoreValue = this.elements.scoreValue;
        if (scoreValue) {
            scoreValue.textContent = '0';
            scoreValue.style.background = `linear-gradient(135deg, ${COLORS.pinkLight}, ${COLORS.lavender})`;
        }

        const distanceValue = document.getElementById('hud-distance-value');
        if (distanceValue) distanceValue.textContent = '0m';

        this.refreshHealthDisplay();
        this.refreshHighScoreDisplay();
        this.updateOrbProgress(0, 5);
        this.objectiveCompleted = false;
        this.updateObjectiveProgress(0, 0);
        this.updateJourneyProgress(0, 1);

        if (this.screens.victoryScreen) {
            this.screens.victoryScreen.remove();
            this.screens.victoryScreen = null;
        }
        if (this.screens.gameOverScreen) {
            this.screens.gameOverScreen.remove();
            this.screens.gameOverScreen = null;
        }
    }

    destroy(): void {
        this.activePowerUps.forEach(({ timeout }) => clearTimeout(timeout));

        const el = this.elements;
        if (el.scoreContainer) el.scoreContainer.remove();
        if (el.distanceContainer) el.distanceContainer.remove();
        if (el.healthContainer) el.healthContainer.remove();
        if (el.powerUpContainer) el.powerUpContainer.remove();
        if (el.orbProgressContainer) el.orbProgressContainer.remove();
        if (el.scanProgressContainer) el.scanProgressContainer.remove();
        if (el.journeyMapContainer) el.journeyMapContainer.remove();
        if (this.screens.pauseMenu) this.screens.hidePauseMenu();
        if (this.screens.victoryScreen) this.screens.victoryScreen.remove();
        if (this.screens.gameOverScreen) this.screens.gameOverScreen.remove();
        hideJourneyMap();
    }
}

let hudManager: HUDManager | null = null;

export function getHUDManager(saveManager?: SaveManager, audioSystem?: AudioSystem): HUDManager {
    if (!hudManager && saveManager && audioSystem) {
        hudManager = new HUDManager(saveManager, audioSystem);
    }
    return hudManager!;
}

export function resetHUDManager(): void {
    if (hudManager) {
        hudManager.destroy();
        hudManager = null;
    }
}

/**
 * Pause, victory, and game-over overlay screens
 */

import { AudioSystem } from '../audio_system';
import { COLORS, GameStats } from './styles';
import { formatNumber } from './hud_elements';

export interface HUDScreensDeps {
    getSoundEnabled: () => boolean;
    setSoundEnabled: (enabled: boolean) => void;
    audioSystem: AudioSystem;
    getScore: () => number;
    getHighScore: () => number;
    checkAndSaveHighScore: () => boolean;
}

/**
 * Manages full-screen HUD overlays (pause, victory, game over).
 */
export class HUDScreens {
    pauseMenu: HTMLDivElement | null = null;
    victoryScreen: HTMLDivElement | null = null;
    gameOverScreen: HTMLDivElement | null = null;

    constructor(private deps: HUDScreensDeps) {}

    showPauseMenu(
        onResume: () => void,
        onRestart: () => void,
        extras?: { onOpenJourneyMap?: () => void }
    ): void {
        if (this.pauseMenu) return;

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 182, 193, 0.3);
            backdrop-filter: blur(5px);
            z-index: 500;
            animation: hud-fade-in 0.3s ease-out;
        `;

        this.pauseMenu = document.createElement('div');
        this.pauseMenu.className = 'hud-element hud-float';
        this.pauseMenu.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, ${COLORS.pinkLight}, ${COLORS.lavender});
            padding: 40px 50px;
            border-radius: 30px;
            box-shadow: 0 10px 40px ${COLORS.shadow}, inset 0 1px 0 rgba(255,255,255,0.5);
            border: 4px solid ${COLORS.white};
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            z-index: 501;
            min-width: 300px;
            animation: hud-bounce 0.5s ease-out;
        `;

        const dogArt = document.createElement('pre');
        dogArt.style.cssText = `
            font-size: 14px;
            line-height: 1.2;
            color: ${COLORS.textDark};
            margin: 0;
            text-align: center;
            font-family: monospace;
        `;
        dogArt.textContent = [
            '',
            '    🌙  ⋆  ·  ˚  ✦',
            '      ⋆ ·  Sleepy  · ⋆',
            '   ╭──────────────╮',
            '   │   🐕💤🌸     │',
            '   │  ૮ ˶´ ꒳ ` ˶ ა  │',
            '   │    ( -.- )   │',
            '   ╰────┬────┬────╯',
            '        🎀  🎀',
            ''
        ].join('\n');

        const title = document.createElement('h2');
        title.style.cssText = `
            margin: 0;
            font-size: 28px;
            color: ${COLORS.textDark};
            text-shadow: 1px 1px 0 rgba(255,255,255,0.5);
        `;
        title.textContent = 'Paused 💤';

        const buttons = document.createElement('div');
        buttons.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 100%;
            margin-top: 10px;
        `;

        const resumeBtn = this.createMenuButton('▶️ Resume', COLORS.mint, () => {
            this.hidePauseMenu();
            onResume();
        });

        const restartBtn = this.createMenuButton('🔄 Restart', COLORS.peach, () => {
            this.hidePauseMenu();
            onRestart();
        });

        const soundBtn = this.createMenuButton(
            this.deps.getSoundEnabled() ? '🔊 Sound On' : '🔇 Sound Off',
            COLORS.sky,
            () => {
                const next = !this.deps.getSoundEnabled();
                this.deps.setSoundEnabled(next);
                soundBtn.textContent = next ? '🔊 Sound On' : '🔇 Sound Off';
                if (next) {
                    this.deps.audioSystem.setSFXVolume(0.8);
                } else {
                    this.deps.audioSystem.setSFXVolume(0);
                }
            }
        );

        const mapBtn = this.createMenuButton('🗺️ Journey Map', COLORS.lemon, () => {
            extras?.onOpenJourneyMap?.();
        });

        buttons.appendChild(resumeBtn);
        buttons.appendChild(mapBtn);
        buttons.appendChild(restartBtn);
        buttons.appendChild(soundBtn);

        this.pauseMenu.appendChild(dogArt);
        this.pauseMenu.appendChild(title);
        this.pauseMenu.appendChild(buttons);

        document.body.appendChild(overlay);
        document.body.appendChild(this.pauseMenu);

        this.pauseMenu.dataset.overlay = '';
        (this.pauseMenu as HTMLDivElement & { overlayElement?: HTMLDivElement }).overlayElement = overlay;
    }

    private createMenuButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.className = 'hud-interactive';
        btn.style.cssText = `
            padding: 15px 30px;
            font-size: 18px;
            font-weight: bold;
            background: linear-gradient(135deg, ${color}, ${COLORS.white});
            border: 3px solid ${COLORS.white};
            border-radius: 20px;
            color: ${COLORS.textDark};
            cursor: pointer;
            box-shadow: 0 4px 15px ${COLORS.shadow};
            transition: all 0.2s ease;
            font-family: inherit;
        `;
        btn.textContent = text;
        btn.addEventListener('click', () => {
            if (this.deps.getSoundEnabled()) {
                this.deps.audioSystem.play('ui_click');
            }
            onClick();
        });
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.05)';
            btn.style.boxShadow = `0 6px 20px ${COLORS.glow}`;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = `0 4px 15px ${COLORS.shadow}`;
        });

        return btn;
    }

    hidePauseMenu(): void {
        if (this.pauseMenu) {
            const overlay = (this.pauseMenu as HTMLDivElement & { overlayElement?: HTMLDivElement }).overlayElement;
            if (overlay) overlay.remove();
            this.pauseMenu.remove();
            this.pauseMenu = null;
        }
    }

    showVictoryScreen(
        stats: GameStats,
        extras?: { onOpenJourneyMap?: () => void }
    ): void {
        this.celebrateVictory();

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, rgba(255,182,193,0.9), rgba(230,230,250,0.9));
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: hud-fade-in 0.5s ease-out;
        `;

        const container = document.createElement('div');
        container.className = 'hud-element hud-float';
        container.style.cssText = `
            background: linear-gradient(135deg, ${COLORS.pinkLight}, ${COLORS.lemon});
            padding: 50px 60px;
            border-radius: 40px;
            box-shadow: 0 20px 60px ${COLORS.shadow}, inset 0 1px 0 rgba(255,255,255,0.5);
            border: 5px solid ${COLORS.white};
            text-align: center;
            max-width: 500px;
            animation: hud-bounce 0.6s ease-out;
        `;

        container.innerHTML = `
            <div style="font-size: 60px; margin-bottom: 10px;">🎉🏆🎉</div>
            <h1 style="color: ${COLORS.textDark}; font-size: 36px; margin: 0 0 20px 0; text-shadow: 2px 2px 0 rgba(255,255,255,0.5);">
                You Did It! ✨
            </h1>
            <p style="color: ${COLORS.textLight}; font-size: 18px; margin-bottom: 30px;">
                The puppy reached the moon! 🌙🐕
            </p>
            <div style="background: rgba(255,255,255,0.6); padding: 20px; border-radius: 20px; margin-bottom: 30px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left;">
                    <div style="color: ${COLORS.textLight};">⭐ Score:</div>
                    <div style="color: ${COLORS.textDark}; font-weight: bold; text-align: right;">${formatNumber(stats.score)}</div>
                    <div style="color: ${COLORS.textLight};">🚀 Distance:</div>
                    <div style="color: ${COLORS.textDark}; font-weight: bold; text-align: right;">${Math.floor(stats.distance)}m</div>
                    <div style="color: ${COLORS.textLight};">🔮 Orbs:</div>
                    <div style="color: ${COLORS.textDark}; font-weight: bold; text-align: right;">${stats.orbsCollected}</div>
                    <div style="color: ${COLORS.textLight};">⚡ Power-ups:</div>
                    <div style="color: ${COLORS.textDark}; font-weight: bold; text-align: right;">${stats.powerUpsUsed}</div>
                </div>
            </div>
        `;

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex; flex-direction:column; gap:12px; align-items:stretch;';

        const mapBtn = this.createMenuButton('🗺️ Journey Map', COLORS.lemon, () => {
            extras?.onOpenJourneyMap?.();
        });

        const playAgainBtn = this.createMenuButton('🎮 Play Again', COLORS.mint, () => {
            location.reload();
        });

        btnRow.appendChild(mapBtn);
        btnRow.appendChild(playAgainBtn);
        container.appendChild(btnRow);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        this.victoryScreen = overlay;
    }

    showGameOverScreen(stats: GameStats, onRestart: () => void): void {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(147, 112, 219, 0.9);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: hud-fade-in 0.5s ease-out;
        `;

        const container = document.createElement('div');
        container.className = 'hud-element';
        container.style.cssText = `
            background: linear-gradient(135deg, ${COLORS.lavender}, ${COLORS.pinkLight});
            padding: 50px 60px;
            border-radius: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.5);
            border: 5px solid ${COLORS.white};
            text-align: center;
            max-width: 500px;
        `;

        const isNewHighScore = this.deps.checkAndSaveHighScore();
        const score = this.deps.getScore();
        const highScore = this.deps.getHighScore();

        container.innerHTML = `
            <div style="font-size: 50px; margin-bottom: 10px;">${isNewHighScore ? '🎊✨🎊' : '🌟💫🌟'}</div>
            <h1 style="color: ${COLORS.textDark}; font-size: 32px; margin: 0 0 10px 0;">
                ${isNewHighScore ? 'New High Score!' : 'Good Try!'}
            </h1>
            ${isNewHighScore ? `<p style="color: ${COLORS.gold}; font-size: 20px; font-weight: bold; margin: 0 0 20px 0;">🏆 ${formatNumber(score)} points! 🏆</p>` : ''}
            <p style="color: ${COLORS.textLight}; font-size: 16px; margin-bottom: 25px;">
                ${isNewHighScore ? 'You\'re a space champion!' : 'The puppy will try again! 🐕'}
            </p>
            <div style="background: rgba(255,255,255,0.6); padding: 15px; border-radius: 15px; margin-bottom: 25px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: ${COLORS.textLight};">Final Score:</span>
                    <span style="color: ${COLORS.textDark}; font-weight: bold;">${formatNumber(stats.score)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: ${COLORS.textLight};">Best Score:</span>
                    <span style="color: ${COLORS.gold}; font-weight: bold;">${formatNumber(Math.max(highScore, score))}</span>
                </div>
            </div>
        `;

        const tryAgainBtn = this.createMenuButton('🚀 Try Again', COLORS.mint, onRestart);
        tryAgainBtn.style.margin = '0 auto';
        tryAgainBtn.style.display = 'block';

        container.appendChild(tryAgainBtn);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        this.gameOverScreen = overlay;

        if (this.deps.getSoundEnabled()) {
            this.deps.audioSystem.playMagicSound('happy');
        }
    }

    private celebrateVictory(): void {
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                const el = document.createElement('div');
                el.textContent = Math.random() > 0.5 ? '⭐' : '💖';
                el.style.cssText = `
                    position: fixed;
                    left: ${Math.random() * 100}vw;
                    top: -50px;
                    font-size: ${20 + Math.random() * 20}px;
                    pointer-events: none;
                    z-index: 999;
                    animation: fall ${2 + Math.random() * 2}s linear forwards;
                `;
                document.body.appendChild(el);
                setTimeout(() => el.remove(), 4000);
            }, i * 100);
        }

        if (!document.getElementById('victory-anim')) {
            const style = document.createElement('style');
            style.id = 'victory-anim';
            style.textContent = `
                @keyframes fall {
                    to { transform: translateY(110vh) rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        if (this.deps.getSoundEnabled()) {
            this.deps.audioSystem.playMagicSequence('spell_complete');
        }
    }
}

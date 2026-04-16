/**
 * HUD System for Dog Dash
 * A magical, kid-friendly interface for a 7-year-old girl
 * Pastel colors, hearts, stars, and gentle animations ✨
 */

import { SaveManager } from './save_manager';
import { AudioSystem, getAudioSystem } from './audio_system';

// Power-up types matching the game's powerup system
export type PowerUpType = 
    | 'speed_boost' 
    | 'shield' 
    | 'magnet' 
    | 'double_score' 
    | 'invincible'
    | 'health_restore';

// Game stats for victory/game over screens
export interface GameStats {
    score: number;
    distance: number;
    orbsCollected: number;
    powerUpsUsed: number;
}

// Pastel color palette for kid-friendly UI
const COLORS = {
    pink: '#FFB6C1',
    pinkLight: '#FFD1DC',
    pinkDark: '#FF69B4',
    lavender: '#E6E6FA',
    lavenderDark: '#DDA0DD',
    mint: '#98FB98',
    mintDark: '#90EE90',
    peach: '#FFDAB9',
    sky: '#B0E0E6',
    lemon: '#FFFACD',
    gold: '#FFD700',
    white: '#FFFFFF',
    textDark: '#5D4E6D',
    textLight: '#8B7B8B',
    shadow: 'rgba(147, 112, 219, 0.3)',
    glow: 'rgba(255, 182, 193, 0.6)'
};

// CSS animations for the HUD
const HUD_STYLES = `
<style id="hud-styles">
@keyframes hud-bounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.2); }
}

@keyframes hud-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
}

@keyframes hud-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.9; }
}

@keyframes hud-shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-3px) rotate(-3deg); }
    75% { transform: translateX(3px) rotate(3deg); }
}

@keyframes hud-sparkle {
    0% { transform: scale(0) rotate(0deg); opacity: 1; }
    50% { transform: scale(1) rotate(180deg); opacity: 1; }
    100% { transform: scale(0) rotate(360deg); opacity: 0; }
}

@keyframes hud-twinkle {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
}

@keyframes hud-slide-in {
    from { transform: translateY(-20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

@keyframes hud-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes hud-heart-beat {
    0%, 100% { transform: scale(1); }
    25% { transform: scale(1.1); }
    50% { transform: scale(1); }
    75% { transform: scale(1.15); }
}

@keyframes hud-wiggle {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-5deg); }
    75% { transform: rotate(5deg); }
}

@keyframes hud-star-rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

@keyframes hud-countdown-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(0.9); }
}

.hud-element {
    font-family: 'Segoe UI', 'Comic Sans MS', cursive, sans-serif;
    user-select: none;
    pointer-events: none;
}

.hud-interactive {
    pointer-events: auto;
    cursor: pointer;
}

.hud-interactive:hover {
    transform: scale(1.05);
}

.hud-bounce {
    animation: hud-bounce 0.4s ease-out;
}

.hud-float {
    animation: hud-float 2s ease-in-out infinite;
}

.hud-pulse {
    animation: hud-pulse 1.5s ease-in-out infinite;
}

.hud-shake {
    animation: hud-shake 0.3s ease-in-out;
}

.hud-sparkle {
    animation: hud-sparkle 1s ease-out forwards;
}

.hud-twinkle {
    animation: hud-twinkle 1.5s ease-in-out infinite;
}

.hud-heart-beat {
    animation: hud-heart-beat 1s ease-in-out;
}

.hud-wiggle {
    animation: hud-wiggle 0.5s ease-in-out;
}
</style>
`;

// Power-up icon mapping
const POWER_UP_ICONS: Record<PowerUpType, string> = {
    speed_boost: '⚡',
    shield: '🛡️',
    magnet: '🧲',
    double_score: '✨',
    invincible: '⭐',
    health_restore: '💖'
};

const POWER_UP_NAMES: Record<PowerUpType, string> = {
    speed_boost: 'Speed Boost',
    shield: 'Shield',
    magnet: 'Magnet',
    double_score: 'Double Points',
    invincible: 'Super Star',
    health_restore: 'Heart Heal'
};

/**
 * HUD Manager - Creates and manages the magical game interface
 */
export class HUDManager {
    private saveManager: SaveManager;
    private audioSystem: AudioSystem;
    
    // Current game state
    private score: number = 0;
    private distance: number = 0;
    private highScore: number = 0;
    private currentHealth: number = 3;
    private maxHealth: number = 3;
    
    // UI element references
    private scoreContainer: HTMLDivElement | null = null;
    private scoreValue: HTMLDivElement | null = null;
    private highScoreDisplay: HTMLDivElement | null = null;
    private distanceContainer: HTMLDivElement | null = null;
    private healthContainer: HTMLDivElement | null = null;
    private powerUpContainer: HTMLDivElement | null = null;
    private orbProgressContainer: HTMLDivElement | null = null;
    private pauseMenu: HTMLDivElement | null = null;
    private victoryScreen: HTMLDivElement | null = null;
    private gameOverScreen: HTMLDivElement | null = null;
    
    // Active power-up tracking
    private activePowerUps: Map<PowerUpType, { element: HTMLDivElement; timeout: number }> = new Map();
    
    // Sound enabled
    private soundEnabled: boolean = true;
    
    constructor(saveManager: SaveManager) {
        this.saveManager = saveManager;
        this.audioSystem = getAudioSystem();
        this.highScore = saveManager.getStats().highScore;
        
        this.injectStyles();
        this.createHUDElements();
    }
    
    /**
     * Inject CSS styles into document
     */
    private injectStyles(): void {
        if (!document.getElementById('hud-styles')) {
            document.head.insertAdjacentHTML('beforeend', HUD_STYLES);
        }
    }
    
    /**
     * Create all HUD UI elements
     */
    private createHUDElements(): void {
        this.createScoreDisplay();
        this.createDistanceDisplay();
        this.createHealthDisplay();
        this.createPowerUpDisplay();
        this.createOrbProgressDisplay();
    }
    
    /**
     * Create the pastel score display (top-left)
     */
    private createScoreDisplay(): void {
        // Main container
        this.scoreContainer = document.createElement('div');
        this.scoreContainer.className = 'hud-element';
        this.scoreContainer.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 100;
            display: flex;
            flex-direction: column;
            gap: 5px;
            animation: hud-slide-in 0.5s ease-out;
        `;
        
        // Score label with star
        const label = document.createElement('div');
        label.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            color: ${COLORS.textLight};
            font-weight: 600;
        `;
        label.innerHTML = '⭐ Score';
        
        // Score value with pastel background
        this.scoreValue = document.createElement('div');
        this.scoreValue.className = 'hud-float';
        this.scoreValue.style.cssText = `
            background: linear-gradient(135deg, ${COLORS.pinkLight}, ${COLORS.lavender});
            padding: 10px 20px;
            border-radius: 20px;
            font-size: 28px;
            font-weight: bold;
            color: ${COLORS.textDark};
            box-shadow: 0 4px 15px ${COLORS.shadow}, inset 0 1px 0 rgba(255,255,255,0.5);
            border: 3px solid ${COLORS.white};
            min-width: 120px;
            text-align: center;
            text-shadow: 1px 1px 0 rgba(255,255,255,0.5);
        `;
        this.scoreValue.textContent = '0';
        
        // High score badge
        this.highScoreDisplay = document.createElement('div');
        this.highScoreDisplay.style.cssText = `
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 12px;
            color: ${COLORS.gold};
            font-weight: 600;
            opacity: 0.8;
            margin-top: 2px;
        `;
        this.updateHighScoreDisplay();
        
        this.scoreContainer.appendChild(label);
        this.scoreContainer.appendChild(this.scoreValue);
        this.scoreContainer.appendChild(this.highScoreDisplay);
        document.body.appendChild(this.scoreContainer);
    }
    
    /**
     * Create distance display with rocket icon
     */
    private createDistanceDisplay(): void {
        this.distanceContainer = document.createElement('div');
        this.distanceContainer.className = 'hud-element';
        this.distanceContainer.style.cssText = `
            position: fixed;
            top: 20px;
            left: 180px;
            z-index: 100;
            display: flex;
            flex-direction: column;
            gap: 5px;
            animation: hud-slide-in 0.5s ease-out 0.1s both;
        `;
        
        const label = document.createElement('div');
        label.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            color: ${COLORS.textLight};
            font-weight: 600;
        `;
        label.innerHTML = '🚀 Distance';
        
        const value = document.createElement('div');
        value.id = 'hud-distance-value';
        value.className = 'hud-float';
        value.style.cssText = `
            background: linear-gradient(135deg, ${COLORS.mint}, ${COLORS.sky});
            padding: 10px 20px;
            border-radius: 20px;
            font-size: 22px;
            font-weight: bold;
            color: ${COLORS.textDark};
            box-shadow: 0 4px 15px ${COLORS.shadow}, inset 0 1px 0 rgba(255,255,255,0.5);
            border: 3px solid ${COLORS.white};
            min-width: 100px;
            text-align: center;
            text-shadow: 1px 1px 0 rgba(255,255,255,0.5);
        `;
        value.textContent = '0m';
        
        this.distanceContainer.appendChild(label);
        this.distanceContainer.appendChild(value);
        document.body.appendChild(this.distanceContainer);
    }
    
    /**
     * Create heart container health display (Zelda-style)
     */
    private createHealthDisplay(): void {
        this.healthContainer = document.createElement('div');
        this.healthContainer.className = 'hud-element';
        this.healthContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 100;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 5px;
            animation: hud-slide-in 0.5s ease-out 0.2s both;
        `;
        
        const label = document.createElement('div');
        label.style.cssText = `
            font-size: 14px;
            color: ${COLORS.textLight};
            font-weight: 600;
        `;
        label.textContent = 'Hearts 💕';
        
        const heartsRow = document.createElement('div');
        heartsRow.id = 'hud-hearts-row';
        heartsRow.style.cssText = `
            display: flex;
            gap: 8px;
            background: linear-gradient(135deg, ${COLORS.lavender}, ${COLORS.pinkLight});
            padding: 12px 18px;
            border-radius: 25px;
            box-shadow: 0 4px 15px ${COLORS.shadow}, inset 0 1px 0 rgba(255,255,255,0.5);
            border: 3px solid ${COLORS.white};
        `;
        
        this.healthContainer.appendChild(label);
        this.healthContainer.appendChild(heartsRow);
        document.body.appendChild(this.healthContainer);
        
        this.updateHealthDisplay();
    }
    
    /**
     * Create power-up status display area
     */
    private createPowerUpDisplay(): void {
        this.powerUpContainer = document.createElement('div');
        this.powerUpContainer.className = 'hud-element';
        this.powerUpContainer.id = 'hud-powerups';
        this.powerUpContainer.style.cssText = `
            position: fixed;
            top: 100px;
            left: 20px;
            z-index: 100;
            display: flex;
            flex-direction: column;
            gap: 10px;
            animation: hud-slide-in 0.5s ease-out 0.3s both;
        `;
        
        document.body.appendChild(this.powerUpContainer);
    }
    
    /**
     * Create orb collection progress display
     */
    private createOrbProgressDisplay(): void {
        this.orbProgressContainer = document.createElement('div');
        this.orbProgressContainer.className = 'hud-element';
        this.orbProgressContainer.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 100;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            animation: hud-slide-in 0.5s ease-out 0.4s both;
        `;
        
        const label = document.createElement('div');
        label.style.cssText = `
            font-size: 12px;
            color: ${COLORS.textLight};
            font-weight: 600;
            text-shadow: 0 1px 2px rgba(255,255,255,0.8);
        `;
        label.textContent = 'Next Power-Up';
        
        const progressBar = document.createElement('div');
        progressBar.id = 'hud-orb-progress';
        progressBar.style.cssText = `
            display: flex;
            gap: 5px;
            background: rgba(255,255,255,0.8);
            padding: 10px 15px;
            border-radius: 20px;
            box-shadow: 0 4px 15px ${COLORS.shadow};
            border: 2px solid ${COLORS.white};
        `;
        
        this.orbProgressContainer.appendChild(label);
        this.orbProgressContainer.appendChild(progressBar);
        document.body.appendChild(this.orbProgressContainer);
    }
    
    /**
     * Update the hearts display
     */
    private updateHealthDisplay(): void {
        const heartsRow = document.getElementById('hud-hearts-row');
        if (!heartsRow) return;
        
        heartsRow.innerHTML = '';
        
        for (let i = 0; i < this.maxHealth; i++) {
            const heart = document.createElement('span');
            const isFilled = i < this.currentHealth;
            const isBonus = i >= 3; // Golden hearts for bonus health
            
            heart.style.cssText = `
                font-size: 28px;
                filter: drop-shadow(0 2px 4px ${COLORS.shadow});
                transition: transform 0.2s ease;
                animation: hud-twinkle ${2 + i * 0.3}s ease-in-out infinite;
                animation-delay: ${i * 0.1}s;
            `;
            
            if (isFilled) {
                heart.textContent = isBonus ? '💛' : '💖';
            } else {
                heart.textContent = '🤍';
                heart.style.opacity = '0.4';
            }
            
            heartsRow.appendChild(heart);
        }
    }
    
    /**
     * Update high score display
     */
    private updateHighScoreDisplay(): void {
        if (!this.highScoreDisplay) return;
        
        if (this.highScore > 0) {
            this.highScoreDisplay.innerHTML = `🏆 Best: ${this.formatNumber(this.highScore)}`;
            this.highScoreDisplay.style.display = 'flex';
        } else {
            this.highScoreDisplay.style.display = 'none';
        }
    }
    
    /**
     * Format large numbers with commas
     */
    private formatNumber(num: number): string {
        return num.toLocaleString();
    }
    
    /**
     * Create sparkle effect at position
     */
    private createSparkle(x: number, y: number, color: string = COLORS.gold): void {
        const sparkle = document.createElement('div');
        sparkle.className = 'hud-sparkle';
        sparkle.textContent = '✨';
        sparkle.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            font-size: 24px;
            pointer-events: none;
            z-index: 200;
            filter: drop-shadow(0 0 10px ${color});
        `;
        document.body.appendChild(sparkle);
        
        setTimeout(() => sparkle.remove(), 1000);
    }
    
    /**
     * Check if score is a milestone
     */
    private isMilestone(score: number): boolean {
        const milestones = [100, 500, 1000, 2000, 5000, 10000];
        return milestones.includes(score);
    }
    
    // ==================== PUBLIC API ====================
    
    /**
     * Add points to score with bounce animation
     */
    addScore(points: number): void {
        const oldScore = this.score;
        this.score += points;
        
        if (this.scoreValue) {
            this.scoreValue.textContent = this.formatNumber(this.score);
            this.scoreValue.classList.remove('hud-bounce');
            void this.scoreValue.offsetHeight; // Trigger reflow
            this.scoreValue.classList.add('hud-bounce');
        }
        
        // Milestone celebration
        if (this.isMilestone(this.score)) {
            this.celebrateMilestone();
        }
        
        // Check for new high score
        if (this.score > this.highScore && oldScore <= this.highScore) {
            this.celebrateNewHighScore();
        }
    }
    
    /**
     * Get current score
     */
    getScore(): number {
        return this.score;
    }
    
    /**
     * Add distance traveled
     */
    addDistance(distance: number): void {
        this.distance += distance;
        
        const value = document.getElementById('hud-distance-value');
        if (value) {
            value.textContent = `${Math.floor(this.distance)}m`;
        }
    }
    
    /**
     * Get current distance
     */
    getDistance(): number {
        return this.distance;
    }
    
    /**
     * Update health display with animation
     */
    updateHealth(current: number, max: number): void {
        const oldHealth = this.currentHealth;
        this.currentHealth = Math.max(0, Math.min(current, max));
        this.maxHealth = max;
        
        this.updateHealthDisplay();
        
        // Animation when taking damage
        if (current < oldHealth) {
            if (this.healthContainer) {
                this.healthContainer.classList.remove('hud-shake');
                void this.healthContainer.offsetHeight;
                this.healthContainer.classList.add('hud-shake');
            }
            
            // Play hurt sound
            if (this.soundEnabled) {
                this.audioSystem.play('hit', 0.5);
            }
        } else if (current > oldHealth) {
            // Heart pop for healing
            if (this.healthContainer) {
                this.healthContainer.classList.remove('hud-heart-beat');
                void this.healthContainer.offsetHeight;
                this.healthContainer.classList.add('hud-heart-beat');
            }
            
            if (this.soundEnabled) {
                this.audioSystem.playMagicSound('power');
            }
        }
    }
    
    /**
     * Show power-up icon with countdown
     */
    showPowerUpIcon(type: PowerUpType, duration: number): void {
        // Remove existing if present
        if (this.activePowerUps.has(type)) {
            const existing = this.activePowerUps.get(type)!;
            clearTimeout(existing.timeout);
            existing.element.remove();
        }
        
        // Create power-up element
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
        
        // Create heart/stars for countdown
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
        
        if (this.powerUpContainer) {
            this.powerUpContainer.appendChild(container);
        }
        
        // Play power-up sound
        if (this.soundEnabled) {
            this.audioSystem.playMagicSound('power');
        }
        
        // Auto-remove after duration
        const timeout = window.setTimeout(() => {
            container.style.animation = 'hud-fade-out 0.3s ease-out forwards';
            setTimeout(() => container.remove(), 300);
            this.activePowerUps.delete(type);
        }, duration * 1000);
        
        this.activePowerUps.set(type, { element: container, timeout });
    }
    
    /**
     * Update orb collection progress
     */
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
        
        // Celebration when full
        if (current >= needed && current > 0) {
            this.createSparkle(window.innerWidth / 2, window.innerHeight - 50, COLORS.pinkDark);
            if (this.soundEnabled) {
                this.audioSystem.playMagicSequence('power_up');
            }
        }
    }
    
    /**
     * Update HUD (called every frame)
     * Currently just updates power-up countdowns
     */
    update(delta: number): void {
        // Could add animations here in the future
        // For now, power-up timeouts are handled by setTimeout
    }
    
    /**
     * Show pause menu
     */
    showPauseMenu(onResume: () => void, onRestart: () => void): void {
        if (this.pauseMenu) return;
        
        // Semi-transparent overlay
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
        
        // Menu container
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
        
        // Dog curled up illustration (ASCII art style)
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
            "",
            "    🌙  ⋆  ·  ˚  ✦",
            "      ⋆ ·  Sleepy  · ⋆",
            "   ╭──────────────╮",
            "   │   🐕💤🌸     │",
            "   │  ૮ ˶´ ꒳ ` ˶ ა  │",
            "   │    ( -.- )   │",
            "   ╰────┬────┬────╯",
            "        🎀  🎀",
            ""
        ].join("\n");
        
        // Title
        const title = document.createElement('h2');
        title.style.cssText = `
            margin: 0;
            font-size: 28px;
            color: ${COLORS.textDark};
            text-shadow: 1px 1px 0 rgba(255,255,255,0.5);
        `;
        title.textContent = 'Paused 💤';
        
        // Buttons container
        const buttons = document.createElement('div');
        buttons.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 100%;
            margin-top: 10px;
        `;
        
        // Resume button
        const resumeBtn = this.createMenuButton('▶️ Resume', COLORS.mint, () => {
            this.hidePauseMenu();
            onResume();
        });
        
        // Restart button
        const restartBtn = this.createMenuButton('🔄 Restart', COLORS.peach, () => {
            this.hidePauseMenu();
            onRestart();
        });
        
        // Sound toggle button
        const soundBtn = this.createMenuButton(
            this.soundEnabled ? '🔊 Sound On' : '🔇 Sound Off',
            COLORS.sky,
            () => {
                this.soundEnabled = !this.soundEnabled;
                soundBtn.textContent = this.soundEnabled ? '🔊 Sound On' : '🔇 Sound Off';
                if (this.soundEnabled) {
                    this.audioSystem.setSFXVolume(0.8);
                } else {
                    this.audioSystem.setSFXVolume(0);
                }
            }
        );
        
        buttons.appendChild(resumeBtn);
        buttons.appendChild(restartBtn);
        buttons.appendChild(soundBtn);
        
        this.pauseMenu.appendChild(dogArt);
        this.pauseMenu.appendChild(title);
        this.pauseMenu.appendChild(buttons);
        
        document.body.appendChild(overlay);
        document.body.appendChild(this.pauseMenu);
        
        // Store overlay reference for cleanup
        this.pauseMenu.dataset.overlay = '';
        (this.pauseMenu as any).overlayElement = overlay;
    }
    
    /**
     * Create a styled menu button
     */
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
            if (this.soundEnabled) {
                this.audioSystem.play('ui_click');
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
    
    /**
     * Hide pause menu
     */
    hidePauseMenu(): void {
        if (this.pauseMenu) {
            const overlay = (this.pauseMenu as any).overlayElement;
            if (overlay) overlay.remove();
            this.pauseMenu.remove();
            this.pauseMenu = null;
        }
    }
    
    /**
     * Show victory screen with celebration
     */
    showVictoryScreen(stats: GameStats): void {
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
                    <div style="color: ${COLORS.textDark}; font-weight: bold; text-align: right;">${this.formatNumber(stats.score)}</div>
                    <div style="color: ${COLORS.textLight};">🚀 Distance:</div>
                    <div style="color: ${COLORS.textDark}; font-weight: bold; text-align: right;">${Math.floor(stats.distance)}m</div>
                    <div style="color: ${COLORS.textLight};">🔮 Orbs:</div>
                    <div style="color: ${COLORS.textDark}; font-weight: bold; text-align: right;">${stats.orbsCollected}</div>
                    <div style="color: ${COLORS.textLight};">⚡ Power-ups:</div>
                    <div style="color: ${COLORS.textDark}; font-weight: bold; text-align: right;">${stats.powerUpsUsed}</div>
                </div>
            </div>
        `;
        
        const playAgainBtn = this.createMenuButton('🎮 Play Again', COLORS.mint, () => {
            location.reload();
        });
        playAgainBtn.style.margin = '0 auto';
        playAgainBtn.style.display = 'block';
        
        container.appendChild(playAgainBtn);
        overlay.appendChild(container);
        document.body.appendChild(overlay);
        
        this.victoryScreen = overlay;
    }
    
    /**
     * Show game over screen
     */
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
        
        const isNewHighScore = this.checkAndSaveHighScore();
        
        container.innerHTML = `
            <div style="font-size: 50px; margin-bottom: 10px;">${isNewHighScore ? '🎊✨🎊' : '🌟💫🌟'}</div>
            <h1 style="color: ${COLORS.textDark}; font-size: 32px; margin: 0 0 10px 0;">
                ${isNewHighScore ? 'New High Score!' : 'Good Try!'}
            </h1>
            ${isNewHighScore ? `<p style="color: ${COLORS.gold}; font-size: 20px; font-weight: bold; margin: 0 0 20px 0;">🏆 ${this.formatNumber(this.score)} points! 🏆</p>` : ''}
            <p style="color: ${COLORS.textLight}; font-size: 16px; margin-bottom: 25px;">
                ${isNewHighScore ? 'You\'re a space champion!' : 'The puppy will try again! 🐕'}
            </p>
            <div style="background: rgba(255,255,255,0.6); padding: 15px; border-radius: 15px; margin-bottom: 25px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: ${COLORS.textLight};">Final Score:</span>
                    <span style="color: ${COLORS.textDark}; font-weight: bold;">${this.formatNumber(stats.score)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: ${COLORS.textLight};">Best Score:</span>
                    <span style="color: ${COLORS.gold}; font-weight: bold;">${this.formatNumber(Math.max(this.highScore, this.score))}</span>
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
        
        if (this.soundEnabled) {
            this.audioSystem.playMagicSound('happy');
        }
    }
    
    /**
     * Check and save high score
     */
    checkAndSaveHighScore(): boolean {
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveManager.updateHighScore(this.score);
            this.updateHighScoreDisplay();
            return true;
        }
        return false;
    }
    
    /**
     * Get current high score
     */
    getHighScore(): number {
        return this.highScore;
    }
    
    // ==================== CELEBRATION EFFECTS ====================
    
    /**
     * Celebrate a milestone score
     */
    private celebrateMilestone(): void {
        // Create sparkles around score
        if (this.scoreValue) {
            const rect = this.scoreValue.getBoundingClientRect();
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    const x = rect.left + Math.random() * rect.width;
                    const y = rect.top + Math.random() * rect.height;
                    this.createSparkle(x, y);
                }, i * 100);
            }
        }
        
        if (this.soundEnabled) {
            this.audioSystem.playMagicSequence('star_collect');
        }
    }
    
    /**
     * Celebrate new high score
     */
    private celebrateNewHighScore(): void {
        if (this.scoreValue) {
            this.scoreValue.style.background = `linear-gradient(135deg, ${COLORS.lemon}, ${COLORS.gold})`;
            this.scoreValue.style.animation = 'hud-pulse 0.5s ease-in-out 3';
            
            // Gold sparkles
            const rect = this.scoreValue.getBoundingClientRect();
            for (let i = 0; i < 8; i++) {
                setTimeout(() => {
                    const angle = (i / 8) * Math.PI * 2;
                    const x = rect.left + rect.width / 2 + Math.cos(angle) * 60;
                    const y = rect.top + rect.height / 2 + Math.sin(angle) * 30;
                    this.createSparkle(x, y, COLORS.gold);
                }, i * 50);
            }
        }
        
        if (this.highScoreDisplay) {
            this.highScoreDisplay.innerHTML = '🎉 NEW RECORD! 🎉';
            this.highScoreDisplay.style.fontSize = '14px';
            this.highScoreDisplay.style.animation = 'hud-pulse 1s ease-in-out infinite';
        }
        
        if (this.soundEnabled) {
            this.audioSystem.playMagicSequence('spell_complete');
        }
    }
    
    /**
     * Celebrate victory with confetti effect
     */
    private celebrateVictory(): void {
        const colors = [COLORS.pink, COLORS.lavender, COLORS.mint, COLORS.gold, COLORS.sky];
        
        // Create falling stars/hearts
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
        
        // Add falling animation
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
        
        if (this.soundEnabled) {
            this.audioSystem.playMagicSequence('spell_complete');
        }
    }
    
    /**
     * Reset HUD for new game
     */
    reset(): void {
        this.score = 0;
        this.distance = 0;
        this.currentHealth = 3;
        this.maxHealth = 3;
        
        // Clear active power-ups
        this.activePowerUps.forEach(({ element, timeout }) => {
            clearTimeout(timeout);
            element.remove();
        });
        this.activePowerUps.clear();
        
        // Reset displays
        if (this.scoreValue) {
            this.scoreValue.textContent = '0';
            this.scoreValue.style.background = `linear-gradient(135deg, ${COLORS.pinkLight}, ${COLORS.lavender})`;
        }
        
        const distanceValue = document.getElementById('hud-distance-value');
        if (distanceValue) distanceValue.textContent = '0m';
        
        this.updateHealthDisplay();
        this.updateHighScoreDisplay();
        this.updateOrbProgress(0, 5);
        
        // Remove screens
        if (this.victoryScreen) {
            this.victoryScreen.remove();
            this.victoryScreen = null;
        }
        if (this.gameOverScreen) {
            this.gameOverScreen.remove();
            this.gameOverScreen = null;
        }
    }
    
    /**
     * Clean up HUD elements
     */
    destroy(): void {
        this.activePowerUps.forEach(({ timeout }) => clearTimeout(timeout));
        
        if (this.scoreContainer) this.scoreContainer.remove();
        if (this.distanceContainer) this.distanceContainer.remove();
        if (this.healthContainer) this.healthContainer.remove();
        if (this.powerUpContainer) this.powerUpContainer.remove();
        if (this.orbProgressContainer) this.orbProgressContainer.remove();
        if (this.pauseMenu) this.hidePauseMenu();
        if (this.victoryScreen) this.victoryScreen.remove();
        if (this.gameOverScreen) this.gameOverScreen.remove();
    }
}

// Singleton instance
let hudManager: HUDManager | null = null;

export function getHUDManager(saveManager?: SaveManager): HUDManager {
    if (!hudManager && saveManager) {
        hudManager = new HUDManager(saveManager);
    }
    return hudManager!;
}

export function resetHUDManager(): void {
    if (hudManager) {
        hudManager.destroy();
        hudManager = null;
    }
}

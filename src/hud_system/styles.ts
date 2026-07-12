/**
 * HUD styles, colors, and power-up display constants
 */

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
export const COLORS = {
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
export const HUD_STYLES = `
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

@keyframes sling-surge-pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 16px rgba(200,68,255,0.8), inset 0 1px 0 rgba(255,255,255,0.4); }
    50% { transform: scale(1.1); box-shadow: 0 0 32px rgba(200,68,255,1.0), inset 0 1px 0 rgba(255,255,255,0.4); }
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
export const POWER_UP_ICONS: Record<PowerUpType, string> = {
    speed_boost: '⚡',
    shield: '🛡️',
    magnet: '🧲',
    double_score: '✨',
    invincible: '⭐',
    health_restore: '💖'
};

export const POWER_UP_NAMES: Record<PowerUpType, string> = {
    speed_boost: 'Speed Boost',
    shield: 'Shield',
    magnet: 'Magnet',
    double_score: 'Double Points',
    invincible: 'Super Star',
    health_restore: 'Heart Heal'
};

/**
 * HUD DOM element creation and display helpers
 */

import { LEVEL_DISTANCE_BOUNDARIES } from '../level_config';
import { COLORS, HUD_STYLES } from './styles';

export interface HUDElementRefs {
    scoreContainer: HTMLDivElement | null;
    scoreValue: HTMLDivElement | null;
    highScoreDisplay: HTMLDivElement | null;
    distanceContainer: HTMLDivElement | null;
    healthContainer: HTMLDivElement | null;
    powerUpContainer: HTMLDivElement | null;
    orbProgressContainer: HTMLDivElement | null;
    scanProgressContainer: HTMLDivElement | null;
    journeyMapContainer: HTMLDivElement | null;
    grazeComboDisplay: HTMLDivElement | null;
    slingComboDisplay: HTMLDivElement | null;
    slingComboLabel: HTMLSpanElement | null;
    gravLensMeter: HTMLDivElement | null;
    gravLensAngleBar: HTMLDivElement | null;
    gravLensGrade: HTMLDivElement | null;
    resourcePopDisplay: HTMLDivElement | null;
    lastMaterialLabel: HTMLDivElement | null;
}

export function injectHUDStyles(): void {
    if (!document.getElementById('hud-styles')) {
        document.head.insertAdjacentHTML('beforeend', HUD_STYLES);
    }
}

export function formatNumber(num: number): string {
    return num.toLocaleString();
}

export function createSparkle(x: number, y: number, color: string = COLORS.gold): void {
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

export function updateHealthDisplay(currentHealth: number, maxHealth: number): void {
    const heartsRow = document.getElementById('hud-hearts-row');
    if (!heartsRow) return;

    heartsRow.innerHTML = '';

    for (let i = 0; i < maxHealth; i++) {
        const heart = document.createElement('span');
        const isFilled = i < currentHealth;
        const isBonus = i >= 3;

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

export function updateHighScoreDisplay(
    highScoreDisplay: HTMLDivElement | null,
    highScore: number
): void {
    if (!highScoreDisplay) return;

    if (highScore > 0) {
        highScoreDisplay.innerHTML = `🏆 Best: ${formatNumber(highScore)}`;
        highScoreDisplay.style.display = 'flex';
    } else {
        highScoreDisplay.style.display = 'none';
    }
}

export interface HUDElementsCallbacks {
    updateHighScoreDisplay: () => void;
    updateHealthDisplay: () => void;
}

/**
 * Builds and mounts all persistent HUD DOM elements.
 */
export class HUDElementsBuilder {
    scoreContainer: HTMLDivElement | null = null;
    scoreValue: HTMLDivElement | null = null;
    highScoreDisplay: HTMLDivElement | null = null;
    distanceContainer: HTMLDivElement | null = null;
    healthContainer: HTMLDivElement | null = null;
    powerUpContainer: HTMLDivElement | null = null;
    orbProgressContainer: HTMLDivElement | null = null;
    scanProgressContainer: HTMLDivElement | null = null;
    journeyMapContainer: HTMLDivElement | null = null;
    grazeComboDisplay: HTMLDivElement | null = null;
    slingComboDisplay: HTMLDivElement | null = null;
    slingComboLabel: HTMLSpanElement | null = null;
    gravLensMeter: HTMLDivElement | null = null;
    gravLensAngleBar: HTMLDivElement | null = null;
    gravLensGrade: HTMLDivElement | null = null;
    resourcePopDisplay: HTMLDivElement | null = null;
    lastMaterialLabel: HTMLDivElement | null = null;

    createAll(callbacks: HUDElementsCallbacks): void {
        this.createScoreDisplay(callbacks.updateHighScoreDisplay);
        this.createDistanceDisplay();
        this.createHealthDisplay(callbacks.updateHealthDisplay);
        this.createPowerUpDisplay();
        this.createOrbProgressDisplay();
        this.createScanProgressDisplay();
        this.createGrazeComboDisplay();
        this.createSlingComboDisplay();
        this.createGravLensDisplay();
        this.createResourcePopDisplay();
        this.createJourneyMapDisplay();
    }

    private createScoreDisplay(updateHighScoreDisplay: () => void): void {
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
        updateHighScoreDisplay();

        this.scoreContainer.appendChild(label);
        this.scoreContainer.appendChild(this.scoreValue);
        this.scoreContainer.appendChild(this.highScoreDisplay);
        document.body.appendChild(this.scoreContainer);
    }

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

    private createHealthDisplay(updateHealthDisplay: () => void): void {
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

        updateHealthDisplay();
    }

    private createGrazeComboDisplay(): void {
        this.grazeComboDisplay = document.createElement('div');
        this.grazeComboDisplay.style.cssText = `
            position: fixed;
            top: 100px;
            left: 20px;
            z-index: 100;
            background: linear-gradient(135deg, #00ffff, #0088ff);
            color: white;
            padding: 6px 14px;
            border-radius: 16px;
            font-size: 18px;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,200,255,0.4), inset 0 1px 0 rgba(255,255,255,0.4);
            border: 2px solid white;
            text-shadow: 1px 1px 0 rgba(0,0,0,0.2);
            opacity: 0;
            transform: scale(0.8);
            transition: opacity 0.15s, transform 0.15s;
            pointer-events: none;
        `;
        this.grazeComboDisplay.textContent = '';
        document.body.appendChild(this.grazeComboDisplay);
    }

    private createSlingComboDisplay(): void {
        this.slingComboDisplay = document.createElement('div');
        this.slingComboDisplay.style.cssText = `
            position: fixed;
            top: 140px;
            left: 20px;
            z-index: 100;
            background: linear-gradient(135deg, #aa44ff, #ff8800);
            color: white;
            padding: 6px 14px 6px 10px;
            border-radius: 20px 8px 20px 8px;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 4px 14px rgba(170,68,255,0.5), inset 0 1px 0 rgba(255,255,255,0.4);
            border: 2px solid rgba(255,255,255,0.8);
            text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
            opacity: 0;
            transform: scale(0.8);
            transition: opacity 0.15s, transform 0.15s;
            pointer-events: none;
            display: flex;
            align-items: center;
            gap: 6px;
        `;

        const icon = document.createElement('span');
        icon.textContent = '⚡';
        icon.style.fontSize = '14px';

        this.slingComboLabel = document.createElement('span');
        this.slingComboLabel.textContent = '';

        this.slingComboDisplay.appendChild(icon);
        this.slingComboDisplay.appendChild(this.slingComboLabel);
        document.body.appendChild(this.slingComboDisplay);
    }

    private createGravLensDisplay(): void {
        this.gravLensMeter = document.createElement('div');
        this.gravLensMeter.style.cssText = `
            position: fixed;
            top: 50%;
            right: 24px;
            transform: translateY(-50%);
            z-index: 100;
            width: 18px;
            height: 160px;
            background: rgba(10, 5, 30, 0.65);
            border-radius: 12px;
            border: 2px solid rgba(170, 100, 255, 0.5);
            box-shadow: 0 0 16px rgba(100, 60, 200, 0.35);
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: none;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
        `;

        const label = document.createElement('div');
        label.textContent = '∠';
        label.style.cssText = `
            position: absolute;
            top: 6px;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 11px;
            color: #cc99ff;
            font-weight: bold;
        `;
        this.gravLensMeter.appendChild(label);

        this.gravLensAngleBar = document.createElement('div');
        this.gravLensAngleBar.style.cssText = `
            width: 100%;
            height: 0%;
            background: linear-gradient(0deg, #ff2244 0%, #ffaa00 45%, #44ffcc 100%);
            border-radius: 0 0 10px 10px;
            transition: height 0.08s linear;
        `;
        this.gravLensMeter.appendChild(this.gravLensAngleBar);
        document.body.appendChild(this.gravLensMeter);

        this.gravLensGrade = document.createElement('div');
        this.gravLensGrade.style.cssText = `
            position: fixed;
            top: calc(50% + 95px);
            right: 8px;
            z-index: 101;
            min-width: 90px;
            text-align: center;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: bold;
            color: white;
            text-shadow: 0 1px 3px rgba(0,0,0,0.5);
            opacity: 0;
            transform: scale(0.85);
            transition: opacity 0.15s, transform 0.15s;
            pointer-events: none;
        `;
        document.body.appendChild(this.gravLensGrade);
    }

    /** Last-collected craft material + floating Resource Pop juice target. */
    private createResourcePopDisplay(): void {
        this.lastMaterialLabel = document.createElement('div');
        this.lastMaterialLabel.id = 'hud-last-material';
        this.lastMaterialLabel.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 110;
            min-width: 160px;
            text-align: center;
            padding: 8px 18px;
            border-radius: 18px;
            font-size: 15px;
            font-weight: bold;
            color: ${COLORS.textDark};
            background: linear-gradient(135deg, ${COLORS.lemon}, ${COLORS.mint});
            box-shadow: 0 4px 16px ${COLORS.shadow}, inset 0 1px 0 rgba(255,255,255,0.55);
            border: 3px solid ${COLORS.white};
            opacity: 0;
            pointer-events: none;
            text-shadow: 0 1px 0 rgba(255,255,255,0.5);
        `;
        this.lastMaterialLabel.textContent = '';
        document.body.appendChild(this.lastMaterialLabel);

        this.resourcePopDisplay = document.createElement('div');
        this.resourcePopDisplay.id = 'hud-resource-pop';
        this.resourcePopDisplay.style.cssText = `
            position: fixed;
            top: 28%;
            left: 50%;
            transform: translate(-50%, 0) scale(1);
            z-index: 120;
            font-size: 28px;
            font-weight: bold;
            color: ${COLORS.gold};
            text-shadow: 0 0 12px rgba(0,0,0,0.45), 0 2px 0 rgba(255,255,255,0.35);
            opacity: 0;
            pointer-events: none;
            white-space: nowrap;
        `;
        this.resourcePopDisplay.textContent = '';
        document.body.appendChild(this.resourcePopDisplay);
    }

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

    private createScanProgressDisplay(): void {
        this.scanProgressContainer = document.createElement('div');
        this.scanProgressContainer.className = 'hud-element';
        this.scanProgressContainer.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            z-index: 100;
            display: none;
            flex-direction: column;
            align-items: flex-end;
            gap: 5px;
            animation: hud-slide-in 0.5s ease-out 0.1s both;
        `;

        const label = document.createElement('div');
        label.id = 'hud-scan-label';
        label.style.cssText = `
            font-size: 14px;
            color: ${COLORS.textLight};
            font-weight: 600;
            text-shadow: 0 1px 2px rgba(255,255,255,0.8);
            max-width: 220px;
            text-align: right;
        `;
        label.textContent = '🔍 Catalog';

        const value = document.createElement('div');
        value.id = 'hud-scan-value';
        value.className = 'hud-float';
        value.style.cssText = `
            background: linear-gradient(135deg, ${COLORS.mint}, ${COLORS.lavender});
            padding: 8px 18px;
            border-radius: 20px;
            font-size: 18px;
            font-weight: bold;
            color: ${COLORS.textDark};
            box-shadow: 0 4px 15px ${COLORS.shadow}, inset 0 1px 0 rgba(255,255,255,0.5);
            border: 3px solid ${COLORS.white};
            min-width: 70px;
            text-align: center;
            text-shadow: 1px 1px 0 rgba(255,255,255,0.5);
        `;
        value.textContent = '0/0';

        this.scanProgressContainer.appendChild(label);
        this.scanProgressContainer.appendChild(value);
        document.body.appendChild(this.scanProgressContainer);
    }

    private createJourneyMapDisplay(): void {
        this.journeyMapContainer = document.createElement('div');
        this.journeyMapContainer.className = 'hud-element';
        this.journeyMapContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 100;
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 260px;
            background: rgba(255, 255, 255, 0.75);
            padding: 8px 18px;
            border-radius: 20px;
            box-shadow: 0 4px 15px ${COLORS.shadow};
            border: 2px solid ${COLORS.white};
            animation: hud-slide-in 0.5s ease-out 0.5s both;
        `;

        const earth = document.createElement('div');
        earth.textContent = '🌍';
        earth.style.fontSize = '18px';

        const track = document.createElement('div');
        track.id = 'hud-journey-track';
        track.style.cssText = `
            position: relative;
            flex: 1;
            height: 6px;
            background: ${COLORS.lavender};
            border-radius: 3px;
        `;

        const fill = document.createElement('div');
        fill.id = 'hud-journey-fill';
        fill.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, ${COLORS.mint}, ${COLORS.gold});
            border-radius: 3px;
            transition: width 0.3s ease-out;
        `;
        track.appendChild(fill);

        const total = LEVEL_DISTANCE_BOUNDARIES[LEVEL_DISTANCE_BOUNDARIES.length - 1];
        for (let i = 1; i < LEVEL_DISTANCE_BOUNDARIES.length - 1; i++) {
            const tick = document.createElement('div');
            tick.style.cssText = `
                position: absolute;
                left: ${(LEVEL_DISTANCE_BOUNDARIES[i] / total) * 100}%;
                top: -3px;
                width: 2px;
                height: 12px;
                background: ${COLORS.lavenderDark};
                border-radius: 1px;
            `;
            track.appendChild(tick);
        }

        const rocket = document.createElement('div');
        rocket.id = 'hud-journey-rocket';
        rocket.textContent = '🚀';
        rocket.style.cssText = `
            position: absolute;
            left: 0%;
            top: 50%;
            transform: translate(-50%, -50%) rotate(90deg);
            font-size: 16px;
            transition: left 0.3s ease-out;
            filter: drop-shadow(0 0 4px rgba(255,255,255,0.9));
        `;
        track.appendChild(rocket);

        const moon = document.createElement('div');
        moon.textContent = '🌕';
        moon.style.fontSize = '18px';

        const label = document.createElement('div');
        label.id = 'hud-journey-label';
        label.style.cssText = `
            font-size: 12px;
            color: ${COLORS.textLight};
            font-weight: 600;
            white-space: nowrap;
        `;
        label.textContent = 'Lvl 1/6';

        this.journeyMapContainer.appendChild(earth);
        this.journeyMapContainer.appendChild(track);
        this.journeyMapContainer.appendChild(moon);
        this.journeyMapContainer.appendChild(label);
        document.body.appendChild(this.journeyMapContainer);
    }
}

import type { HeatSystem } from './upgrade_system';
import type { BoostSystem } from './boost_system';
import type { RollSystem } from './roll_system';
import type { getSaveManager } from './save_manager';
import type { playerState } from './game_config';

// Heat Bar UI
export function createHeatBar() {
    const heatDiv = document.createElement('div');
    heatDiv.id = 'heat-display';
    heatDiv.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 20px;
        width: 200px;
        height: 20px;
        background: rgba(0,0,0,0.5);
        border: 2px solid #666;
        border-radius: 10px;
        overflow: hidden;
        z-index: 100;
    `;
    
    const heatFill = document.createElement('div');
    heatFill.id = 'heat-fill';
    heatFill.style.cssText = `
        width: 0%;
        height: 100%;
        background: linear-gradient(90deg, #ff8800, #ff0000);
        transition: width 0.1s, background 0.3s;
    `;
    
    heatDiv.appendChild(heatFill);
    document.body.appendChild(heatDiv);
    
    const heatText = document.createElement('div');
    heatText.id = 'heat-text';
    heatText.style.cssText = `
        position: absolute;
        bottom: 42px;
        left: 20px;
        color: #ff8800;
        font-family: 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: bold;
        text-shadow: 0 0 5px rgba(255,136,0,0.5);
        z-index: 100;
    `;
    heatText.textContent = 'HEAT';
    document.body.appendChild(heatText);
}

export function updateHeatBar(heatSystem: HeatSystem) {
    const fill = document.getElementById('heat-fill');
    const text = document.getElementById('heat-text');
    if (!fill || !text) return;
    
    const percent = heatSystem.getHeatPercent() * 100;
    fill.style.width = `${percent}%`;
    
    if (heatSystem.overheated) {
        fill.style.background = '#ff0000';
        text.textContent = 'OVERHEATED!';
        text.style.color = '#ff0000';
        text.style.animation = 'pulse 0.5s infinite';
    } else if (percent > 80) {
        fill.style.background = 'linear-gradient(90deg, #ff4400, #ff0000)';
        text.textContent = 'HEAT (CRITICAL)';
        text.style.color = '#ff4400';
    } else {
        fill.style.background = 'linear-gradient(90deg, #ff8800, #ff0000)';
        text.textContent = 'HEAT';
        text.style.color = '#ff8800';
        text.style.animation = 'none';
    }
}

// Boost Charges Display UI
export function createBoostDisplay() {
    const boostDiv = document.createElement('div');
    boostDiv.id = 'boost-display';
    boostDiv.style.cssText = `
        position: absolute;
        bottom: 70px;
        right: 20px;
        display: flex;
        gap: 6px;
        align-items: center;
        z-index: 100;
        font-family: 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: bold;
        color: #ffaa44;
        text-shadow: 0 0 8px rgba(255,170,68,0.6);
    `;
    
    const label = document.createElement('span');
    label.textContent = 'BOOST';
    label.style.marginRight = '4px';
    boostDiv.appendChild(label);
    
    for (let i = 0; i < 3; i++) {
        const icon = document.createElement('span');
        icon.id = `boost-charge-${i}`;
        icon.textContent = '🔥';
        icon.style.cssText = `
            font-size: 18px;
            opacity: 0.3;
            transition: opacity 0.3s, transform 0.3s;
            filter: grayscale(0.8);
        `;
        boostDiv.appendChild(icon);
    }
    
    document.body.appendChild(boostDiv);
}

export function updateBoostDisplay(boostSystem: BoostSystem) {
    const maxCharges = boostSystem.getMaxCharges();
    const charges = boostSystem.getCharges();
    const isCooldown = boostSystem.getCooldownRatio() > 0;
    
    for (let i = 0; i < maxCharges; i++) {
        const icon = document.getElementById(`boost-charge-${i}`);
        if (!icon) continue;
        
        if (i < charges) {
            icon.style.opacity = '1';
            icon.style.transform = 'scale(1.2)';
            icon.style.filter = 'grayscale(0) drop-shadow(0 0 6px #ff6600)';
        } else if (i === charges && isCooldown) {
            // Recharging: pulse
            icon.style.opacity = String(0.3 + boostSystem.getCooldownRatio() * 0.5);
            icon.style.transform = 'scale(1.0)';
            icon.style.filter = 'grayscale(0.5)';
        } else {
            icon.style.opacity = '0.3';
            icon.style.transform = 'scale(1.0)';
            icon.style.filter = 'grayscale(0.8)';
        }
    }
}

// Roll Display UI
export function createRollDisplay() {
    const rollDiv = document.createElement('div');
    rollDiv.id = 'roll-display';
    rollDiv.style.cssText = `
        position: absolute;
        bottom: 70px;
        right: 120px;
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 100;
        font-family: 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: bold;
        color: #00ccff;
        text-shadow: 0 0 8px rgba(0,204,255,0.6);
    `;

    const label = document.createElement('span');
    label.textContent = 'ROLL';
    rollDiv.appendChild(label);

    // Circular cooldown indicator
    const circle = document.createElement('div');
    circle.id = 'roll-cooldown';
    circle.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid rgba(0,204,255,0.4);
        background: conic-gradient(#00ccff 0%, #00ccff 0%, transparent 0%);
        transition: transform 0.1s;
    `;
    rollDiv.appendChild(circle);

    // Ready indicator dot
    const dot = document.createElement('div');
    dot.id = 'roll-ready';
    dot.style.cssText = `
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #00ccff;
        box-shadow: 0 0 6px #00ccff;
        opacity: 1;
        transition: opacity 0.3s;
    `;
    rollDiv.appendChild(dot);

    document.body.appendChild(rollDiv);
}

export function updateRollDisplay(rollSystem: RollSystem) {
    const circle = document.getElementById('roll-cooldown');
    const dot = document.getElementById('roll-ready');
    if (!circle || !dot) return;

    const cooldownRatio = rollSystem.getCooldownRatio();
    const canRoll = rollSystem.canRoll();
    const isRolling = rollSystem.isRolling();

    if (isRolling) {
        circle.style.background = 'conic-gradient(#00ccff 100%, transparent 100%)';
        circle.style.transform = 'scale(1.3)';
        dot.style.opacity = '0';
    } else if (canRoll) {
        circle.style.background = 'conic-gradient(#00ccff 100%, transparent 100%)';
        circle.style.transform = 'scale(1.0)';
        dot.style.opacity = '1';
    } else {
        const percent = Math.floor(cooldownRatio * 100);
        circle.style.background = `conic-gradient(#00ccff ${percent}%, transparent ${percent}%)`;
        circle.style.transform = 'scale(1.0)';
        dot.style.opacity = '0.3';
    }
}

export function showRollPopup() {
    const popup = document.createElement('div');
    popup.textContent = 'ROLL!';
    popup.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-family: 'Segoe UI', sans-serif;
        font-size: 48px;
        font-weight: bold;
        color: #00ccff;
        text-shadow: 0 0 20px rgba(0,204,255,0.8);
        z-index: 200;
        pointer-events: none;
        animation: rollPopup 0.6s ease-out forwards;
    `;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 600);
}

// Cores Display UI
export function createCoresDisplay(saveManager: ReturnType<typeof getSaveManager>) {
    const coresDiv = document.createElement('div');
    coresDiv.id = 'cores-display';
    coresDiv.style.cssText = `
        position: absolute;
        top: 100px;
        left: 20px;
        color: #00ffff;
        font-family: 'Segoe UI', sans-serif;
        font-size: 18px;
        font-weight: bold;
        text-shadow: 0 0 10px rgba(0,255,255,0.5);
        z-index: 100;
    `;
    coresDiv.innerHTML = `🔷 Cores: <span id="cores-count">0</span> | Total: <span id="cores-total">${saveManager.getCores()}</span>`;
    document.body.appendChild(coresDiv);
}

export function updateCoresDisplay(ps: typeof playerState) {
    const count = document.getElementById('cores-count');
    if (count) count.textContent = ps.cores.toString();
}

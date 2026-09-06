import { game } from '../game_runtime';

// Grenade ammo counter (crafted Glitch Grenades) — tap the pill to throw.
export function createGrenadeDisplay(onTap: () => void) {
    const div = document.createElement('div');
    div.id = 'grenade-display';
    div.style.cssText = `
        position: absolute;
        bottom: 130px;
        right: 20px;
        z-index: 100;
        font-family: 'Segoe UI', sans-serif;
        font-size: 16px;
        font-weight: bold;
        color: #ff88ff;
        text-shadow: 0 0 8px rgba(255,136,255,0.6);
        background: rgba(0,0,0,0.35);
        border: 2px solid rgba(255,136,255,0.5);
        border-radius: 14px;
        padding: 8px 12px;
        cursor: pointer;
        touch-action: manipulation;
        user-select: none;
        display: none;
    `;
    div.addEventListener('click', onTap);
    document.body.appendChild(div);
    updateGrenadeDisplay();
}

export function updateGrenadeDisplay() {
    const div = document.getElementById('grenade-display');
    if (!div) return;
    const ammo = game.grenadeAmmo;
    div.style.display = ammo > 0 ? 'block' : 'none';
    div.textContent = `💥 ×${ammo}`;
    div.style.opacity = ammo > 0 ? '1' : '0.5';
}

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

export function updateHeatBar() {
    const fill = document.getElementById('heat-fill');
    const text = document.getElementById('heat-text');
    if (!fill || !text) return;
    
    const percent = game.heatSystem.getHeatPercent() * 100;
    fill.style.width = `${percent}%`;
    
    if (game.heatSystem.overheated) {
        fill.style.background = '#ff0000';
        text.textContent = 'OVERHEATED!';
        text.style.color = '#ff0000';
        text.classList.add('hud-danger-pulse');
        text.style.animation = ''; // Clear inline animation
    } else if (percent > 80) {
        fill.style.background = 'linear-gradient(90deg, #ff4400, #ff0000)';
        text.textContent = 'HEAT (CRITICAL)';
        text.style.color = '#ff4400';
        text.classList.remove('hud-danger-pulse');
    } else {
        fill.style.background = 'linear-gradient(90deg, #ff8800, #ff0000)';
        text.textContent = 'HEAT';
        text.style.color = '#ff8800';
        text.style.animation = 'none';
        text.classList.remove('hud-danger-pulse');
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

export function updateBoostDisplay() {
    const maxCharges = game.boostSystem.getMaxCharges();
    const charges = game.boostSystem.getCharges();
    const isCooldown = game.boostSystem.getCooldownRatio() > 0;
    
    for (let i = 0; i < maxCharges; i++) {
        const icon = document.getElementById(`boost-charge-${i}`);
        if (!icon) continue;
        
        icon.classList.remove('hud-danger-pulse');
        if (i < charges) {
            icon.style.opacity = '1';
            icon.style.transform = 'scale(1.2)';
            icon.style.filter = 'grayscale(0) drop-shadow(0 0 6px #ff6600)';
        } else if (i === charges && isCooldown) {
            // Recharging: pulse
            icon.style.opacity = String(0.3 + game.boostSystem.getCooldownRatio() * 0.5);
            icon.style.transform = 'scale(1.0)';
            icon.style.filter = 'grayscale(0.5)';
        } else {
            icon.style.opacity = '0.3';
            icon.style.transform = 'scale(1.0)';
            icon.style.filter = 'grayscale(0.8)';
            if (charges === 0 && !isCooldown) {
                icon.classList.add('hud-danger-pulse');
            }
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

export function updateRollDisplay() {
    const circle = document.getElementById('roll-cooldown');
    const dot = document.getElementById('roll-ready');
    if (!circle || !dot) return;

    const cooldownRatio = game.rollSystem.getCooldownRatio();
    const canRoll = game.rollSystem.canRoll();
    const isRolling = game.rollSystem.isRolling();

    if (isRolling) {
        circle.style.background = 'conic-gradient(#00ccff 100%, transparent 100%)';
        circle.style.transform = 'scale(1.3)';
        dot.style.opacity = '0';
        dot.classList.remove('hud-glow');
    } else if (canRoll) {
        circle.style.background = 'conic-gradient(#00ccff 100%, transparent 100%)';
        circle.style.transform = 'scale(1.0)';
        dot.style.opacity = '1';
        dot.classList.add('hud-glow');
    } else {
        const percent = Math.floor(cooldownRatio * 100);
        circle.style.background = `conic-gradient(#00ccff ${percent}%, transparent ${percent}%)`;
        circle.style.transform = 'scale(1.0)';
        dot.style.opacity = '0.3';
        dot.classList.remove('hud-glow');
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

// Bark Blast display (companion ability)
export function createBarkDisplay() {
    const barkDiv = document.createElement('div');
    barkDiv.id = 'bark-display';
    barkDiv.style.cssText = `
        position: absolute;
        bottom: 70px;
        right: 320px;
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 100;
        font-family: 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: bold;
        color: #ffcc88;
        text-shadow: 0 0 8px rgba(255,204,136,0.6);
    `;

    const label = document.createElement('span');
    label.textContent = 'BARK [B]';
    barkDiv.appendChild(label);

    for (let i = 0; i < 2; i++) {
        const icon = document.createElement('span');
        icon.id = `bark-charge-${i}`;
        icon.textContent = '🐕';
        icon.style.cssText = `
            font-size: 16px;
            opacity: 0.3;
            transition: opacity 0.3s, transform 0.3s;
            filter: grayscale(0.8);
        `;
        barkDiv.appendChild(icon);
    }

    document.body.appendChild(barkDiv);
}

export function updateBarkDisplay() {
    const maxCharges = game.barkBlastSystem.getMaxCharges();
    const charges = game.barkBlastSystem.getCharges();
    const canBark = game.barkBlastSystem.canBark();
    const cooldownRatio = game.barkBlastSystem.getCooldownRatio();

    for (let i = 0; i < maxCharges; i++) {
        const icon = document.getElementById(`bark-charge-${i}`);
        if (!icon) continue;

        icon.classList.remove('hud-glow');
        if (i < charges) {
            icon.style.opacity = '1';
            icon.style.transform = 'scale(1.15)';
            icon.style.filter = 'grayscale(0) drop-shadow(0 0 6px #ffcc88)';
            if (canBark) {
                icon.classList.add('hud-glow');
            }
        } else if (canBark && charges === 0) {
            icon.style.opacity = String(0.5 + (1 - cooldownRatio) * 0.3);
            icon.style.transform = 'scale(1.0)';
            icon.style.filter = 'grayscale(0.3)';
        } else {
            icon.style.opacity = '0.25';
            icon.style.transform = 'scale(1.0)';
            icon.style.filter = 'grayscale(0.9)';
        }
    }
}

export function createTetherDisplay() {
    const tetherDiv = document.createElement('div');
    tetherDiv.id = 'tether-display';
    tetherDiv.style.cssText = `
        position: absolute;
        bottom: 70px;
        right: 220px;
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 100;
        font-family: 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: bold;
        color: #00ffcc;
        text-shadow: 0 0 8px rgba(0,255,204,0.6);
    `;

    const label = document.createElement('span');
    label.textContent = 'TETHER [T]';
    tetherDiv.appendChild(label);

    const circle = document.createElement('div');
    circle.id = 'tether-cooldown';
    circle.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid rgba(0,255,204,0.4);
        background: conic-gradient(#00ffcc 100%, transparent 100%);
        transition: transform 0.1s;
    `;
    tetherDiv.appendChild(circle);

    const dot = document.createElement('div');
    dot.id = 'tether-ready';
    dot.style.cssText = `
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #00ffcc;
        box-shadow: 0 0 6px #00ffcc;
        opacity: 1;
        transition: opacity 0.3s;
    `;
    tetherDiv.appendChild(dot);

    document.body.appendChild(tetherDiv);
}

export function updateTetherDisplay() {
    const circle = document.getElementById('tether-cooldown');
    const dot = document.getElementById('tether-ready');
    if (!circle || !dot) return;

    const cooldownRatio = game.tetherSystem.getCooldownRatio();
    const isLatched = game.tetherSystem.isLatched();
    const canTether = game.tetherSystem.canTether();

    if (isLatched) {
        circle.style.background = 'conic-gradient(#00ffcc 100%, transparent 100%)';
        circle.style.transform = 'scale(1.3)';
        circle.style.borderColor = '#00ffcc';
        dot.style.opacity = '0';
        dot.classList.remove('hud-glow');
    } else if (canTether) {
        circle.style.background = 'conic-gradient(#00ffcc 100%, transparent 100%)';
        circle.style.transform = 'scale(1.0)';
        circle.style.borderColor = 'rgba(0,255,204,0.4)';
        dot.style.opacity = '1';
        dot.classList.add('hud-glow');
    } else {
        const percent = Math.floor(cooldownRatio * 100);
        circle.style.background = `conic-gradient(#00ffcc ${percent}%, transparent ${percent}%)`;
        circle.style.transform = 'scale(1.0)';
        circle.style.borderColor = 'rgba(0,255,204,0.4)';
        dot.style.opacity = '0.3';
        dot.classList.remove('hud-glow');
    }
}

// Cores Display UI
export function createCoresDisplay() {
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
    coresDiv.innerHTML = `🔷 Cores: <span id="cores-count">0</span> | Total: <span id="cores-total">${game.saveManager.getCores()}</span>`;
    document.body.appendChild(coresDiv);
}

export function updateCoresDisplay() {
    const count = document.getElementById('cores-count');
    if (count) count.textContent = game.playerState.cores.toString();
}

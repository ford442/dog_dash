import * as THREE from 'three';
import { ShakeType, TEXT_COLORS, type FloatingText } from './shared';

/** Host hook for combo text shake. */
export interface FloatingTextJuiceHost {
    shakeScreen(type: ShakeType, duration?: number): void;
}

/** World-space floating score / combo / resource text. */
export class FloatingTextController {
    private camera: THREE.Camera;
    private host: FloatingTextJuiceHost;
    private textContainer: HTMLDivElement;
    private floatingTexts: FloatingText[] = [];
    private maxFloatingTexts: number = 20;
    private enableFloatingText: boolean = true;

    constructor(camera: THREE.Camera, host: FloatingTextJuiceHost) {
        this.camera = camera;
        this.host = host;

        this.textContainer = document.createElement('div');
        this.textContainer.id = 'juice-text-container';
        this.textContainer.style.position = 'absolute';
        this.textContainer.style.top = '0';
        this.textContainer.style.left = '0';
        this.textContainer.style.width = '100%';
        this.textContainer.style.height = '100%';
        this.textContainer.style.pointerEvents = 'none';
        this.textContainer.style.zIndex = '500';
        this.textContainer.style.overflow = 'hidden';
        document.body.appendChild(this.textContainer);
    }

    showFloatingText(
        text: string,
        position: THREE.Vector3,
        color: string = 'gold',
        size: number = 24
    ): void {
        if (!this.enableFloatingText) return;

        if (this.floatingTexts.length >= this.maxFloatingTexts) {
            const oldest = this.floatingTexts.shift();
            if (oldest) {
                oldest.element.remove();
            }
        }

        const element = document.createElement('div');
        element.textContent = text;
        element.style.position = 'absolute';
        element.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
        element.style.fontSize = `${size}px`;
        element.style.fontWeight = 'bold';
        element.style.pointerEvents = 'none';
        element.style.textShadow = '0 0 10px rgba(0,0,0,0.5)';
        element.style.whiteSpace = 'nowrap';
        element.style.userSelect = 'none';

        const colorValue = TEXT_COLORS[color as keyof typeof TEXT_COLORS] ?? color;
        if (color === 'rainbow') {
            element.style.background = colorValue;
            element.style.webkitBackgroundClip = 'text';
            element.style.webkitTextFillColor = 'transparent';
            element.style.backgroundClip = 'text';
        } else {
            element.style.color = colorValue;
        }

        this.textContainer.appendChild(element);

        const floatingText: FloatingText = {
            element,
            position: position.clone(),
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                3 + Math.random() * 2,
                0
            ),
            life: 1.5,
            maxLife: 1.5,
            scale: 1,
            bounces: 0,
            baseY: position.y
        };

        this.floatingTexts.push(floatingText);
        this.updateFloatingTextPosition(floatingText);
    }

    showScoreText(score: number, position: THREE.Vector3): void {
        const text = score > 0 ? `+${score}` : `${score}`;
        const size = score >= 50 ? 32 : 24;
        this.showFloatingText(text, position, 'gold', size);
    }

    showComboText(combo: number, position: THREE.Vector3): void {
        const combos: Record<number, { text: string; color: string; size: number }> = {
            5: { text: 'NICE!', color: 'green', size: 28 },
            10: { text: 'GREAT!', color: 'blue', size: 32 },
            15: { text: 'AWESOME!', color: 'purple', size: 36 },
            20: { text: 'WOW!', color: 'pink', size: 40 },
            30: { text: 'AMAZING!', color: 'rainbow', size: 48 },
            50: { text: 'INCREDIBLE!', color: 'rainbow', size: 56 }
        };

        const comboData = combos[combo];
        if (comboData) {
            this.showFloatingText(comboData.text, position, comboData.color, comboData.size);
            this.host.shakeScreen(ShakeType.LIGHT, 0.2);
        }
    }

    showHealthChange(amount: number, position: THREE.Vector3): void {
        const text = amount > 0 ? `+${amount} ❤️` : `${amount} 💔`;
        const color = amount > 0 ? 'pink' : 'red';
        this.showFloatingText(text, position, color, 28);
    }

    showResourcePop(
        materialName: string,
        amount: number,
        position: THREE.Vector3,
        color: string = 'gold'
    ): void {
        if (!this.enableFloatingText) return;

        const label = amount > 1 ? `+${amount} ${materialName}` : materialName;

        if (this.floatingTexts.length >= this.maxFloatingTexts) {
            const oldest = this.floatingTexts.shift();
            if (oldest) oldest.element.remove();
        }

        const element = document.createElement('div');
        element.textContent = label;
        element.style.position = 'absolute';
        element.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
        element.style.fontSize = '26px';
        element.style.fontWeight = 'bold';
        element.style.pointerEvents = 'none';
        element.style.textShadow = '0 0 12px rgba(0,0,0,0.55)';
        element.style.whiteSpace = 'nowrap';
        element.style.userSelect = 'none';

        const colorValue = TEXT_COLORS[color as keyof typeof TEXT_COLORS] ?? color;
        element.style.color = colorValue;

        this.textContainer.appendChild(element);

        const floatingText: FloatingText = {
            element,
            position: position.clone(),
            velocity: new THREE.Vector3(0, 4.5, 0),
            life: 1.4,
            maxLife: 1.4,
            scale: 1,
            bounces: 99,
            baseY: position.y - 100,
            resourcePop: true
        };

        this.floatingTexts.push(floatingText);
        this.updateFloatingTextPosition(floatingText);
    }

    update(dt: number): void {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const text = this.floatingTexts[i];
            text.life -= dt;

            if (text.life <= 0) {
                text.element.remove();
                this.floatingTexts.splice(i, 1);
                continue;
            }

            const lifeRatio = text.life / text.maxLife;
            const elapsed = 1 - lifeRatio;

            if (text.resourcePop) {
                text.velocity.y = 4.5;
                text.position.add(text.velocity.clone().multiplyScalar(dt));
                if (elapsed < 0.25) {
                    text.scale = 1 + (elapsed / 0.25) * 0.5;
                } else {
                    const t = (elapsed - 0.25) / 0.75;
                    text.scale = 1.5 - t * 0.7;
                }
                const rotation = elapsed * 360;
                text.element.style.opacity = String(Math.min(1, lifeRatio * 2.2));
                text.element.style.transform = `translate(-50%, -50%) scale(${text.scale}) rotate(${rotation}deg)`;
                this.updateFloatingTextPosition(text, true);
                continue;
            }

            text.velocity.y -= 4.0 * dt;
            text.position.add(text.velocity.clone().multiplyScalar(dt));

            if (text.position.y < text.baseY && text.bounces < 2) {
                text.position.y = text.baseY;
                text.velocity.y = Math.abs(text.velocity.y) * 0.5;
                text.velocity.x *= 0.8;
                text.bounces++;
            }

            if (lifeRatio > 0.8) {
                text.scale = 1 + (1 - lifeRatio) * 2;
            } else {
                text.scale = 0.8 + lifeRatio * 0.2;
            }

            text.element.style.opacity = String(Math.min(1, lifeRatio * 2));
            text.element.style.transform = `scale(${text.scale})`;

            this.updateFloatingTextPosition(text);
        }
    }

    private updateFloatingTextPosition(text: FloatingText, skipTransform = false): void {
        const screenPos = text.position.clone().project(this.camera);

        const x = (screenPos.x * 0.5 + 0.5) * 100;
        const y = (-screenPos.y * 0.5 + 0.5) * 100;

        text.element.style.left = `${x}%`;
        text.element.style.top = `${y}%`;
        if (!skipTransform) {
            text.element.style.transform = `translate(-50%, -50%) scale(${text.scale})`;
        }
    }

    setEnabled(enabled: boolean): void {
        this.enableFloatingText = enabled;
    }

    reset(): void {
        for (const text of this.floatingTexts) {
            text.element.remove();
        }
        this.floatingTexts = [];
    }

    dispose(): void {
        this.reset();
        this.textContainer.remove();
    }
}

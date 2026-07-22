import * as THREE from 'three';
import type { ChromaticFlash, WhiteFlash } from './shared';

/** Chromatic / white / red / rainbow screen flashes + grav-lens distortion. */
export class FlashEffectsController {
    private chromaticElement: HTMLDivElement;
    private distortionElement: HTMLDivElement;
    private chromaticFlash: ChromaticFlash | null = null;
    private whiteFlash: WhiteFlash | null = null;
    private distortionIntensity: number = 0;
    private time: number = 0;

    constructor() {
        this.chromaticElement = document.createElement('div');
        this.chromaticElement.id = 'chromatic-overlay';
        this.chromaticElement.style.position = 'absolute';
        this.chromaticElement.style.top = '0';
        this.chromaticElement.style.left = '0';
        this.chromaticElement.style.width = '100%';
        this.chromaticElement.style.height = '100%';
        this.chromaticElement.style.pointerEvents = 'none';
        this.chromaticElement.style.zIndex = '400';
        this.chromaticElement.style.opacity = '0';
        this.chromaticElement.style.mixBlendMode = 'screen';
        document.body.appendChild(this.chromaticElement);

        this.distortionElement = document.createElement('div');
        this.distortionElement.id = 'grav-lens-distortion';
        this.distortionElement.style.position = 'absolute';
        this.distortionElement.style.top = '0';
        this.distortionElement.style.left = '0';
        this.distortionElement.style.width = '100%';
        this.distortionElement.style.height = '100%';
        this.distortionElement.style.pointerEvents = 'none';
        this.distortionElement.style.zIndex = '390';
        this.distortionElement.style.opacity = '0';
        this.distortionElement.style.mixBlendMode = 'overlay';
        document.body.appendChild(this.distortionElement);
    }

    flashChromatic(intensity: number, duration: number, color?: THREE.Color): void {
        this.chromaticFlash = {
            intensity: Math.min(1, Math.max(0, intensity)),
            duration: duration,
            maxDuration: duration,
            color: color ?? new THREE.Color(0.2, 0.1, 0.3),
            time: 0
        };

        this.updateChromaticVisuals();
    }

    setGravLensDistortion(intensity: number): void {
        this.distortionIntensity = THREE.MathUtils.clamp(intensity, 0, 1);
    }

    flashWhite(duration: number): void {
        if (this.whiteFlash) {
            this.whiteFlash.element.remove();
        }

        const element = document.createElement('div');
        element.style.position = 'absolute';
        element.style.top = '0';
        element.style.left = '0';
        element.style.width = '100%';
        element.style.height = '100%';
        element.style.backgroundColor = 'white';
        element.style.opacity = '1';
        element.style.pointerEvents = 'none';
        element.style.zIndex = '450';
        element.style.transition = `opacity ${duration}s ease-out`;

        document.body.appendChild(element);

        this.whiteFlash = {
            duration: duration,
            maxDuration: duration,
            element: element
        };

        requestAnimationFrame(() => {
            element.style.opacity = '0';
        });
    }

    flashRed(duration: number = 0.5): void {
        this.flashChromatic(0.8, duration, new THREE.Color(0.8, 0.1, 0.1));
    }

    flashRainbow(duration: number = 0.8): void {
        this.chromaticElement.style.background = `
            linear-gradient(90deg, 
                rgba(255, 105, 180, 0.5) 0%, 
                rgba(255, 215, 0, 0.5) 25%, 
                rgba(0, 206, 209, 0.5) 50%, 
                rgba(152, 255, 152, 0.5) 75%, 
                rgba(255, 105, 180, 0.5) 100%
            )
        `;
        this.flashChromatic(0.6, duration, new THREE.Color(1, 1, 1));
    }

    update(dt: number, time: number): void {
        this.time = time;

        if (this.chromaticFlash) {
            this.chromaticFlash.time += dt;
            this.chromaticFlash.duration -= dt;

            if (this.chromaticFlash.duration <= 0) {
                this.chromaticFlash = null;
                this.chromaticElement.style.opacity = '0';
            } else {
                this.updateChromaticVisuals();
            }
        }

        if (this.whiteFlash) {
            this.whiteFlash.duration -= dt;
            if (this.whiteFlash.duration <= 0) {
                this.whiteFlash.element.remove();
                this.whiteFlash = null;
            }
        }

        this.updateGravLensDistortion();
    }

    private updateChromaticVisuals(): void {
        if (!this.chromaticFlash) return;

        const progress = this.chromaticFlash.duration / this.chromaticFlash.maxDuration;
        const intensity = this.chromaticFlash.intensity * progress;

        const r = Math.floor(this.chromaticFlash.color.r * 255 * intensity);
        const g = Math.floor(this.chromaticFlash.color.g * 255 * intensity);
        const b = Math.floor(this.chromaticFlash.color.b * 255 * intensity);

        this.chromaticElement.style.boxShadow = `
            inset ${intensity * 20}px 0 ${intensity * 30}px rgba(${r}, 0, 0, ${intensity * 0.5}),
            inset -${intensity * 20}px 0 ${intensity * 30}px rgba(0, 0, ${b}, ${intensity * 0.5})
        `;
        this.chromaticElement.style.opacity = String(intensity);
    }

    private updateGravLensDistortion(): void {
        const t = this.time;
        const wobble = Math.sin(t * 14) * 0.4 + Math.sin(t * 7.3) * 0.3;
        const intensity = this.distortionIntensity;
        if (intensity <= 0.01) {
            this.distortionElement.style.opacity = '0';
            this.distortionElement.style.transform = '';
            return;
        }
        const px = (2 + wobble * 3) * intensity;
        this.distortionElement.style.background = `
            radial-gradient(ellipse at 50% 45%, rgba(120,40,200,0.35) 0%, transparent 55%),
            repeating-linear-gradient(
                ${45 + wobble * 20}deg,
                rgba(255,80,120,${0.08 * intensity}) 0px,
                rgba(80,200,255,${0.06 * intensity}) ${px}px
            )`;
        this.distortionElement.style.opacity = String(0.25 + intensity * 0.55);
        this.distortionElement.style.transform =
            `scale(${1 + intensity * 0.02}) skewX(${wobble * intensity * 1.5}deg)`;
    }

    reset(): void {
        this.chromaticFlash = null;
        this.chromaticElement.style.opacity = '0';
        this.distortionIntensity = 0;
        this.distortionElement.style.opacity = '0';

        if (this.whiteFlash) {
            this.whiteFlash.element.remove();
            this.whiteFlash = null;
        }
    }

    dispose(): void {
        this.reset();
        this.chromaticElement.remove();
        this.distortionElement.remove();
    }
}

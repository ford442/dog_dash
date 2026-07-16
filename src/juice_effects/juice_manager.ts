import * as THREE from 'three';
import { ParticleSystem } from '../particles';
import {
    ShakeType, BurstType,
    SHAKE_CONFIGS, BURST_CONFIGS, TEXT_COLORS,
    type ActiveShake, type FloatingText, type ChromaticFlash,
    type WhiteFlash, type HitPauseState
} from './shared';

export class JuiceManager {
    private camera: THREE.Camera;
    private scene: THREE.Scene;
    private particleSystem: ParticleSystem;
    
    // Camera original position for shake calculation
    private cameraBasePosition: THREE.Vector3;
    private cameraShakeOffset: THREE.Vector3;
    
    // Active effects
    private activeShakes: ActiveShake[] = [];
    private floatingTexts: FloatingText[] = [];
    private chromaticFlash: ChromaticFlash | null = null;
    private whiteFlash: WhiteFlash | null = null;
    private hitPauseState: HitPauseState | null = null;
    
    // Container for floating text UI
    private textContainer: HTMLDivElement;
    
    // Chromatic aberration overlay element
    private chromaticElement: HTMLDivElement;
    
    // Sustained gravitational lens crush distortion
    private distortionElement: HTMLDivElement;
    private distortionIntensity: number = 0;
    
    // Time tracking
    private time: number = 0;
    
    // Configuration
    private maxFloatingTexts: number = 20;
    private enableFloatingText: boolean = true;
    
    constructor(camera: THREE.Camera, scene: THREE.Scene, particleSystem: ParticleSystem) {
        this.camera = camera;
        this.scene = scene;
        this.particleSystem = particleSystem;
        
        // Store base camera position
        this.cameraBasePosition = camera.position.clone();
        this.cameraShakeOffset = new THREE.Vector3();
        
        // Create UI container for floating text
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
        
        // Create chromatic aberration overlay
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
    
    // =========================================================================
    // SCREEN SHAKE
    // =========================================================================
    
    /**
     * Trigger a screen shake effect
     * @param type - The intensity type of shake
     * @param duration - Optional custom duration (uses default if not specified)
     */
    shakeScreen(type: ShakeType, duration?: number): void {
        const config = SHAKE_CONFIGS[type];
        
        const shake: ActiveShake = {
            intensity: config.intensity,
            duration: duration ?? config.duration,
            maxDuration: duration ?? config.duration,
            frequency: config.frequency,
            decay: config.decay,
            time: 0,
            offset: new THREE.Vector3()
        };
        
        this.activeShakes.push(shake);
        
        // Limit concurrent shakes
        if (this.activeShakes.length > 3) {
            this.activeShakes.shift();
        }
    }
    
    /**
     * Update all active screen shakes
     */
    private updateShakes(dt: number): void {
        if (this.activeShakes.length === 0) {
            // Reset camera to base position if no shakes
            if (this.cameraShakeOffset.lengthSq() > 0.0001) {
                this.cameraShakeOffset.set(0, 0, 0);
                this.camera.position.copy(this.cameraBasePosition);
            }
            return;
        }
        
        // Calculate combined shake offset
        const combinedOffset = new THREE.Vector3();
        
        for (let i = this.activeShakes.length - 1; i >= 0; i--) {
            const shake = this.activeShakes[i];
            shake.time += dt;
            shake.duration -= dt;
            
            if (shake.duration <= 0) {
                // Remove expired shake
                this.activeShakes.splice(i, 1);
                continue;
            }
            
            // Calculate decay based on remaining duration
            const progress = shake.duration / shake.maxDuration;
            const currentIntensity = shake.intensity * Math.pow(progress, shake.decay);
            
            // Generate shake offset using sine waves at different frequencies
            const t = shake.time * shake.frequency;
            const x = Math.sin(t) * Math.cos(t * 1.3) * currentIntensity;
            const y = Math.cos(t * 0.8) * Math.sin(t * 1.7) * currentIntensity;
            const z = Math.sin(t * 0.5) * currentIntensity * 0.5; // Less Z movement
            
            combinedOffset.x += x;
            combinedOffset.y += y;
            combinedOffset.z += z;
        }
        
        // Apply shake to camera
        this.cameraShakeOffset.copy(combinedOffset);
        this.camera.position.copy(this.cameraBasePosition).add(combinedOffset);
    }
    
    /**
     * Update the base camera position (call when camera moves normally)
     */
    updateCameraBasePosition(position: THREE.Vector3): void {
        this.cameraBasePosition.copy(position);
        // Re-apply shake offset
        if (this.activeShakes.length > 0) {
            this.camera.position.copy(this.cameraBasePosition).add(this.cameraShakeOffset);
        }
    }
    
    // =========================================================================
    // HIT PAUSE (FRAME FREEZE)
    // =========================================================================
    
    /**
     * Trigger a hit pause - briefly freezes the game for impact
     * @param duration - Duration in seconds (typically 0.05 - 0.3)
     */
    hitPause(duration: number): void {
        this.hitPauseState = {
            duration: duration,
            remaining: duration
        };
    }
    
    /**
     * Check if we're currently in a hit pause
     * Returns the modified delta time (0 during pause)
     */
    processHitPause(dt: number): number {
        if (!this.hitPauseState) return dt;
        
        this.hitPauseState.remaining -= dt;
        
        if (this.hitPauseState.remaining <= 0) {
            this.hitPauseState = null;
            return dt;
        }
        
        // Return 0 to freeze game logic
        return 0;
    }
    
    /**
     * Check if currently paused (for external systems)
     */
    isPaused(): boolean {
        return this.hitPauseState !== null && this.hitPauseState.remaining > 0;
    }
    
    // =========================================================================
    // CHROMATIC ABERRATION FLASH
    // =========================================================================
    
    /**
     * Trigger a chromatic aberration flash effect
     * @param intensity - Flash intensity (0-1)
     * @param duration - Duration in seconds
     * @param color - Optional color tint
     */
    flashChromatic(intensity: number, duration: number, color?: THREE.Color): void {
        this.chromaticFlash = {
            intensity: Math.min(1, Math.max(0, intensity)),
            duration: duration,
            maxDuration: duration,
            color: color ?? new THREE.Color(0.2, 0.1, 0.3), // Subtle purple default
            time: 0
        };
        
        this.updateChromaticVisuals();
    }

    /**
     * Sustained screen warp for grav-lens crush zones (0 = off, 1 = max).
     */
    setGravLensDistortion(intensity: number): void {
        this.distortionIntensity = THREE.MathUtils.clamp(intensity, 0, 1);
    }
    
    /**
     * Flash white screen (useful for explosions, damage)
     * @param duration - Duration in seconds
     */
    flashWhite(duration: number): void {
        // Remove existing white flash
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
        
        // Trigger fade out
        requestAnimationFrame(() => {
            element.style.opacity = '0';
        });
    }
    
    /**
     * Flash red (for low health warning)
     */
    flashRed(duration: number = 0.5): void {
        this.flashChromatic(0.8, duration, new THREE.Color(0.8, 0.1, 0.1));
    }
    
    /**
     * Flash rainbow (for power-ups)
     */
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
    
    /**
     * Update chromatic aberration effect
     */
    private updateChromatic(dt: number): void {
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
        
        // Update white flash
        if (this.whiteFlash) {
            this.whiteFlash.duration -= dt;
            if (this.whiteFlash.duration <= 0) {
                this.whiteFlash.element.remove();
                this.whiteFlash = null;
            }
        }
    }
    
    /**
     * Update the visual representation of chromatic aberration
     */
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
    
    // =========================================================================
    // PARTICLE BURSTS
    // =========================================================================
    
    /**
     * Spawn a particle burst at a position
     * @param position - World position for the burst
     * @param type - Type of burst pattern
     * @param count - Optional override for particle count
     */
    spawnBurst(position: THREE.Vector3, type: BurstType, count?: number): void {
        const config = BURST_CONFIGS[type];
        const particleCount = count ?? config.count;
        
        // Emit particles with varied colors
        for (let i = 0; i < particleCount; i++) {
            const color = config.colors[Math.floor(Math.random() * config.colors.length)];
            const speedVariation = 0.7 + Math.random() * 0.6;
            const sizeVariation = 0.8 + Math.random() * 0.4;
            
            this.particleSystem.emit(
                position,
                color,
                1,                              // One at a time for varied properties
                config.speed * speedVariation,
                config.size * sizeVariation,
                config.spread
            );
        }
        
        // Add extra sparkle for magic bursts
        if (type === BurstType.MAGIC || type === BurstType.LEVEL_UP) {
            this.spawnSparkles(position, new THREE.Color(0xFFD700), 8);
        }
    }
    
    /**
     * Spawn sparkle particles with a specific color
     * @param position - World position
     * @param color - Sparkle color
     * @param count - Number of sparkles
     */
    spawnSparkles(position: THREE.Vector3, color: THREE.Color, count: number = 5): void {
        const colorHex = (color.r << 16) | (color.g << 8) | color.b;
        
        for (let i = 0; i < count; i++) {
            this.particleSystem.emit(
                position,
                color.getHex(),
                1,
                1.5 + Math.random() * 2.0,
                0.2 + Math.random() * 0.3,
                0.5
            );
        }
    }
    
    /**
     * Quick burst for collectible pickup
     */
    burstCollect(position: THREE.Vector3): void {
        this.spawnBurst(position, BurstType.COLLECT);
        this.shakeScreen(ShakeType.LIGHT, 0.1);
    }
    
    /**
     * Big explosion burst
     */
    burstExplosion(position: THREE.Vector3, size: 'small' | 'medium' | 'large' = 'medium'): void {
        const countMultiplier = size === 'small' ? 0.5 : size === 'large' ? 2.0 : 1.0;
        this.spawnBurst(position, BurstType.EXPLOSION, Math.floor(20 * countMultiplier));
        
        const shakeType = size === 'small' ? ShakeType.LIGHT : size === 'large' ? ShakeType.HEAVY : ShakeType.MEDIUM;
        this.shakeScreen(shakeType);
        this.hitPause(size === 'large' ? 0.15 : 0.08);
    }
    
    /**
     * Magic burst for power-ups
     */
    burstMagic(position: THREE.Vector3): void {
        this.spawnBurst(position, BurstType.MAGIC);
        this.flashRainbow(0.5);
        this.shakeScreen(ShakeType.MEDIUM, 0.4);
    }
    
    /**
     * Damage burst on player hit
     */
    burstDamage(position: THREE.Vector3): void {
        this.spawnBurst(position, BurstType.DAMAGE);
        this.flashRed(0.4);
        this.shakeScreen(ShakeType.EARTHQUAKE);
        this.hitPause(0.2);
    }
    
    /**
     * Level up celebration
     */
    burstLevelUp(position: THREE.Vector3): void {
        this.spawnBurst(position, BurstType.LEVEL_UP, 60);
        this.flashRainbow(1.0);
        this.shakeScreen(ShakeType.HEAVY, 0.8);
        this.hitPause(0.25);
    }
    
    // =========================================================================
    // FLOATING TEXT
    // =========================================================================
    
    /**
     * Show floating text at a position
     * @param text - Text to display
     * @param position - World position
     * @param color - Color name or hex string
     * @param size - Font size (default 24)
     */
    showFloatingText(
        text: string,
        position: THREE.Vector3,
        color: string = 'gold',
        size: number = 24
    ): void {
        if (!this.enableFloatingText) return;
        
        // Limit concurrent texts
        if (this.floatingTexts.length >= this.maxFloatingTexts) {
            const oldest = this.floatingTexts.shift();
            if (oldest) {
                oldest.element.remove();
            }
        }
        
        // Create text element
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
        
        // Apply color
        const colorValue = TEXT_COLORS[color as keyof typeof TEXT_COLORS] ?? color;
        if (color === 'rainbow') {
            element.style.background = colorValue;
            element.style.webkitBackgroundClip = 'text';
            element.style.webkitTextFillColor = 'transparent';
            element.style.backgroundClip = 'text';
        } else {
            element.style.color = colorValue;
        }
        
        // Add to container
        this.textContainer.appendChild(element);
        
        // Create floating text object
        const floatingText: FloatingText = {
            element,
            position: position.clone(),
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 2,  // Slight horizontal drift
                3 + Math.random() * 2,       // Upward velocity
                0
            ),
            life: 1.5,
            maxLife: 1.5,
            scale: 1,
            bounces: 0,
            baseY: position.y
        };
        
        this.floatingTexts.push(floatingText);
        
        // Initial position update
        this.updateFloatingTextPosition(floatingText);
    }
    
    /**
     * Show score text (+10, +50, etc.)
     */
    showScoreText(score: number, position: THREE.Vector3): void {
        const text = score > 0 ? `+${score}` : `${score}`;
        const size = score >= 50 ? 32 : 24;
        this.showFloatingText(text, position, 'gold', size);
    }
    
    /**
     * Show combo text (WOW!, AMAZING!, etc.)
     */
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
            this.shakeScreen(ShakeType.LIGHT, 0.2);
        }
    }
    
    /**
     * Show health change
     */
    showHealthChange(amount: number, position: THREE.Vector3): void {
        const text = amount > 0 ? `+${amount} ❤️` : `${amount} 💔`;
        const color = amount > 0 ? 'pink' : 'red';
        this.showFloatingText(text, position, color, 28);
    }
    
    /**
     * Update floating text positions
     */
    private updateFloatingTexts(dt: number): void {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const text = this.floatingTexts[i];
            text.life -= dt;
            
            if (text.life <= 0) {
                text.element.remove();
                this.floatingTexts.splice(i, 1);
                continue;
            }
            
            // Update physics
            text.velocity.y -= 4.0 * dt; // Gravity
            text.position.add(text.velocity.clone().multiplyScalar(dt));
            
            // Bounce off "ground" for fun effect
            if (text.position.y < text.baseY && text.bounces < 2) {
                text.position.y = text.baseY;
                text.velocity.y = Math.abs(text.velocity.y) * 0.5;
                text.velocity.x *= 0.8;
                text.bounces++;
            }
            
            // Scale animation (pop in, then shrink)
            const lifeRatio = text.life / text.maxLife;
            if (lifeRatio > 0.8) {
                text.scale = 1 + (1 - lifeRatio) * 2; // Pop in
            } else {
                text.scale = 0.8 + lifeRatio * 0.2; // Shrink out
            }
            
            // Update visual
            text.element.style.opacity = String(Math.min(1, lifeRatio * 2));
            text.element.style.transform = `scale(${text.scale})`;
            
            this.updateFloatingTextPosition(text);
        }
    }
    
    /**
     * Update the screen position of a floating text element
     */
    private updateFloatingTextPosition(text: FloatingText): void {
        // Project world position to screen space
        const screenPos = text.position.clone().project(this.camera);
        
        // Convert to CSS coordinates
        const x = (screenPos.x * 0.5 + 0.5) * 100;
        const y = (-screenPos.y * 0.5 + 0.5) * 100;
        
        text.element.style.left = `${x}%`;
        text.element.style.top = `${y}%`;
        text.element.style.transform = `translate(-50%, -50%) scale(${text.scale})`;
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

    // =========================================================================
    // MAIN UPDATE
    // =========================================================================
    
    /**
     * Update all juice effects
     * Call this every frame in your game loop
     * @param deltaTime - Time since last frame
     * @returns Modified delta time (0 during hit pause)
     */
    update(deltaTime: number): number {
        this.time += deltaTime;
        
        // Process hit pause first
        const modifiedDelta = this.processHitPause(deltaTime);
        
        // Only update visual effects during hit pause
        if (modifiedDelta > 0) {
            this.updateShakes(modifiedDelta);
        }
        
        // Always update these (visual only)
        this.updateChromatic(deltaTime);
        this.updateGravLensDistortion();
        this.updateFloatingTexts(deltaTime);
        
        return modifiedDelta;
    }
    
    // =========================================================================
    // RESET
    // =========================================================================
    
    /**
     * Clear all active effects
     */
    reset(): void {
        // Clear shakes
        this.activeShakes = [];
        this.camera.position.copy(this.cameraBasePosition);
        this.cameraShakeOffset.set(0, 0, 0);
        
        // Clear hit pause
        this.hitPauseState = null;
        
        // Clear chromatic
        this.chromaticFlash = null;
        this.chromaticElement.style.opacity = '0';
        this.distortionIntensity = 0;
        this.distortionElement.style.opacity = '0';
        
        // Clear white flash
        if (this.whiteFlash) {
            this.whiteFlash.element.remove();
            this.whiteFlash = null;
        }
        
        // Clear floating texts
        for (const text of this.floatingTexts) {
            text.element.remove();
        }
        this.floatingTexts = [];
        
        this.time = 0;
    }
    
    /**
     * Clean up resources
     */
    dispose(): void {
        this.reset();
        this.textContainer.remove();
        this.chromaticElement.remove();
        this.distortionElement.remove();
    }
    
    // =========================================================================
    // UTILITY
    // =========================================================================
    
    /**
     * Enable/disable floating text
     */
    setFloatingTextEnabled(enabled: boolean): void {
        this.enableFloatingText = enabled;
    }
    
    /**
     * Get current shake intensity (0-1)
     */
    getCurrentShakeIntensity(): number {
        if (this.activeShakes.length === 0) return 0;
        
        let totalIntensity = 0;
        for (const shake of this.activeShakes) {
            const progress = shake.duration / shake.maxDuration;
            totalIntensity += progress * shake.intensity;
        }
        
        return Math.min(1, totalIntensity / 0.5);
    }
}

/**
 * Sling Combo Manager — Arc Surge Scoring & Feel Amplification
 *
 * Tracks consecutive clean sling / gravity-arc actions and fires escalating
 * juice at 3×, 5×, and 7×+ (Arc Surge) thresholds.
 *
 * Integration:
 *   1. Call `recordSlingAction(quality)` on every tether release or clean
 *      gravity-anchor sling exit.
 *   2. Call `update(delta)` every frame to handle the combo timeout.
 *   3. Call `resetCombo()` when the player takes damage.
 */

import * as THREE from 'three';
import { JuiceManager, ShakeType, BurstType } from './juice_effects';
import { HUDManager } from './hud_system';
import { DogCockpitController, DogAnimationState } from './dog_cockpit';
import { AudioSystem } from './audio_system';
import { ParticleSystem } from './particles';

/** Quality level of a sling action */
export type SlingQuality = 'perfect' | 'good' | 'messy';

/** Score bonus per quality tier */
const QUALITY_SCORE: Record<SlingQuality, number> = {
    perfect: 150,
    good: 75,
    messy: 25
};

/** Combo multipliers applied to score bonuses */
const comboMultiplier = (combo: number): number => {
    if (combo >= 7) return 4;
    if (combo >= 5) return 2.5;
    if (combo >= 3) return 1.5;
    return 1;
};

/** Seconds without a sling action before the combo resets */
const COMBO_TIMEOUT = 4.0;

/** Duration of the "Sling Assist" boost granted at Arc Surge (7×+) in seconds */
const SLING_ASSIST_DURATION = 4.0;

export interface SlingComboManagerOptions {
    juiceManager: JuiceManager;
    hudManager: HUDManager;
    dogController: DogCockpitController;
    audioSystem: AudioSystem;
    particleSystem: ParticleSystem;
    /** Called with score bonus each time an action is recorded */
    onScoreBonus?: (points: number) => void;
    /** Called when Arc Surge activates (≥7×) — passes assist duration */
    onSlingAssist?: (duration: number) => void;
}

/**
 * SlingComboManager — central hub for the Sling Chain Meter mechanic.
 */
export class SlingComboManager {
    private combo: number = 0;
    private comboTimer: number = 0;

    /** True while Arc Surge mode (≥7×) is active */
    private inArcSurge: boolean = false;
    private arcSurgeTimer: number = 0;
    private readonly ARC_SURGE_DISPLAY_DURATION = 3.0;

    private readonly options: SlingComboManagerOptions;

    constructor(options: SlingComboManagerOptions) {
        this.options = options;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Record a sling action and update the combo chain.
     *
     * @param quality - 'perfect' for clean arc exits & strong tether releases,
     *                  'good' for standard releases, 'messy' for short holds.
     * @param position - World position for floating text / particle bursts.
     */
    recordSlingAction(quality: SlingQuality, position: THREE.Vector3): void {
        // Messy slings still reset the timeout but don't advance high chains
        if (quality === 'messy' && this.combo >= 5) {
            // Don't break a long chain on a messy sling — just reset the timer
            this.comboTimer = 0;
            return;
        }

        this.combo++;
        this.comboTimer = 0;

        const { juiceManager, hudManager, dogController, audioSystem, particleSystem, onScoreBonus } = this.options;

        // Score bonus
        const baseScore = QUALITY_SCORE[quality];
        const bonus = Math.round(baseScore * comboMultiplier(this.combo));
        onScoreBonus?.(bonus);
        juiceManager.showScoreText(bonus, position.clone());

        // Audio: rising charge hum scales with combo
        audioSystem.playSlingCharge(this.combo);

        // Update HUD
        hudManager.showSlingCombo(this.combo, this.combo >= 7);

        // ── Threshold juice ───────────────────────────────────────────────────

        if (this.combo === 3) {
            // 3×: speed lines illusion (light shake) + dog ears perk
            juiceManager.shakeScreen(ShakeType.LIGHT, 0.2);
            particleSystem.emit(position.clone(), 0xaa66ff, 8, 3.5, 0.5, 0.4);
            juiceManager.showFloatingText('Sling Streak!', position.clone(), '#aa66ff', 22);
            dogController.triggerAnimation(DogAnimationState.CURIOUS, 1.2);

        } else if (this.combo === 5) {
            // 5×: camera whip + particle vortex + happy bark
            juiceManager.shakeScreen(ShakeType.MEDIUM, 0.35);
            juiceManager.spawnBurst(position.clone(), BurstType.MAGIC, 24);
            juiceManager.showFloatingText('ARC CHAIN ×5!', position.clone(), '#ffcc00', 28);
            dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.5);

        } else if (this.combo >= 7) {
            // 7×+: Arc Surge mode
            this._activateArcSurge(position, quality);
        }

        // Ongoing 5×+ per-action juice
        if (this.combo >= 5 && this.combo < 7) {
            particleSystem.emit(position.clone(), 0xffaa00, 10, 4.0, 0.6, 0.3);
        }
    }

    /**
     * Reset the combo chain (call on player damage).
     */
    resetCombo(): void {
        if (this.combo === 0) return;
        this.combo = 0;
        this.comboTimer = 0;
        this.inArcSurge = false;
        this.arcSurgeTimer = 0;
        this.options.hudManager.hideSlingCombo();
    }

    /**
     * Advance timers. Call once per frame with the frame delta.
     */
    update(delta: number): void {
        if (this.combo === 0) return;

        // Combo timeout
        this.comboTimer += delta;
        if (this.comboTimer >= COMBO_TIMEOUT) {
            this.resetCombo();
            return;
        }

        // Arc Surge display timeout
        if (this.inArcSurge) {
            this.arcSurgeTimer += delta;
            if (this.arcSurgeTimer >= this.ARC_SURGE_DISPLAY_DURATION) {
                this.inArcSurge = false;
                this.arcSurgeTimer = 0;
                // Return to normal sling-combo display if chain still alive
                if (this.combo > 0) {
                    this.options.hudManager.showSlingCombo(this.combo, false);
                }
            }
        }
    }

    /** Current combo count (read-only). */
    getCombo(): number {
        return this.combo;
    }

    /** True if Arc Surge mode is currently active. */
    isArcSurge(): boolean {
        return this.inArcSurge;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private _activateArcSurge(position: THREE.Vector3, quality: SlingQuality): void {
        const { juiceManager, hudManager, dogController, audioSystem, particleSystem, onSlingAssist } = this.options;

        this.inArcSurge = true;
        this.arcSurgeTimer = 0;

        // Visual: screen distortion + massive score pop
        juiceManager.shakeScreen(ShakeType.HEAVY, 0.6);
        juiceManager.flashChromatic(0.6, 0.4, new THREE.Color(0.6, 0.3, 1.0));
        juiceManager.spawnBurst(position.clone(), BurstType.LEVEL_UP, 40);

        const surgeText = quality === 'perfect' ? '⚡ ARC SURGE! ⚡' : 'ARC SURGE!';
        juiceManager.showFloatingText(surgeText, position.clone(), '#cc44ff', 36);

        // Brief slow-mo on perfect release
        if (quality === 'perfect') {
            juiceManager.hitPause(0.12);
        }

        // Audio: massive whump + whoosh
        audioSystem.playSlingArcSurge();

        // Dog: max excitement
        dogController.triggerAnimation(DogAnimationState.VICTORY, 2.0);

        // HUD: Arc Surge badge
        hudManager.showSlingCombo(this.combo, true);

        // Grant Sling Assist
        onSlingAssist?.(SLING_ASSIST_DURATION);

        // Trailing particle arc
        for (let i = 0; i < 6; i++) {
            setTimeout(() => {
                particleSystem.emit(
                    position.clone().add(new THREE.Vector3(
                        (Math.random() - 0.5) * 6,
                        (Math.random() - 0.5) * 6,
                        0
                    )),
                    0xcc44ff,
                    4, 5.0, 0.7, 0.5
                );
            }, i * 60);
        }
    }
}

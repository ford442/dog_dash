import * as THREE from 'three';

export const BARK_CORE_COST = 5;
export const BARK_CHARGE_CORES = 5;
export const BARK_MAX_CHARGES = 2;
export const BARK_RADIUS = 14;
export const BARK_COOLDOWN = 3.0;

export interface BarkBlastOptions {
    onActivate?: (position: THREE.Vector3) => void;
    getCores?: () => number;
    spendCores?: (amount: number) => boolean;
    getOrbChargeProgress?: () => number;
    spendOrbCharge?: () => boolean;
}

/**
 * Companion Bark Blast — spend cores or stored charges to clear nearby threats.
 */
export class BarkBlastSystem {
    private charges = 0;
    private coreAccumulator = 0;
    private cooldownTimer = 0;
    private lastCoreSnapshot = 0;
    private whineCooldown = 0;

    private readonly onActivate?: (position: THREE.Vector3) => void;
    private readonly getCores?: () => number;
    private readonly spendCores?: (amount: number) => boolean;
    private readonly getOrbChargeProgress?: () => number;
    private readonly spendOrbCharge?: () => boolean;

    constructor(options: BarkBlastOptions = {}) {
        this.onActivate = options.onActivate;
        this.getCores = options.getCores;
        this.spendCores = options.spendCores;
        this.getOrbChargeProgress = options.getOrbChargeProgress;
        this.spendOrbCharge = options.spendOrbCharge;
    }

    update(delta: number): void {
        if (this.cooldownTimer > 0) {
            this.cooldownTimer = Math.max(0, this.cooldownTimer - delta);
        }
        if (this.whineCooldown > 0) {
            this.whineCooldown = Math.max(0, this.whineCooldown - delta);
        }
    }

    /** Track run cores earned toward stored bark charges. */
    syncCores(currentCores: number): void {
        if (currentCores > this.lastCoreSnapshot) {
            this.onCoresEarned(currentCores - this.lastCoreSnapshot);
        }
        this.lastCoreSnapshot = currentCores;
    }

    canWhine(): boolean {
        return this.whineCooldown <= 0;
    }

    markWhine(): void {
        this.whineCooldown = 4.0;
    }

    /** Feed run cores into bark charge bank (every 5 cores → 1 stored charge). */
    onCoresEarned(amount: number): void {
        if (amount <= 0) return;
        this.coreAccumulator += amount;
        while (this.coreAccumulator >= BARK_CHARGE_CORES && this.charges < BARK_MAX_CHARGES) {
            this.coreAccumulator -= BARK_CHARGE_CORES;
            this.charges++;
        }
    }

    getCharges(): number {
        return this.charges;
    }

    getMaxCharges(): number {
        return BARK_MAX_CHARGES;
    }

    getCooldownRatio(): number {
        return this.cooldownTimer > 0 ? this.cooldownTimer / BARK_COOLDOWN : 0;
    }

    canBark(): boolean {
        if (this.cooldownTimer > 0) return false;
        if (this.charges > 0) return true;
        if (this.getCores && this.getCores() >= BARK_CORE_COST) return true;
        if (this.getOrbChargeProgress && this.getOrbChargeProgress() >= 0.8) return true;
        return false;
    }

    activate(position: THREE.Vector3): boolean {
        if (!this.canBark()) return false;

        if (this.charges > 0) {
            this.charges--;
        } else if (this.getOrbChargeProgress && this.getOrbChargeProgress() >= 0.8 && this.spendOrbCharge?.()) {
            // Power-up orb charge consumed as bark fuel.
        } else if (this.spendCores?.(BARK_CORE_COST)) {
            // Run cores spent.
        } else {
            return false;
        }

        this.cooldownTimer = BARK_COOLDOWN;
        this.onActivate?.(position.clone());
        return true;
    }
}

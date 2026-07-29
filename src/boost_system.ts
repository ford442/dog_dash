import * as THREE from 'three';

export interface BoostSystemOptions {
    maxCharges?: number;
    rechargeTime?: number;
    duration?: number;
    cooldown?: number;
    onActivate?: () => void;
    onDeactivate?: () => void;
    onRecharge?: (charges: number) => void;
}

export class BoostSystem {
    private charges: number;
    private maxCharges: number;
    private rechargeTime: number;
    private rechargeTimer: number = 0;
    private duration: number;
    private cooldown: number;
    private cooldownTimer: number = 0;
    private activeTimer: number = 0;
    private isActive: boolean = false;
    private isCooldown: boolean = false;

    private onActivate?: () => void;
    private onDeactivate?: () => void;
    private onRecharge?: (charges: number) => void;

    constructor(options: BoostSystemOptions = {}) {
        this.charges = options.maxCharges ?? 3;
        this.maxCharges = options.maxCharges ?? 3;
        this.rechargeTime = options.rechargeTime ?? 8;
        this.duration = options.duration ?? 1.8;
        this.cooldown = options.cooldown ?? 4;
        this.onActivate = options.onActivate;
        this.onDeactivate = options.onDeactivate;
        this.onRecharge = options.onRecharge;
    }

    getCharges(): number { return this.charges; }
    getMaxCharges(): number { return this.maxCharges; }

    /** Crafted Stellar Fuel: permanently raise the charge cap for this run. */
    addMaxCharge(amount: number = 1): void {
        this.maxCharges += amount;
        this.charges += amount;
    }

    /** Crafted Stellar Fuel: lengthen each boost for this run. */
    extendDuration(seconds: number): void {
        this.duration += seconds;
    }

    /** Crafted Phase Shifter: top up all charges immediately. */
    refillCharges(): void {
        this.charges = this.maxCharges;
    }
    isBoosting(): boolean { return this.isActive; }
    getActiveRatio(): number { return this.isActive ? 1 - (this.activeTimer / this.duration) : 0; }
    getCooldownRatio(): number { return this.isCooldown ? 1 - (this.cooldownTimer / this.cooldown) : 0; }

    canBoost(): boolean {
        return this.charges > 0 && !this.isActive && !this.isCooldown;
    }

    activate(): boolean {
        if (!this.canBoost()) return false;

        this.charges--;
        this.isActive = true;
        this.activeTimer = this.duration;
        this.isCooldown = false;
        this.cooldownTimer = 0;
        this.rechargeTimer = 0;

        this.onActivate?.();
        return true;
    }

    addCharge(amount: number = 1): void {
        const oldCharges = this.charges;
        this.charges = Math.min(this.charges + amount, this.maxCharges);
        if (this.charges > oldCharges) {
            this.onRecharge?.(this.charges);
        }
    }

    update(delta: number): void {
        // Active countdown
        if (this.isActive) {
            this.activeTimer -= delta;
            if (this.activeTimer <= 0) {
                this.isActive = false;
                this.isCooldown = true;
                this.cooldownTimer = this.cooldown;
                this.onDeactivate?.();
            }
        }

        // Cooldown countdown
        if (this.isCooldown) {
            this.cooldownTimer -= delta;
            if (this.cooldownTimer <= 0) {
                this.isCooldown = false;
            }
        }

        // Recharge countdown (only when not actively boosting)
        if (this.charges < this.maxCharges && !this.isActive) {
            this.rechargeTimer += delta;
            if (this.rechargeTimer >= this.rechargeTime) {
                this.rechargeTimer -= this.rechargeTime;
                this.addCharge(1);
            }
        }
    }
}

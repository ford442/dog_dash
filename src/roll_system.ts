export interface RollSystemOptions {
    duration?: number;
    cooldown?: number;
    onActivate?: () => void;
    onDeactivate?: () => void;
}

export class RollSystem {
    private duration: number;
    private cooldown: number;
    private activeTimer: number = 0;
    private cooldownTimer: number = 0;
    private isActive: boolean = false;
    private isCooldown: boolean = false;
    private rollProgress: number = 0; // 0 to 1 for 360° rotation

    private onActivate?: () => void;
    private onDeactivate?: () => void;

    constructor(options: RollSystemOptions = {}) {
        this.duration = options.duration ?? 0.5;
        this.cooldown = options.cooldown ?? 2.6;
        this.onActivate = options.onActivate;
        this.onDeactivate = options.onDeactivate;
    }

    getRollAngle(): number {
        return this.isActive ? this.rollProgress * Math.PI * 2 : 0;
    }

    getRollProgress(): number {
        return this.isActive ? this.rollProgress : 0;
    }

    isRolling(): boolean {
        return this.isActive;
    }

    getCooldownRatio(): number {
        return this.isCooldown ? 1 - (this.cooldownTimer / this.cooldown) : 0;
    }

    /** Crafted Phase Shifter: shorten the roll cooldown for this run. */
    scaleCooldown(factor: number): void {
        this.cooldown = Math.max(0.2, this.cooldown * factor);
    }

    canRoll(): boolean {
        return !this.isActive && !this.isCooldown;
    }

    activate(): boolean {
        if (!this.canRoll()) return false;

        this.isActive = true;
        this.activeTimer = this.duration;
        this.rollProgress = 0;
        this.isCooldown = false;
        this.cooldownTimer = 0;

        this.onActivate?.();
        return true;
    }

    update(delta: number): void {
        if (this.isActive) {
            this.activeTimer -= delta;
            this.rollProgress = 1 - (this.activeTimer / this.duration);
            if (this.activeTimer <= 0) {
                this.isActive = false;
                this.isCooldown = true;
                this.cooldownTimer = this.cooldown;
                this.rollProgress = 0;
                this.onDeactivate?.();
            }
        }

        if (this.isCooldown) {
            this.cooldownTimer -= delta;
            if (this.cooldownTimer <= 0) {
                this.isCooldown = false;
            }
        }
    }
}

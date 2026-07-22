import type { HitPauseState } from './shared';

/** Brief frame-freeze for impact feedback. */
export class HitPauseController {
    private hitPauseState: HitPauseState | null = null;

    hitPause(duration: number): void {
        this.hitPauseState = {
            duration: duration,
            remaining: duration
        };
    }

    processHitPause(dt: number): number {
        if (!this.hitPauseState) return dt;

        this.hitPauseState.remaining -= dt;

        if (this.hitPauseState.remaining <= 0) {
            this.hitPauseState = null;
            return dt;
        }

        return 0;
    }

    isPaused(): boolean {
        return this.hitPauseState !== null && this.hitPauseState.remaining > 0;
    }

    reset(): void {
        this.hitPauseState = null;
    }
}

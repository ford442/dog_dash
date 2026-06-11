import type { SlingQuality } from './sling_combo';

// Tracks progress toward the Level 2 "Complete N clean gravity slings" objective.
// Only 'perfect' quality slings (clean tether releases or full gravity-arc sweeps) count.
export class SlingObjectiveManager {
    private cleanSlings = 0;
    private target = 0;
    private completed = false;

    onProgress?: (current: number, target: number) => void;
    onObjectiveComplete?: () => void;

    reset(target: number) {
        this.cleanSlings = 0;
        this.target = target;
        this.completed = false;
    }

    getProgress(): number {
        return this.cleanSlings;
    }

    getTarget(): number {
        return this.target;
    }

    /** Returns true if this sling counted toward the objective */
    recordSling(quality: SlingQuality): boolean {
        if (quality !== 'perfect' || this.completed || this.target <= 0) return false;

        this.cleanSlings++;
        this.onProgress?.(this.cleanSlings, this.target);

        if (this.cleanSlings >= this.target) {
            this.completed = true;
            this.onObjectiveComplete?.();
        }

        return true;
    }
}

/** mulberry32 — fast, deterministic 32-bit PRNG. */
export class SeededRng {
    private state: number;
    private readonly label: string;

    constructor(seed: number, label = 'root') {
        this.state = seed >>> 0;
        this.label = label;
    }

    /** Uniform float in [0, 1). */
    random(): number {
        let t = (this.state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    randomRange(min: number, max: number): number {
        return min + this.random() * (max - min);
    }

    /** Returns true with probability p (0–1). */
    chance(p: number): boolean {
        return this.random() < p;
    }

    /** Named substream — stable hash of label + parent seed. */
    fork(label: string): SeededRng {
        const hash = hashLabel(this.state, label);
        return new SeededRng(hash, label);
    }

    getLabel(): string {
        return this.label;
    }

    /** Expose internal state for fork hashing (tests). */
    getState(): number {
        return this.state;
    }
}

function hashLabel(parentState: number, label: string): number {
    let h = parentState >>> 0;
    for (let i = 0; i < label.length; i++) {
        h = Math.imul(h ^ label.charCodeAt(i), 0x5bd1e995);
        h ^= h >>> 13;
    }
    return (h ^ (h >>> 16)) >>> 0 || 1;
}

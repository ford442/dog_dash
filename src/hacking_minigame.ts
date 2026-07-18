/**
 * Hacking Minigame — shared framework for the Artifacts systems (plan §III).
 *
 * Both the Derelict Buoy (Morse decode) and the Data Monolith (circuitry trace)
 * build on this: a timer, a mistake counter with a fail threshold, and
 * success/fail callbacks. The concrete minigames own their DOM/3D presentation;
 * this module owns the shared session bookkeeping and a couple of styling
 * helpers so the overlays read as one system.
 */

export interface HackSessionOptions {
    /** Max wrong inputs before the hack fails and the alarm trips. */
    maxMistakes: number;
    /** Optional countdown in seconds. 0 / undefined = no time pressure. */
    timeLimit?: number;
    onSuccess: () => void;
    onFail: (reason: HackFailReason) => void;
    /** Fired whenever the mistake count changes (for HUD/particle feedback). */
    onMistake?: (mistakes: number, remaining: number) => void;
    /** Fired once per second while a time limit is running. */
    onTick?: (secondsLeft: number) => void;
}

export type HackFailReason = 'mistakes' | 'timeout' | 'aborted';

/**
 * Tracks the live state of a single hack attempt. Presentation-agnostic: the
 * concrete minigame drives it via registerMistake()/succeed() and reads the
 * getters for rendering. update(delta) advances the optional timer.
 */
export class HackSession {
    private readonly options: HackSessionOptions;
    private mistakes = 0;
    private timeLeft: number;
    private tickAccumulator = 0;
    private finished = false;

    constructor(options: HackSessionOptions) {
        this.options = options;
        this.timeLeft = options.timeLimit ?? 0;
    }

    get isFinished(): boolean {
        return this.finished;
    }

    get mistakeCount(): number {
        return this.mistakes;
    }

    get mistakesRemaining(): number {
        return Math.max(0, this.options.maxMistakes - this.mistakes);
    }

    get secondsLeft(): number {
        return Math.max(0, Math.ceil(this.timeLeft));
    }

    get hasTimeLimit(): boolean {
        return (this.options.timeLimit ?? 0) > 0;
    }

    /** Advance the optional countdown. Returns true while the session is live. */
    update(delta: number): boolean {
        if (this.finished || !this.hasTimeLimit) return !this.finished;

        this.timeLeft -= delta;
        this.tickAccumulator += delta;
        if (this.tickAccumulator >= 1) {
            this.tickAccumulator -= 1;
            this.options.onTick?.(this.secondsLeft);
        }

        if (this.timeLeft <= 0) {
            this.fail('timeout');
        }
        return !this.finished;
    }

    /** Record a wrong input. Fails the hack once the threshold is crossed. */
    registerMistake(): void {
        if (this.finished) return;
        this.mistakes++;
        this.options.onMistake?.(this.mistakes, this.mistakesRemaining);
        if (this.mistakes >= this.options.maxMistakes) {
            this.fail('mistakes');
        }
    }

    succeed(): void {
        if (this.finished) return;
        this.finished = true;
        this.options.onSuccess();
    }

    fail(reason: HackFailReason): void {
        if (this.finished) return;
        this.finished = true;
        this.options.onFail(reason);
    }

    /** Player left the dock / cancelled before completing. */
    abort(): void {
        this.fail('aborted');
    }
}

// --- Shared overlay styling ---------------------------------------------------

export const HACK_ACCENT = '#33e0ff';
export const HACK_ACCENT_WARN = '#ff5577';
export const HACK_ACCENT_GOOD = '#66ffaa';

/** Full-screen dim backdrop container shared by both hack overlays. */
export function createHackOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 1200;
        background: radial-gradient(circle at 50% 40%, rgba(8,16,32,0.72), rgba(2,4,10,0.92));
        font-family: 'Segoe UI', sans-serif;
        color: #eaf6ff;
        user-select: none;
        -webkit-user-select: none;
    `;
    return overlay;
}

/** Consistent framed panel used inside the overlay. */
export function createHackPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.style.cssText = `
        background: rgba(10, 20, 34, 0.92);
        border: 2px solid ${HACK_ACCENT};
        border-radius: 14px;
        box-shadow: 0 0 40px rgba(51, 224, 255, 0.25), inset 0 0 24px rgba(51, 224, 255, 0.08);
        padding: 22px 26px;
        max-width: 520px;
        width: 92%;
        text-align: center;
    `;
    return panel;
}

/** Renders a compact "mistakes remaining" pip row (shared by both minigames). */
export function renderMistakePips(remaining: number, total: number): string {
    let pips = '';
    for (let i = 0; i < total; i++) {
        const alive = i < remaining;
        pips += `<span style="display:inline-block;width:12px;height:12px;margin:0 3px;border-radius:50%;
            background:${alive ? HACK_ACCENT_GOOD : 'transparent'};
            border:2px solid ${alive ? HACK_ACCENT_GOOD : HACK_ACCENT_WARN};
            box-shadow:${alive ? '0 0 8px ' + HACK_ACCENT_GOOD : 'none'};"></span>`;
    }
    return pips;
}

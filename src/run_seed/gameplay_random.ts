import { getRunRngFork, tryGetRunSeed } from './run_context';
import { SeededRng } from './rng';

/**
 * Gameplay randomness entry point. Every spawn / drop / AI roll draws from a
 * named substream of the run RNG, so the same seed + input trace replays the
 * same world (see docs/DETERMINISM.md). Separate streams per domain keep one
 * system's draw count from shifting every other system's rolls.
 *
 * Call per use — don't cache the returned source across runs: beginRun()
 * replaces the streams.
 *
 * Before beginRun() (composition-root construction, title screen) no seed
 * exists yet, but systems built there (butterfly swarms, asteroid fields, sky
 * rails) keep their layout into the run. Those draws come from fixed boot
 * streams instead, so the pre-run world is identical on every machine.
 */
export type GameplayStream =
    | 'obstacles'
    | 'candy'
    | 'comboCorridor'
    | 'enemies'
    | 'boss'
    | 'pickups'
    | 'powerups'
    | 'creatures'
    | 'friends'
    | 'geology'
    | 'flora'
    | 'slingables'
    | 'environment'
    | 'player'
    | 'harvest';

export interface RandomSource {
    random(): number;
}

/** Seed of the pre-run boot streams. Changing it changes every fixture. */
const BOOT_SEED = 0xb007d06;
const bootRoot = new SeededRng(BOOT_SEED, 'boot');
const bootStreams = new Map<GameplayStream, SeededRng>();

function bootRng(stream: GameplayStream): SeededRng {
    let rng = bootStreams.get(stream);
    if (!rng) {
        rng = bootRoot.fork(stream);
        bootStreams.set(stream, rng);
    }
    return rng;
}

export function gameplayRng(stream: GameplayStream): RandomSource {
    return tryGetRunSeed() ? getRunRngFork(stream) : bootRng(stream);
}

/** Uniform [0, 1) from the named gameplay stream. */
export function gameplayRandom(stream: GameplayStream): number {
    return gameplayRng(stream).random();
}

/** Uniform [min, max) from the named gameplay stream. */
export function gameplayRange(stream: GameplayStream, min: number, max: number): number {
    return min + gameplayRandom(stream) * (max - min);
}

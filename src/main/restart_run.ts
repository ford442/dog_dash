/**
 * "Try again" / "Restart" from the pause, game-over and finish screens.
 * An Architect playtest or Lost Sector re-queues its own seed, so the retry
 * flies the same chapter (and races the ghost just saved); every other run reloads
 * into a fresh campaign seed as before.
 */
import { tryGetRunSeed } from '../run_seed';
import { setPendingRunSeed } from '../hub_pending_seed';
import { hasFinishLine } from '../journey_layout';

export function restartRun(): void {
    const seed = tryGetRunSeed();
    if (seed && hasFinishLine()) setPendingRunSeed(seed);
    location.reload();
}

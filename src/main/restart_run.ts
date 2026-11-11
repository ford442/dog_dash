/**
 * "Try again" / "Restart" from the pause, game-over and finish screens.
 * An Architect playtest re-queues its own course, so the retry flies the
 * same sandbox (and races the ghost just saved); every other run reloads
 * into a fresh campaign seed as before.
 */
import { tryGetRunSeed } from '../run_seed';
import { setPendingRunSeed } from '../hub_pending_seed';
import { isArchitectRun } from '../journey_layout';

export function restartRun(): void {
    const seed = tryGetRunSeed();
    if (seed && isArchitectRun()) setPendingRunSeed(seed);
    location.reload();
}

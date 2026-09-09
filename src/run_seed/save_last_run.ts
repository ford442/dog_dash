/**
 * Persist last-run seed + distance when a run ends (game over or victory).
 */

import { player } from '../player_loader';
import { game } from '../game_runtime';
import { serializeRunSeed, tryGetRunSeed } from '../run_seed';
import { ghostRunRecorder, saveGhostRecording } from '../ghost_run';

export function saveLastRunSummary(): void {
    const seed = tryGetRunSeed();
    if (!seed) return;
    const distance = player ? Math.floor(player.position.x) : 0;
    game.saveManager.saveLastRun({
        seed: serializeRunSeed(seed),
        distance,
        endedAt: Date.now()
    });
    const recording = ghostRunRecorder.stop();
    if (recording) {
        saveGhostRecording(recording);
    }
}

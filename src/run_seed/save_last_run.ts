/**
 * Persist last-run seed + distance when a run ends (game over or victory),
 * and Endless Dash bests for Endless runs.
 */

import { player } from '../player_loader';
import { game } from '../game_runtime';
import { serializeRunSeed, tryGetRunSeed, type RunSeed } from '../run_seed';
import { ghostRunRecorder, saveGhostRecording } from '../ghost_run';
import { ENDLESS_LEVEL_BASE } from '../endless/constants';
import { formatEndlessCode } from '../endless/seed';

/** Run whose Endless result was already recorded (game over can fire more than once). */
let endlessRecordedFor: RunSeed | null = null;

export function saveLastRunSummary(): void {
    const seed = tryGetRunSeed();
    if (!seed) return;
    const distance = player ? Math.floor(player.position.x) : 0;
    if (seed.campaignId === 'endless' && endlessRecordedFor !== seed) {
        endlessRecordedFor = seed;
        const chapter = Math.max(1, game.levelManager.currentLevel - ENDLESS_LEVEL_BASE);
        game.saveManager.recordEndlessRun(chapter, distance, formatEndlessCode(seed.rngSeed));
    }
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

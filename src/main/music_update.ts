/**
 * music_update.ts
 * Translates gameplay state into the four 0..1 signals the adaptive chapter
 * music runtime consumes.
 *
 * Read-only with respect to gameplay: this samples state, it never changes it.
 * Runs once per frame from the core loop; the audio side smooths everything
 * with `setTargetAtTime`, so a noisy frame never produces a noisy mix.
 */

import { player } from '../player_loader';
import { playerState } from '../game_config';
import { game } from '../game_runtime';
import { geodes } from '../environment';

/** Obstacles inside this window ahead of the player count toward danger. */
const DANGER_WINDOW = 60;
/** Obstacle count in that window that reads as "maximum pressure". */
const DANGER_SATURATION = 12;
/** How close a Fractured Geode harbor has to be to count as a quiet zone. */
const HARBOR_RADIUS = 45;

/** Speed range mapped onto 0..1 for the tempo/energy response. */
const SPEED_FLOOR = 6;
const SPEED_CEILING = 20;

function normalize(value: number, floor: number, ceiling: number): number {
    if (ceiling <= floor) return 0;
    return Math.max(0, Math.min(1, (value - floor) / (ceiling - floor)));
}

/** Obstacle pressure in the window ahead of the player, 0..1. */
function sampleDanger(playerX: number): number {
    let ahead = 0;
    try {
        for (const obstacle of game.obstacleSystem.getObstacles()) {
            const dx = obstacle.position.x - playerX;
            if (dx > 0 && dx < DANGER_WINDOW) ahead++;
        }
    } catch {
        // Obstacle system not built yet (menu, early boot) — no pressure.
        return 0;
    }
    return Math.min(1, ahead / DANGER_SATURATION);
}

/** Calm pockets: dream portals and Fractured Geode harbors. */
function sampleQuiet(playerX: number): number {
    if (game.dreamPortalSystem?.isActive?.()) return 1;

    for (const geode of geodes) {
        if (Math.abs(geode.position.x - playerX) < HARBOR_RADIUS) return 0.7;
    }
    return 0;
}

/**
 * Samples gameplay and pushes the result into the chapter music runtime.
 * Safe to call every frame, including before a chapter bed exists.
 */
export function updateChapterMusicDynamics(): void {
    if (!player) return;

    const playerX = player.position.x;

    const speed = normalize(playerState.autoScrollSpeed, SPEED_FLOOR, SPEED_CEILING);
    const boost = game.boostSystem?.isBoosting?.() ? 1 : 0;

    // A boss is unambiguous danger; obstacle density fills in the rest.
    const density = sampleDanger(playerX);
    const danger = playerState.bossActive ? Math.max(0.85, density) : density;

    // Danger always wins over a quiet pocket — a boss in a harbor is not calm.
    const quiet = Math.max(0, sampleQuiet(playerX) - danger);

    game.audioSystem.updateAdaptiveMusic({ speed, boost, danger, quiet });
}

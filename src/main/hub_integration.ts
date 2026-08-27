/**
 * Glue between the running game and the Space Base hub shell.
 *
 * Builds the run summary from live game state and handles chapter launches
 * (persisted via localStorage, then a reload — the same restart path the
 * pause/game-over screens already use).
 */

import { player } from '../player_loader';
import { playerState, setIsGamePaused } from '../game_config';
import { game } from '../game_runtime';
import {
    createHubScreen,
    setPendingStartChapter,
    type HubMode,
    type HubRunSummary
} from '../hub_screen';
import { serializeRunSeed, tryGetRunSeed } from '../run_seed';

let hubElement: HTMLDivElement | null = null;

function buildRunSummary(): HubRunSummary {
    const seed = tryGetRunSeed();
    return {
        distance: player ? Math.floor(player.position.x) : 0,
        coresEarned: playerState.cores,
        speciesDiscovered: game.discoveryManager?.getDiscoveredCount() ?? 0,
        creaturesCataloged: game.creatureCatalogManager?.getCatalogedCountThisRun() ?? 0,
        runSeed: seed ? serializeRunSeed(seed) : undefined
    };
}

export function isHubOpen(): boolean {
    return hubElement !== null;
}

export function openHubScreen(mode: HubMode): void {
    if (hubElement) return;
    setIsGamePaused(true);

    hubElement = createHubScreen(game.saveManager, {
        mode,
        summary: buildRunSummary(),
        playSound: (name) => game.audioSystem.play(name, 0.6),
        onLaunchChapter: (chapter) => {
            setPendingStartChapter(chapter);
            location.reload();
        },
        onClose: () => {
            hubElement = null;
            // Only a pause-opened hub returns to live gameplay; the
            // victory/game-over screens stay up underneath otherwise.
            if (mode === 'pause') setIsGamePaused(false);
        }
    });
    document.body.appendChild(hubElement);
}

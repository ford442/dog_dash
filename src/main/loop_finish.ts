import { player } from '../player_loader';
import { playerState, setIsGamePaused } from '../game_config';
import { game } from '../game_runtime';
import { keys, updateDistanceDisplay } from '../ui_controls';
import { VictoryState } from '../victory_system/victory_state';
import { DogAnimationState } from '../dog_cockpit';
import { saveLastRunSummary } from '../run_seed/save_last_run';
import { isArchitectRun, isCampaignRun } from '../journey_layout';
import { getLevelSpan } from '../depth_layers';
import { restartRun } from './restart_run';
import { updateHeatBar, updateCoresDisplay, updateBoostDisplay, updateRollDisplay, updateBarkDisplay, updateTetherDisplay, updateGrenadeDisplay } from './hud_displays';

export function updateLoopFinish(_time: number): void {
        
        // Update distance display
        updateDistanceDisplay(playerState, player);
        
        // Update UI elements
        updateHeatBar();
        updateCoresDisplay();
        updateBoostDisplay();
        updateRollDisplay();
        updateBarkDisplay();
        updateTetherDisplay();
        updateGrenadeDisplay();
        
        // Architect sandbox: the finish line is the end of the course.
        if (player && isArchitectRun() && !playerState.hasWon && !playerState.bossActive
            && player.position.x >= getLevelSpan(game.levelManager.currentLevel).endX) {
            finishArchitectCourse();
        }

        // Check if player reached the moon (or defeated boss in level 1).
        // Endless and Architect runs have no Moon.
        if (player && isCampaignRun() && player.position.x >= playerState.distanceToMoon - 10 && !playerState.hasWon && !playerState.bossActive) {
            // If we got here without beating the boss, spawn it now
            if (playerState.level === 1 && game.bossManager.getBoss() === null) {
                // Trigger boss
            } else {
                playerState.hasWon = true;
                saveLastRunSummary();
                game.saveManager.updateHighScore(Math.floor(player.position.x));
                game.saveManager.addCores(playerState.cores);

                if (game.victorySystem.getState() === VictoryState.NONE) {
                    game.victorySystem.startApproach(game.moon.position);
                }

                game.audioSystem.play('boss_defeat');
                game.dogController.triggerAnimation(DogAnimationState.VICTORY, 5.0);
                game.hudManager.checkAndSaveHighScore();
            }
        }
    
    
}

/**
 * A playtest is not a campaign run: no cores banked, no high score, no Moon.
 * The ghost is saved (saveLastRunSummary) so "Fly it again" races it.
 */
function finishArchitectCourse(): void {
    playerState.hasWon = true;
    saveLastRunSummary();
    game.audioSystem.playMagicSequence('power_up');
    game.dogController.triggerAnimation(DogAnimationState.VICTORY, 5.0);
    setIsGamePaused(true);
    game.hudManager.showCourseCompleteScreen({
        score: game.hudManager.getScore(),
        distance: player ? Math.floor(player.position.x) : 0,
        orbsCollected: playerState.cores,
        powerUpsUsed: 0
    }, restartRun);
}
